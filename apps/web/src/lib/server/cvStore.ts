import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { parse, stringify } from "yaml";

import { repoPath } from "./repoPaths";
import {
  buildCvVariantIdLoose,
  isSupportedLanguage,
  parseCvVariantId,
  parseCvVariantIdLoose,
  type CvLanguage,
} from "./cvVariants";
import { readOpenRouterSettings } from "./openRouterSettings";

export type CvDocument = Record<string, unknown>;
export type CvGitVersionInfo = {
  tracked: boolean;
  commitCount: number;
  lastCommitHash: string | null;
  lastCommitAt: string | null;
};

export type CvVariantInfo = {
  id: string;
  language: CvLanguage | null;
  iteration: string | null;
  target: string | null;
  displayName: string;
  displayVersion: string;
  git: CvGitVersionInfo;
};

const CVS_DIR = repoPath("data", "cvs");
const HISTORY_DIR = path.join(CVS_DIR, "history");
const execFileAsync = promisify(execFile);

function assertValidCvId(cvId: string): void {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{1,79}$/.test(cvId)) {
    throw new Error(
      "Invalid cvId. Use 2-80 chars: letters, numbers, underscore, hyphen.",
    );
  }
}

function cvPath(cvId: string): string {
  return path.join(CVS_DIR, `${cvId}.yaml`);
}

function cvHistoryPath(cvId: string): string {
  return path.join(HISTORY_DIR, cvId);
}

async function ensureCvDir(): Promise<void> {
  await fs.mkdir(CVS_DIR, { recursive: true });
}

function withUpdatedMetadata(input: CvDocument): CvDocument {
  const nowIso = new Date().toISOString();
  const nowDate = nowIso.slice(0, 10);
  const metadataRaw = input.metadata;
  const metadata =
    metadataRaw && typeof metadataRaw === "object" && !Array.isArray(metadataRaw)
      ? (metadataRaw as Record<string, unknown>)
      : {};

  const parsed = parseCvVariantIdLoose(String(input.id ?? ""));
  const inferred = parsed ?? null;

  return {
    ...input,
    metadata: {
      ...metadata,
      language:
        (inferred?.language as string | undefined) ??
        (metadata.language as string | undefined) ??
        "bg",
      variant:
        inferred
          ? {
              cv_id: buildCvVariantIdLoose(inferred),
              iteration: inferred.iteration,
              target: inferred.target,
              language: inferred.language,
            }
          : (metadata.variant as Record<string, unknown> | undefined),
      created_at: (metadata.created_at as string | undefined) ?? nowDate,
      updated_at: nowIso,
      updated_on: (metadata.updated_on as string | undefined) ?? nowDate,
      last_edited_at: nowIso,
    },
  };
}

export async function listCvIds(): Promise<string[]> {
  await ensureCvDir();
  const entries = await fs.readdir(CVS_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".yaml"))
    .map((entry) => entry.name.replace(/\.yaml$/, ""))
    .sort((a, b) => a.localeCompare(b));
}

async function gitVersionInfo(cvId: string): Promise<CvGitVersionInfo> {
  const root = repoPath();
  const rel = path.relative(root, cvPath(cvId));
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["log", "--follow", "--format=%H|%cI", "--", rel],
      { cwd: root },
    );
    const lines = stdout
      .trim()
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      return {
        tracked: false,
        commitCount: 0,
        lastCommitHash: null,
        lastCommitAt: null,
      };
    }

    const [lastHash = null, lastAt = null] = lines[0].split("|");
    return {
      tracked: true,
      commitCount: lines.length,
      lastCommitHash: lastHash,
      lastCommitAt: lastAt,
    };
  } catch {
    return {
      tracked: false,
      commitCount: 0,
      lastCommitHash: null,
      lastCommitAt: null,
    };
  }
}

