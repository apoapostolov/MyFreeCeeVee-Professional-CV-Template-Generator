import fs from "node:fs/promises";

import { repoPath } from "@/lib/server/repoPaths";

export type StoredPhotoAnalysis = {
  score: number;
  verdict: "excellent" | "good" | "usable" | "weak";
  notes: string[];
  clothingProposals?: string[];
  analyzedAt: string;
  model: string;
};

export type StoredPhotoComparison = {
  criteria: Array<{
    name: string;
    summary: string;
  }>;
  ranked: Array<{
    name: string;
    score: number;
    verdict: "excellent" | "good" | "usable" | "weak";
    strengths: string[];
    risks: string[];
    improvements: string[];
  }>;
  winnerName: string;
  recommendation: string;
  recommendationDetails: string[];
  analyzedAt: string;
  model: string;
};

type PhotoAnalysisStore = {
  version: 1;
  photos: Record<string, { history: StoredPhotoAnalysis[] }>;
  comparisons?: Record<
    string,
    {
      imageIds: string[];
      history: StoredPhotoComparison[];
    }
  >;
};

const PHOTOS_DIR = repoPath("photos");
const STORE_PATH = repoPath("photos", "metadata.json");

async function ensurePhotosDir(): Promise<void> {
  await fs.mkdir(PHOTOS_DIR, { recursive: true });
}

function normalizePhotoId(id: string): string {
  return id.replace(/[^a-zA-Z0-9._-]/g, "");
}

function normalizedComparisonSignature(ids: string[]): string {
  return ids
    .map((id) => normalizePhotoId(id))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
    .join("::");
}

function normalizeStoredAnalysis(input: unknown): StoredPhotoAnalysis | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const record = input as Record<string, unknown>;
  const scoreRaw = Number(record.score ?? 0);
  const score = Number.isFinite(scoreRaw) ? Math.max(0, Math.min(100, Math.round(scoreRaw))) : 0;
  const verdictRaw = String(record.verdict ?? "").trim().toLowerCase();
  const verdict =
    verdictRaw === "excellent" || verdictRaw === "good" || verdictRaw === "usable" || verdictRaw === "weak"
      ? verdictRaw
      : "usable";
  const notes = Array.isArray(record.notes)
    ? record.notes
        .map((entry) => String(entry ?? "").trim())
        .filter((entry) => entry.length > 0)
        .slice(0, 8)
    : [];
  const clothingProposals = Array.isArray(record.clothingProposals)
    ? record.clothingProposals
        .map((entry) => String(entry ?? "").trim())
        .filter((entry) => entry.length > 0)
        .slice(0, 8)
    : [];
  const analyzedAtRaw = String(record.analyzedAt ?? "").trim();
  const analyzedAt = analyzedAtRaw || new Date().toISOString();
  const model = String(record.model ?? "").trim() || "unknown";
  return { score, verdict, notes, clothingProposals, analyzedAt, model };
}

function normalizeStoredComparison(input: unknown): StoredPhotoComparison | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const record = input as Record<string, unknown>;
  const criteriaRaw = Array.isArray(record.criteria) ? record.criteria : [];
  const criteria = criteriaRaw
    .map((entry) => {
      const item =
        entry && typeof entry === "object" && !Array.isArray(entry)
          ? (entry as Record<string, unknown>)
          : null;
      if (!item) return null;
      const name = String(item.name ?? "").trim();
      if (!name) return null;
      return { name, summary: String(item.summary ?? "").trim() };
    })
    .filter((entry): entry is StoredPhotoComparison["criteria"][number] => entry !== null)
    .slice(0, 8);
  const rankedRaw = Array.isArray(record.ranked) ? record.ranked : [];
  const ranked = rankedRaw
    .map((entry) => {
      const item =
        entry && typeof entry === "object" && !Array.isArray(entry)
          ? (entry as Record<string, unknown>)
          : null;
      if (!item) return null;
      const name = String(item.name ?? "").trim();
      if (!name) return null;
      const scoreRaw = Number(item.score ?? 0);
      const score = Number.isFinite(scoreRaw) ? Math.max(0, Math.min(100, Math.round(scoreRaw))) : 0;
      const verdictRaw = String(item.verdict ?? "").trim().toLowerCase();
      const verdict =
        verdictRaw === "excellent" || verdictRaw === "good" || verdictRaw === "usable" || verdictRaw === "weak"
          ? verdictRaw
          : score >= 85
            ? "excellent"
            : score >= 70
              ? "good"
              : score >= 55
                ? "usable"
                : "weak";
      return {
        name,
        score,
        verdict,
        strengths: Array.isArray(item.strengths)
          ? item.strengths.map((it) => String(it ?? "").trim()).filter(Boolean).slice(0, 8)
          : [],
        risks: Array.isArray(item.risks)
          ? item.risks.map((it) => String(it ?? "").trim()).filter(Boolean).slice(0, 8)
          : [],
        improvements: Array.isArray(item.improvements)
          ? item.improvements.map((it) => String(it ?? "").trim()).filter(Boolean).slice(0, 8)
          : [],
      };
    })
    .filter((entry): entry is StoredPhotoComparison["ranked"][number] => entry !== null)
    .slice(0, 16);
  const recommendation = String(record.recommendation ?? "").trim();
  const recommendationDetails = Array.isArray(record.recommendationDetails)
    ? record.recommendationDetails.map((it) => String(it ?? "").trim()).filter(Boolean).slice(0, 8)
    : [];
  const winnerName = String(record.winnerName ?? "").trim() || ranked[0]?.name || "";
  const analyzedAtRaw = String(record.analyzedAt ?? "").trim();
  const analyzedAt = analyzedAtRaw || new Date().toISOString();
  const model = String(record.model ?? "").trim() || "unknown";
  return {
    criteria,
    ranked,
    winnerName,
    recommendation,
    recommendationDetails,
    analyzedAt,
    model,
  };
}

