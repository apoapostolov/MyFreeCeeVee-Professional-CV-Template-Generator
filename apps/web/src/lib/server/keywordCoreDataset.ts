import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { repoPath } from "@/lib/server/repoPaths";

const execFileAsync = promisify(execFile);

export const CORE_DATASET_FILE = "merged.json";
const CACHE_DB_RELATIVE = path.join("outputs", "jd_scrape_cache.sqlite");
const LEGACY_SNAPSHOT_PATTERN = /^jd_relevant_\d{8}T\d{6}Z\.json$/;
const LEGACY_DATASET_PATTERN = /^prototype_dataset_.*\.json$/;

export type RelevantItem = {
  url?: string;
  title?: string;
  score?: number;
  matched_keywords?: string[];
  role_hits?: string[];
  domain?: string;
  snippet?: string;
};

export type RelevantPayload = {
  generated_at?: string;
  run_id?: string;
  provider?: string;
  cached_relevant_count?: number;
  items?: RelevantItem[];
  source_files?: string[];
};

type CacheSummaryRow = {
  scraped_count?: number;
  max_seen?: string | null;
};

type CachePageRow = {
  url?: string;
  title?: string;
  score?: number;
  matched_keywords_json?: string;
  role_hits_json?: string;
  snippet?: string;
};

function parseJsonArray(value: string | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.map((item) => String(item).trim()).filter(Boolean))];
  } catch {
    return [];
  }
}

function readDomain(urlValue: string): string {
  if (!urlValue) return "";
  try {
    const hostname = new URL(urlValue).hostname.trim().toLowerCase();
    return hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

async function runSqliteJsonQuery<T>(dbPath: string, sql: string): Promise<T[]> {
  try {
    const result = await execFileAsync("sqlite3", ["-json", dbPath, sql], {
      timeout: 45_000,
      maxBuffer: 1024 * 1024 * 16,
    });
    const raw = String(result.stdout ?? "").trim();
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export async function removeLegacyKeywordSnapshots(): Promise<number> {
  const outputsDir = repoPath("keywords", "outputs");
  let files: string[] = [];
  try {
    files = await fs.readdir(outputsDir);
  } catch {
    return 0;
  }

  let removed = 0;
  for (const fileName of files) {
    if (!LEGACY_SNAPSHOT_PATTERN.test(fileName) && !LEGACY_DATASET_PATTERN.test(fileName)) {
      continue;
    }
    try {
      await fs.unlink(path.join(outputsDir, fileName));
      removed += 1;
    } catch {
      // Ignore delete errors so cleanup remains best-effort.
    }
  }
  return removed;
}

export async function buildCoreDatasetFromCache(): Promise<{
  payload: RelevantPayload;
  destination: string;
  profileCount: number;
}> {
  const outputsDir = repoPath("keywords", "outputs");
  const dbPath = repoPath("keywords", CACHE_DB_RELATIVE);
  const rows = await runSqliteJsonQuery<CachePageRow>(
    dbPath,
    `
    SELECT
      url,
      COALESCE(title, '') AS title,
      COALESCE(score, 0) AS score,
      COALESCE(matched_keywords_json, '[]') AS matched_keywords_json,
      COALESCE(role_hits_json, '[]') AS role_hits_json,
      COALESCE(snippet, description, '') AS snippet
    FROM scraped_pages
    WHERE scraped = 1
    ORDER BY COALESCE(score, 0) DESC, datetime(last_seen_at) DESC;
    `,
  );

  const items: RelevantItem[] = rows.map((row) => {
    const urlValue = String(row.url ?? "").trim();
    return {
      url: urlValue,
      title: String(row.title ?? "").trim(),
      score: Number(row.score ?? 0),
      matched_keywords: parseJsonArray(row.matched_keywords_json),
      role_hits: parseJsonArray(row.role_hits_json),
      domain: readDomain(urlValue),
      snippet: String(row.snippet ?? "").trim(),
    };
  });

  const payload: RelevantPayload = {
    generated_at: new Date().toISOString(),
    run_id: "core-db",
    provider: "core-database",
    cached_relevant_count: items.length,
    source_files: ["jd_scrape_cache.sqlite"],
    items,
  };

  const destination = path.join(outputsDir, CORE_DATASET_FILE);
  await fs.writeFile(destination, JSON.stringify(payload, null, 2), "utf-8");
  return { payload, destination, profileCount: items.length };
}

export async function readCoreDataset(): Promise<{ payload: RelevantPayload; filePath: string }> {
  const filePath = repoPath("keywords", "outputs", CORE_DATASET_FILE);
  const raw = await fs.readFile(filePath, "utf-8");
  return { payload: JSON.parse(raw) as RelevantPayload, filePath };
}

export async function ensureCoreDatasetFresh(options?: {
  forceRebuild?: boolean;
  removeLegacySnapshots?: boolean;
}): Promise<{
  rebuilt: boolean;
  itemCount: number;
  removedLegacySnapshots: number;
  filePath: string;
}> {
  const forceRebuild = Boolean(options?.forceRebuild);
  const removeLegacySnapshots = options?.removeLegacySnapshots !== false;
  const outputsDir = repoPath("keywords", "outputs");
  const dbPath = repoPath("keywords", CACHE_DB_RELATIVE);
  const corePath = path.join(outputsDir, CORE_DATASET_FILE);

  let removedLegacySnapshots = 0;
  if (removeLegacySnapshots) {
    removedLegacySnapshots = await removeLegacyKeywordSnapshots();
  }

  const summaryRows = await runSqliteJsonQuery<CacheSummaryRow>(
    dbPath,
    "SELECT COUNT(*) AS scraped_count, MAX(last_seen_at) AS max_seen FROM scraped_pages WHERE scraped = 1;",
  );
  const summary = summaryRows[0] ?? {};
  const scrapedCount = Number(summary.scraped_count ?? 0);
  const maxSeenAt = String(summary.max_seen ?? "").trim();

  if (!forceRebuild) {
    try {
      const existingRaw = await fs.readFile(corePath, "utf-8");
      const existing = JSON.parse(existingRaw) as RelevantPayload;
      const existingCount = Array.isArray(existing.items) ? existing.items.length : 0;
      const generatedAt = Date.parse(String(existing.generated_at ?? ""));
      const maxSeenTs = Date.parse(maxSeenAt);
      const countMatches = existingCount === scrapedCount;
      const freshnessMatches = Number.isFinite(generatedAt) && (!maxSeenAt || (Number.isFinite(maxSeenTs) && generatedAt >= maxSeenTs));
      if (countMatches && freshnessMatches) {
        return {
          rebuilt: false,
          itemCount: existingCount,
          removedLegacySnapshots,
          filePath: corePath,
        };
      }
    } catch {
      // Rebuild core dataset when missing or unreadable.
    }
  }

  const rebuilt = await buildCoreDatasetFromCache();
  return {
    rebuilt: true,
    itemCount: rebuilt.profileCount,
    removedLegacySnapshots,
    filePath: rebuilt.destination,
  };
}