export async function listCvVariants(): Promise<CvVariantInfo[]> {
  const ids = await listCvIds();
  const variants = await Promise.all(
    ids.map(async (id) => {
      const parsed = parseCvVariantId(id);
      const doc = await readCv(id);
      const metadata =
        doc?.metadata && typeof doc.metadata === "object" && !Array.isArray(doc.metadata)
          ? (doc.metadata as Record<string, unknown>)
          : null;
      const metadataLanguage =
        typeof metadata?.language === "string" ? metadata.language.trim().toLowerCase() : "";
      const internalName =
        (typeof metadata?.internal_name === "string" && metadata.internal_name) || id;
      const internalVersion =
        (typeof metadata?.internal_version === "string" && metadata.internal_version) || "1.0";
      return {
        id,
        language: parsed?.language ?? (isSupportedLanguage(metadataLanguage) ? metadataLanguage : null),
        iteration: parsed?.iteration ?? null,
        target: parsed?.target ?? null,
        displayName: internalName,
        displayVersion: internalVersion,
        git: await gitVersionInfo(id),
      };
    }),
  );
  return variants;
}

export async function readCv(cvId: string): Promise<CvDocument | null> {
  assertValidCvId(cvId);
  try {
    const content = await fs.readFile(cvPath(cvId), "utf-8");
    const parsed = parse(content);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(`CV file ${cvId} is not a YAML object.`);
    }
    return parsed as CvDocument;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function writeCv(
  cvId: string,
  payload: CvDocument,
  options?: { createSnapshot?: boolean },
): Promise<void> {
  assertValidCvId(cvId);
  await ensureCvDir();
  const destination = cvPath(cvId);

  if (options?.createSnapshot) {
    const current = await readCv(cvId);
    if (current) {
      const historyDirectory = cvHistoryPath(cvId);
      await fs.mkdir(historyDirectory, { recursive: true });
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const snapshotDestination = path.join(historyDirectory, `${timestamp}.yaml`);
      await fs.writeFile(snapshotDestination, stringify(current), "utf-8");
    }
  }

  const normalized = withUpdatedMetadata({
    ...payload,
    id: cvId,
  });
  await fs.writeFile(destination, stringify(normalized), "utf-8");
}

export async function deleteCv(cvId: string): Promise<boolean> {
  assertValidCvId(cvId);
  try {
    await fs.unlink(cvPath(cvId));
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

export async function listCvSnapshots(cvId: string): Promise<string[]> {
  assertValidCvId(cvId);
  try {
    const entries = await fs.readdir(cvHistoryPath(cvId), { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".yaml"))
      .map((entry) => entry.name)
      .sort((a, b) => b.localeCompare(a));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

function cloneCvDocument(input: CvDocument): CvDocument {
  return JSON.parse(JSON.stringify(input)) as CvDocument;
}

function buildTranslationPrompt(
  sourceCv: CvDocument,
  sourceLanguage: string,
  targetLanguage: string,
): string {
  return [
    "Translate user-facing string values in this CV JSON object from source language to target language.",
    "Keep all keys, structure, ids, dates, numbers, booleans, urls and emails unchanged.",
    "Do not translate technical keys or enum-like values.",
    "Return JSON only.",
    `Source language code: ${sourceLanguage}`,
    `Target language code: ${targetLanguage}`,
    `JSON:\n${JSON.stringify(sourceCv, null, 2)}`,
  ].join("\n");
}

function extractFirstJsonBlock(input: string): unknown {
  const trimmed = input.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // no-op
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      // no-op
    }
  }
  return null;
}

async function maybeTranslateCvDocument(args: {
  sourceCv: CvDocument;
  sourceLanguage: string;
  targetLanguage: string;
}): Promise<{ cv: CvDocument; status: string; mode: string }> {
  const settings = await readOpenRouterSettings();
  const apiKey = settings.apiKey || process.env.OPENROUTER_API_KEY || "";
  if (!apiKey.trim()) {
    return {
      cv: cloneCvDocument(args.sourceCv),
      status: "auto-generated-pending-review",
      mode: "fallback-copy-no-api-key",
    };
  }

  const response = await fetch(settings.baseUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model || "openai/gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a strict JSON translator." },
        { role: "user", content: buildTranslationPrompt(args.sourceCv, args.sourceLanguage, args.targetLanguage) },
      ],
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const raw = await response.text();
    throw new Error(`OpenRouter request failed (${response.status}): ${raw}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content ?? "";
  const translated = extractFirstJsonBlock(content);
  if (!translated || typeof translated !== "object" || Array.isArray(translated)) {
    throw new Error("Could not parse translated CV JSON from OpenRouter response.");
  }

  return {
    cv: translated as CvDocument,
    status: "auto-generated-pending-review",
    mode: "openrouter-json-translation",
  };
}

export async function ensureLanguageVariant(
  sourceCvId: string,
  targetLanguage: CvLanguage,
  options?: { autoTranslate?: boolean },
): Promise<{ cvId: string; created: boolean }> {
  const parsed = parseCvVariantIdLoose(sourceCvId);
  if (!parsed) {
    throw new Error(
      "Language variant auto-resolution requires cvId format cv_<language>_<target> or cv_<language>_<iteration>_<target>.",
    );
  }
  const normalizedTargetLanguage = targetLanguage.trim().toLowerCase();
  if (!isSupportedLanguage(normalizedTargetLanguage)) {
    throw new Error("Target language code is invalid. Use 2-8 alphabetic characters.");
  }

  const requestedCvId = buildCvVariantIdLoose({
    language: normalizedTargetLanguage,
    iteration: parsed.iteration,
    target: parsed.target,
  });

  const existing = await readCv(requestedCvId);
  if (existing) {
    return { cvId: requestedCvId, created: false };
  }

  if (!options?.autoTranslate) {
    throw new Error(`Variant '${requestedCvId}' does not exist.`);
  }

  const source = await readCv(sourceCvId);
  if (!source) {
    throw new Error(`Source CV '${sourceCvId}' does not exist.`);
  }

  let cloned = cloneCvDocument(source);
  let translationMode = "fallback-copy";
  let translationStatus = "auto-generated-pending-review";
  if (parsed.language !== normalizedTargetLanguage) {
    try {
      const translated = await maybeTranslateCvDocument({
        sourceCv: source,
        sourceLanguage: parsed.language,
        targetLanguage: normalizedTargetLanguage,
      });
      cloned = translated.cv;
      translationMode = translated.mode;
      translationStatus = translated.status;
    } catch (error) {
      cloned = cloneCvDocument(source);
      translationMode = "fallback-copy-translation-error";
      translationStatus = "auto-generated-pending-review";
      const metadataRaw = cloned.metadata;
      const metadata =
        metadataRaw && typeof metadataRaw === "object" && !Array.isArray(metadataRaw)
          ? (metadataRaw as Record<string, unknown>)
          : {};
      cloned.metadata = {
        ...metadata,
        translation_error: error instanceof Error ? error.message : "Unknown translation error.",
      };
    }
  }

  const metadataRaw = cloned.metadata;
  const metadata =
    metadataRaw && typeof metadataRaw === "object" && !Array.isArray(metadataRaw)
      ? (metadataRaw as Record<string, unknown>)
      : {};

  cloned.metadata = {
    ...metadata,
    language: normalizedTargetLanguage,
    translation: {
      status: translationStatus,
      mode: translationMode,
      source_cv_id: sourceCvId,
      source_language: parsed.language,
      target_language: normalizedTargetLanguage,
      generated_at: new Date().toISOString(),
    },
  };

  await writeCv(requestedCvId, cloned, { createSnapshot: false });
  return { cvId: requestedCvId, created: true };
}

export async function getCvGitVersionInfo(cvId: string): Promise<CvGitVersionInfo> {
  return gitVersionInfo(cvId);
}
