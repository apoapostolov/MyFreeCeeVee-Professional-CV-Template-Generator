import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { parse, stringify } from "yaml";

import { repoPath } from "./repoPaths";
import {
  buildCvVariantId,
  parseCvVariantId,
  type CvLanguage,
} from "./cvVariants";

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
  const now = new Date().toISOString().slice(0, 10);
  const metadataRaw = input.metadata;
  const metadata =
    metadataRaw && typeof metadataRaw === "object" && !Array.isArray(metadataRaw)
      ? (metadataRaw as Record<string, unknown>)
      : {};

  const parsed = parseCvVariantId(String(input.id ?? ""));
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
              cv_id: buildCvVariantId(inferred),
              iteration: inferred.iteration,
              target: inferred.target,
              language: inferred.language,
            }
          : (metadata.variant as Record<string, unknown> | undefined),
      created_at: (metadata.created_at as string | undefined) ?? now,
      updated_at: now,
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
      const internalName =
        (typeof metadata?.internal_name === "string" && metadata.internal_name) || id;
      const internalVersion =
        (typeof metadata?.internal_version === "string" && metadata.internal_version) || "1.0";
      return {
        id,
        language: parsed?.language ?? null,
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

export async function ensureLanguageVariant(
  sourceCvId: string,
  targetLanguage: CvLanguage,
  options?: { autoTranslate?: boolean },
): Promise<{ cvId: string; created: boolean }> {
  const parsed = parseCvVariantId(sourceCvId);
  if (!parsed) {
    throw new Error(
      "Language variant auto-resolution requires cvId format cv_<bg|en>_<iteration>_<target>.",
    );
  }

  const requestedCvId = buildCvVariantId({
    language: targetLanguage,
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

  const cloned = cloneCvDocument(source);
  const metadataRaw = cloned.metadata;
  const metadata =
    metadataRaw && typeof metadataRaw === "object" && !Array.isArray(metadataRaw)
      ? (metadataRaw as Record<string, unknown>)
      : {};

  cloned.metadata = {
    ...metadata,
    language: targetLanguage,
    translation: {
      status: "auto-generated-pending-review",
      mode: "fallback-copy",
      source_cv_id: sourceCvId,
      source_language: parsed.language,
      target_language: targetLanguage,
      generated_at: new Date().toISOString(),
    },
  };

  await writeCv(requestedCvId, cloned, { createSnapshot: false });
  return { cvId: requestedCvId, created: true };
}

export async function getCvGitVersionInfo(cvId: string): Promise<CvGitVersionInfo> {
  return gitVersionInfo(cvId);
}