async function readStore(): Promise<PhotoAnalysisStore> {
  await ensurePhotosDir();
  try {
    const raw = await fs.readFile(STORE_PATH, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { version: 1, photos: {}, comparisons: {} };
    }
    const record = parsed as Record<string, unknown>;
    const photosRaw = record.photos;
    const comparisonsRaw = record.comparisons;
    const photos: PhotoAnalysisStore["photos"] = {};
    const comparisons: NonNullable<PhotoAnalysisStore["comparisons"]> = {};
    if (photosRaw && typeof photosRaw === "object" && !Array.isArray(photosRaw)) {
      for (const [id, value] of Object.entries(photosRaw as Record<string, unknown>)) {
        const safeId = normalizePhotoId(id);
        if (!safeId) continue;
        const valueRecord =
          value && typeof value === "object" && !Array.isArray(value)
            ? (value as Record<string, unknown>)
            : null;
        const historyRaw = Array.isArray(valueRecord?.history) ? valueRecord.history : [];
        const history = historyRaw
          .map((entry) => normalizeStoredAnalysis(entry))
          .filter((entry): entry is StoredPhotoAnalysis => entry !== null);
        photos[safeId] = { history };
      }
    }
    if (comparisonsRaw && typeof comparisonsRaw === "object" && !Array.isArray(comparisonsRaw)) {
      for (const [signature, value] of Object.entries(comparisonsRaw as Record<string, unknown>)) {
        const key = normalizedComparisonSignature(signature.split("::"));
        if (!key) continue;
        const valueRecord =
          value && typeof value === "object" && !Array.isArray(value)
            ? (value as Record<string, unknown>)
            : null;
        const idsRaw = Array.isArray(valueRecord?.imageIds) ? valueRecord.imageIds : [];
        const imageIds = idsRaw.map((id) => normalizePhotoId(String(id ?? ""))).filter(Boolean);
        if (imageIds.length < 2) continue;
        const historyRaw = Array.isArray(valueRecord?.history) ? valueRecord.history : [];
        const history = historyRaw
          .map((entry) => normalizeStoredComparison(entry))
          .filter((entry): entry is StoredPhotoComparison => entry !== null);
        comparisons[key] = { imageIds, history };
      }
    }
    return { version: 1, photos, comparisons };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { version: 1, photos: {}, comparisons: {} };
    }
    return { version: 1, photos: {}, comparisons: {} };
  }
}

async function writeStore(store: PhotoAnalysisStore): Promise<void> {
  await ensurePhotosDir();
  const json = JSON.stringify(store, null, 2);
  const tempPath = `${STORE_PATH}.tmp`;
  await fs.writeFile(tempPath, json, "utf-8");
  await fs.rename(tempPath, STORE_PATH);
}

export async function getPhotoAnalysisHistory(photoId: string): Promise<StoredPhotoAnalysis[]> {
  const safeId = normalizePhotoId(photoId);
  if (!safeId) return [];
  const store = await readStore();
  const history = store.photos[safeId]?.history ?? [];
  return [...history].sort((a, b) => Date.parse(b.analyzedAt) - Date.parse(a.analyzedAt));
}

export async function appendPhotoAnalysis(
  photoId: string,
  analysis: StoredPhotoAnalysis,
): Promise<StoredPhotoAnalysis[]> {
  const safeId = normalizePhotoId(photoId);
  if (!safeId) return [];
  const normalized = normalizeStoredAnalysis(analysis);
  if (!normalized) return [];
  const store = await readStore();
  const current = store.photos[safeId]?.history ?? [];
  const next = [normalized, ...current].slice(0, 50);
  store.photos[safeId] = { history: next };
  await writeStore(store);
  return next;
}

export async function getPhotoComparisonHistory(imageIds: string[]): Promise<StoredPhotoComparison[]> {
  const signature = normalizedComparisonSignature(imageIds);
  if (!signature) return [];
  const store = await readStore();
  const history = store.comparisons?.[signature]?.history ?? [];
  return [...history].sort((a, b) => Date.parse(b.analyzedAt) - Date.parse(a.analyzedAt));
}

export async function appendPhotoComparison(
  imageIds: string[],
  comparison: StoredPhotoComparison,
): Promise<StoredPhotoComparison[]> {
  const signature = normalizedComparisonSignature(imageIds);
  if (!signature) return [];
  const normalized = normalizeStoredComparison(comparison);
  if (!normalized) return [];
  const store = await readStore();
  const safeIds = signature.split("::");
  const current = store.comparisons?.[signature]?.history ?? [];
  const next = [normalized, ...current].slice(0, 30);
  store.comparisons = store.comparisons ?? {};
  store.comparisons[signature] = { imageIds: safeIds, history: next };
  await writeStore(store);
  return next;
}

export async function removePhotoAnalysisHistory(photoId: string): Promise<void> {
  const safeId = normalizePhotoId(photoId);
  if (!safeId) return;
  const store = await readStore();
  if (store.photos[safeId]) {
    delete store.photos[safeId];
  }
  if (store.comparisons) {
    for (const [signature, entry] of Object.entries(store.comparisons)) {
      if ((entry.imageIds ?? []).includes(safeId)) {
        delete store.comparisons[signature];
      }
    }
  }
  await writeStore(store);
}
