import { execFile, spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { NextResponse } from "next/server";

import { ensureCoreDatasetFresh, readCoreDataset } from "@/lib/server/keywordCoreDataset";
import { repoPath } from "@/lib/server/repoPaths";

export const runtime = "nodejs";

const execFileAsync = promisify(execFile);
const CACHE_DB_RELATIVE = path.join("outputs", "jd_scrape_cache.sqlite");
const KEYWORD_CONFIG_RELATIVE = path.join("config", "relevance_keywords.json");

type ManageAction = "run_collection";

type ManageRequest = {
  action?: ManageAction;
};

type RunState = "queued" | "scraping" | "merging" | "completed" | "failed";

type RunProgress = {
  runId: string;
  state: RunState;
  phase: string;
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
  logs: string[];
  error: string | null;
  mergedItems: number | null;
  sourceFiles: number | null;
};

type RunStore = {
  runs: Map<string, RunProgress>;
  latestRunId: string | null;
  activeRunId: string | null;
};

const globalStore = globalThis as typeof globalThis & { __keywordRunStore?: RunStore };
const runStore: RunStore = globalStore.__keywordRunStore ?? {
  runs: new Map<string, RunProgress>(),
  latestRunId: null,
  activeRunId: null,
};
globalStore.__keywordRunStore = runStore;

const fallbackRoles = [
  "software engineer",
  "senior software engineer",
  "backend engineer",
  "frontend engineer",
  "full stack engineer",
  "data analyst",
  "product manager",
];

const fallbackSuffixes = [
  "jobs",
  "job description",
  "openings",
  "hiring now",
  "remote",
  "hybrid",
  "careers",
  "apply",
];

function nowIso(): string {
  return new Date().toISOString();
}

function lineSplit(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

async function safeSqliteCountQuery(dbPath: string, sql: string): Promise<number> {
  try {
    const result = await execFileAsync("sqlite3", [dbPath, sql], {
      timeout: 10_000,
      maxBuffer: 1024 * 256,
    });
    return Number((result.stdout || "0").trim()) || 0;
  } catch {
    return 0;
  }
}

function updateRun(runId: string, mutator: (current: RunProgress) => void): void {
  const run = runStore.runs.get(runId);
  if (!run) return;
  mutator(run);
  run.updatedAt = nowIso();
}

function appendRunLog(runId: string, line: string): void {
  updateRun(runId, (run) => {
    run.logs.push(`[${new Date().toLocaleTimeString()}] ${line}`);
    if (run.logs.length > 400) {
      run.logs = run.logs.slice(-400);
    }
  });
}

function serializeRun(run: RunProgress | null) {
  if (!run) return null;
  return {
    runId: run.runId,
    state: run.state,
    phase: run.phase,
    startedAt: run.startedAt,
    updatedAt: run.updatedAt,
    completedAt: run.completedAt,
    error: run.error,
    mergedItems: run.mergedItems,
    sourceFiles: run.sourceFiles,
    logs: run.logs.slice(-120),
  };
}

async function buildRuntimeSeedFile(runId: string): Promise<{ relativePath: string; lineCount: number; roleCount: number }> {
  const root = repoPath("keywords");
  const defaultSeedPath = path.join(root, "sources", "seed_urls.txt");
  const keywordConfigPath = path.join(root, KEYWORD_CONFIG_RELATIVE);
  const runtimeSeedRelative = path.join("outputs", `runtime_seed_urls_${runId}.txt`);
  const runtimeSeedPath = path.join(root, runtimeSeedRelative);

  const lines = new Set<string>();
  try {
    const raw = await fs.readFile(defaultSeedPath, "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      lines.add(trimmed);
    }
  } catch {
    // Use generated seeds only.
  }

  let runtimeSeedRoles = fallbackRoles;
  let runtimeSeedSuffixes = fallbackSuffixes;
  try {
    const rawConfig = await fs.readFile(keywordConfigPath, "utf-8");
    const parsed = JSON.parse(rawConfig) as {
      target_roles?: unknown[];
      runtime_seed_suffixes?: unknown[];
    };
    const configuredRoles = (parsed.target_roles ?? [])
      .map((value) => String(value).trim())
      .filter(Boolean);
    const configuredSuffixes = (parsed.runtime_seed_suffixes ?? [])
      .map((value) => String(value).trim())
      .filter(Boolean);
    if (configuredRoles.length > 0) {
      runtimeSeedRoles = configuredRoles;
    }
    if (configuredSuffixes.length > 0) {
      runtimeSeedSuffixes = configuredSuffixes;
    }
  } catch {
    // Use fallback roles/suffixes when config is not readable.
  }

  const dayBucket = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
  const rotatingOffset = dayBucket % 4;
  const startValues = [0, 10, 20, 30].slice(rotatingOffset);

  for (const role of runtimeSeedRoles) {
    for (const suffix of runtimeSeedSuffixes) {
      const query = encodeURIComponent(`${role} ${suffix}`);
      lines.add(`https://www.indeed.com/jobs?q=${query}&sort=date`);
      lines.add(`https://www.bing.com/search?q=${query}`);
      lines.add(`https://duckduckgo.com/html/?q=${query}`);
      for (const start of startValues) {
        lines.add(`https://www.indeed.com/jobs?q=${query}&sort=date&start=${start}`);
      }
    }
  }

  await fs.writeFile(runtimeSeedPath, `${[...lines].join("\n")}\n`, "utf-8");
  return { relativePath: runtimeSeedRelative, lineCount: lines.size, roleCount: runtimeSeedRoles.length };
}

async function gatherManagementStats() {
  await ensureCoreDatasetFresh({ removeLegacySnapshots: true });

  const cacheDb = repoPath("keywords", CACHE_DB_RELATIVE);

  const profilesScannedTotal = await safeSqliteCountQuery(cacheDb, "SELECT COUNT(*) FROM scraped_pages WHERE scraped = 1;");
  const profilesScannedToday = await safeSqliteCountQuery(
    cacheDb,
    "SELECT COUNT(*) FROM scraped_pages WHERE scraped = 1 AND datetime(scraped_at) >= datetime('now','start of day');",
  );
  const profilesScannedWeek = await safeSqliteCountQuery(
    cacheDb,
    "SELECT COUNT(*) FROM scraped_pages WHERE scraped = 1 AND datetime(scraped_at) >= datetime('now','-6 days','start of day');",
  );

  let keywordsIdentified = 0;
  let coreDatasetProfiles = 0;
  try {
    const { payload } = await readCoreDataset();
    const items = Array.isArray(payload.items) ? payload.items : [];
    coreDatasetProfiles = items.length;
    const set = new Set<string>();
    for (const item of items) {
      for (const keyword of item.matched_keywords ?? []) {
        const normalized = String(keyword).trim().toLowerCase();
        if (normalized) set.add(normalized);
      }
    }
    keywordsIdentified = set.size;
  } catch {
    keywordsIdentified = 0;
    coreDatasetProfiles = 0;
  }

  return {
    profilesScanned: {
      today: profilesScannedToday,
      week: profilesScannedWeek,
      total: profilesScannedTotal,
    },
    coreDatasetProfiles,
    keywordsIdentified,
    cacheDbPath: cacheDb,
  };
}

function startCollectionRun(): { run: RunProgress; reused: boolean } {
  if (runStore.activeRunId) {
    const active = runStore.runs.get(runStore.activeRunId);
    if (active && (active.state === "queued" || active.state === "scraping" || active.state === "merging")) {
      const staleMs = Date.now() - Date.parse(active.updatedAt);
      if (Number.isFinite(staleMs) && staleMs > 120_000) {
        active.state = "failed";
        active.phase = "Failed";
        active.error = "Run marked stale after no progress updates for over 120 seconds.";
        active.completedAt = nowIso();
        active.updatedAt = nowIso();
        runStore.activeRunId = null;
      } else {
        return { run: active, reused: true };
      }
    }
    if (active && (active.state === "queued" || active.state === "scraping" || active.state === "merging")) {
      return { run: active, reused: true };
    }
  }

  const runId = `run_${Date.now()}`;
  const run: RunProgress = {
    runId,
    state: "queued",
    phase: "Queued",
    startedAt: nowIso(),
    updatedAt: nowIso(),
    completedAt: null,
    logs: [],
    error: null,
    mergedItems: null,
    sourceFiles: null,
  };
  runStore.runs.set(runId, run);
  runStore.latestRunId = runId;
  runStore.activeRunId = runId;

  void (async () => {
    let runtimeSeedAbsolutePath = "";
    try {
      updateRun(runId, (current) => {
        current.state = "scraping";
        current.phase = "Scraping JDs";
      });

      appendRunLog(runId, "Starting JD collection in resume mode.");
      appendRunLog(runId, "Cache dedupe active: URL and content-hash duplicates are skipped.");

      const runtimeSeed = await buildRuntimeSeedFile(runId);
      runtimeSeedAbsolutePath = repoPath("keywords", runtimeSeed.relativePath);
      appendRunLog(runId, `Runtime seed pack generated with ${runtimeSeed.lineCount} sources.`);
      appendRunLog(runId, "Seed rotation enabled to reduce duplicate profile pulls across daily runs.");
      appendRunLog(runId, `Role seeds loaded from config: ${runtimeSeed.roleCount}.`);

      const projectRoot = repoPath();
      const scriptPath = repoPath("keywords", "jd_scraper.py");
      const child = spawn(
        "/usr/bin/python3",
        [
          scriptPath,
          "--provider", "native",
          "--mode", "resume",
          "--seed-file", runtimeSeed.relativePath,
          "--max-pages", "2400",
          "--max-depth", "2",
          "--max-results", "50000",
          "--min-score", "6",
          "--timeout", "4",
          "--sleep-ms", "0",
          "--cache-db", CACHE_DB_RELATIVE,
        ],
        {
          cwd: projectRoot,
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      const cacheDbPath = repoPath("keywords", CACHE_DB_RELATIVE);
      const heartbeatId = setInterval(() => {
        void (async () => {
          const total = await safeSqliteCountQuery(cacheDbPath, "SELECT COUNT(*) FROM scraped_pages WHERE scraped = 1;");
          const relevant = await safeSqliteCountQuery(cacheDbPath, "SELECT COUNT(*) FROM scraped_pages WHERE is_relevant = 1;");
          appendRunLog(runId, `Progress: scanned=${total} relevant=${relevant}`);
        })();
      }, 2000);

      child.stdout.setEncoding("utf-8");
      child.stderr.setEncoding("utf-8");
      child.stdout.on("data", (chunk: string) => {
        for (const line of lineSplit(chunk)) {
          appendRunLog(runId, line);
        }
      });
      child.stderr.on("data", (chunk: string) => {
        for (const line of lineSplit(chunk)) {
          appendRunLog(runId, `stderr: ${line}`);
        }
      });

      const exitCode: number = await new Promise((resolve, reject) => {
        child.on("error", reject);
        child.on("close", resolve);
      });
      clearInterval(heartbeatId);
      if (exitCode !== 0) {
        throw new Error(`jd_scraper exited with code ${exitCode}`);
      }

      updateRun(runId, (current) => {
        current.state = "merging";
        current.phase = "Refreshing Core Database";
      });
      appendRunLog(runId, "Scrape finished. Refreshing core database from cache.");
      const refreshed = await ensureCoreDatasetFresh({ forceRebuild: true, removeLegacySnapshots: true });
      appendRunLog(runId, `Core database updated: ${refreshed.itemCount} profiles.`);
      if (refreshed.removedLegacySnapshots > 0) {
        appendRunLog(runId, `Removed ${refreshed.removedLegacySnapshots} legacy snapshot files.`);
      }

      updateRun(runId, (current) => {
        current.state = "completed";
        current.phase = "Completed";
        current.completedAt = nowIso();
        current.mergedItems = refreshed.itemCount;
        current.sourceFiles = 1;
      });
    } catch (error) {
      updateRun(runId, (current) => {
        current.state = "failed";
        current.phase = "Failed";
        current.completedAt = nowIso();
        current.error = error instanceof Error ? error.message : "Run failed";
      });
      appendRunLog(runId, `Run failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      if (runtimeSeedAbsolutePath) {
        try {
          await fs.unlink(runtimeSeedAbsolutePath);
        } catch {
          // Ignore seed cleanup failures.
        }
      }
      if (runStore.activeRunId === runId) {
        runStore.activeRunId = null;
      }
    }
  })();

  return { run, reused: false };
}

export async function GET(request: Request): Promise<NextResponse> {
  const stats = await gatherManagementStats();
  const url = new URL(request.url);
  const runId = (url.searchParams.get("runId") ?? "").trim();
  const selectedRun = runId
    ? runStore.runs.get(runId) ?? null
    : runStore.latestRunId
      ? runStore.runs.get(runStore.latestRunId) ?? null
      : null;

  return NextResponse.json({
    ok: true,
    stats,
    run: serializeRun(selectedRun),
    activeRunId: runStore.activeRunId,
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json().catch(() => ({}))) as ManageRequest;
  const action = body.action;
  if (!action) {
    return NextResponse.json({ error: "action is required." }, { status: 400 });
  }

  if (action === "run_collection") {
    const started = startCollectionRun();
    const stats = await gatherManagementStats();
    return NextResponse.json({
      ok: true,
      action,
      started: true,
      alreadyRunning: started.reused,
      run: serializeRun(started.run),
      stats,
      note: "Each run rotates seed sources and refreshes the core database directly from cache.",
    });
  }

  return NextResponse.json({ error: `Unsupported action: ${action}` }, { status: 400 });
}
