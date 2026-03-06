import fs from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { readCv } from "@/lib/server/cvStore";
import { buildCvVariantId, parseCvVariantId } from "@/lib/server/cvVariants";
import { CORE_DATASET_FILE, ensureCoreDatasetFresh } from "@/lib/server/keywordCoreDataset";
import { repoPath } from "@/lib/server/repoPaths";

export const runtime = "nodejs";

type RelevantItem = {
  url?: string;
  title?: string;
  score?: number;
  matched_keywords?: string[];
  role_hits?: string[];
  domain?: string;
  snippet?: string;
};

type RelevantPayload = {
  generated_at?: string;
  run_id?: string;
  provider?: string;
  cached_relevant_count?: number;
  items?: RelevantItem[];
  source_files?: string[];
};

type KeywordMetric = {
  keyword: string;
  docFreq: number;
  idf: number;
  avgSignal: number;
  weight: number;
  normalized: number;
  band: "grey" | "green" | "yellow" | "orange" | "red";
  cvHits: number;
  cvCoverage: number;
  targetHits: number;
  usageRatio: number;
  status: "missing" | "underused" | "used";
  recommendation: string;
  source?: "jd" | "senior_leadership" | "game_generic" | "combined";
  category?: string;
};

type ClusterMetric = {
  cluster: string;
  totalWeight: number;
  normalized: number;
  keywordCount: number;
  cvCoverage: number;
};

type RoleMetric = {
  role: string;
  docCount: number;
  avgSignal: number;
};

type SupplementalKeywordEntry = {
  keyword: string;
  weight?: number;
  target_hits?: number;
  category?: string;
};

type SupplementalKeywordDb = {
  id?: string;
  label?: string;
  apply_when?: "seniority" | "game_industry";
  description?: string;
  keywords?: SupplementalKeywordEntry[];
};

const CLUSTER_RULES: Array<{ name: string; patterns: RegExp[] }> = [
  {
    name: "Production Leadership",
    patterns: [/producer/i, /product/i, /live\s*ops/i, /operations?/i, /stakeholder/i],
  },
  {
    name: "Game Design",
    patterns: [/game\s*design/i, /designer/i, /systems?/i, /level/i, /gameplay/i],
  },
  {
    name: "Analytics & Data",
    patterns: [/analytics?/i, /data/i, /tracking/i, /telemetry/i, /sql/i, /bi/i],
  },
  {
    name: "Monetization & Live Service",
    patterns: [/monetization/i, /live\s*service/i, /f2p/i, /retention/i, /ltv/i],
  },
  {
    name: "Mobile & Platform",
    patterns: [/mobile/i, /ios/i, /android/i, /platform/i],
  },
  {
    name: "Tools & Reporting",
    patterns: [/looker/i, /bigquery/i, /snowflake/i, /dashboard/i, /reporting/i],
  },
];

function asRecord(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return null;
  }
  return input as Record<string, unknown>;
}

function flattenCvText(input: unknown): string[] {
  const out: string[] = [];
  const stack: unknown[] = [input];
  while (stack.length > 0) {
    const current = stack.pop();
    if (typeof current === "string") {
      const trimmed = current.trim();
      if (trimmed.length > 0) out.push(trimmed);
      continue;
    }
    if (Array.isArray(current)) {
      for (const item of current) stack.push(item);
      continue;
    }
    const record = asRecord(current);
    if (record) {
      for (const value of Object.values(record)) stack.push(value);
    }
  }
  return out;
}

function slugBand(value: number): KeywordMetric["band"] {
  if (value >= 0.8) return "red";
  if (value >= 0.62) return "orange";
  if (value >= 0.45) return "yellow";
  if (value >= 0.28) return "green";
  return "grey";
}

function clusterForKeyword(keyword: string): string {
  for (const rule of CLUSTER_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(keyword))) {
      return rule.name;
    }
  }
  return "General Role Fit";
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function titleCase(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => (part.length <= 2 ? part.toUpperCase() : `${part[0].toUpperCase()}${part.slice(1)}`))
    .join(" ");
}

function calcTargetHits(docFreq: number): number {
  if (docFreq >= 20) return 4;
  if (docFreq >= 10) return 3;
  if (docFreq >= 4) return 2;
  return 1;
}

function recommendForStatus(keyword: string, status: "missing" | "underused" | "used"): string {
  if (status === "missing") {
    return `Add "${keyword}" in summary and at least one outcome-driven experience bullet.`;
  }
  if (status === "underused") {
    return `Use "${keyword}" more consistently across experience and skills with concrete impact context.`;
  }
  return `Keep "${keyword}" coverage consistent and specific.`;
}

function inferSeniorityAspect(roleEntries: RoleMetric[], cvText: string): boolean {
  const seniorityPattern = /\b(senior|lead|manager|director|head|principal|executive|vp|cxo|chief|studio manager)\b/i;
  if (seniorityPattern.test(cvText)) {
    return true;
  }
  return roleEntries.some((entry) => seniorityPattern.test(entry.role));
}

function inferGameIndustryAspect(items: RelevantItem[], roleEntries: RoleMetric[], cvText: string): boolean {
  const gamePattern = /\b(game|gaming|live ops|live[- ]service|economy balancing|level design|narrative design|monetization|retention|arpu|arppu|ltv)\b/i;
  if (gamePattern.test(cvText)) {
    return true;
  }
  const roleText = roleEntries.map((entry) => entry.role).join(" ");
  if (gamePattern.test(roleText)) {
    return true;
  }
  const itemText = items
    .flatMap((item) => [...(item.matched_keywords ?? []), ...(item.role_hits ?? [])])
    .join(" ");
  return gamePattern.test(itemText);
}

async function readSupplementalDb(fileName: string): Promise<SupplementalKeywordDb | null> {
  try {
    const filePath = repoPath("keywords", "config", fileName);
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as SupplementalKeywordDb;
  } catch {
    return null;
  }
}

function normalizedSupplementalEntries(db: SupplementalKeywordDb | null): SupplementalKeywordEntry[] {
  if (!db || !Array.isArray(db.keywords)) return [];
  return db.keywords
    .map((entry) => ({
      keyword: normalizeToken(String(entry.keyword ?? "")),
      weight: Number(entry.weight ?? 0),
      target_hits: Number(entry.target_hits ?? 0),
      category: String(entry.category ?? "").trim() || undefined,
    }))
    .filter((entry) => entry.keyword.length > 0 && Number(entry.weight ?? 0) > 0);
}

async function readLatestRelevantPayload(): Promise<{ payload: RelevantPayload; filePath: string }> {
  await ensureCoreDatasetFresh({ removeLegacySnapshots: true });
  const filePath = repoPath("keywords", "outputs", CORE_DATASET_FILE);
  const raw = await fs.readFile(filePath, "utf-8");
  const parsed = JSON.parse(raw) as RelevantPayload;
  return { payload: parsed, filePath };
}

function isSafeDatasetName(name: string): boolean {
  return name === CORE_DATASET_FILE;
}

async function readRelevantPayloadByDataset(datasetIdRaw: string | null): Promise<{ payload: RelevantPayload; filePath: string }> {
  await ensureCoreDatasetFresh({ removeLegacySnapshots: true });
  const outputsDir = repoPath("keywords", "outputs");
  const datasetId = (datasetIdRaw ?? "").trim();

  if (datasetId.length > 0) {
    if (!isSafeDatasetName(datasetId)) {
      throw new Error("Invalid dataset id.");
    }
    const filePath = path.join(outputsDir, datasetId);
    const raw = await fs.readFile(filePath, "utf-8");
    return { payload: JSON.parse(raw) as RelevantPayload, filePath };
  }

  const mergedPath = path.join(outputsDir, CORE_DATASET_FILE);
  try {
    const raw = await fs.readFile(mergedPath, "utf-8");
    return { payload: JSON.parse(raw) as RelevantPayload, filePath: mergedPath };
  } catch {
    return readLatestRelevantPayload();
  }
}

function countOccurrences(text: string, phrase: string): number {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`\\b${escaped}\\b`, "gi");
  const matches = text.match(regex);
  return matches ? matches.length : 0;
}

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const cvIdRaw = (url.searchParams.get("cvId") ?? "").trim();
  const datasetId = (url.searchParams.get("dataset") ?? "").trim() || null;
  const roleFilterRaw = normalizeToken(url.searchParams.get("role") ?? "");
  if (!cvIdRaw) {
    return NextResponse.json({ error: "cvId is required." }, { status: 400 });
  }

  const parsedId = parseCvVariantId(cvIdRaw);
  const englishCvId = parsedId
    ? buildCvVariantId({ ...parsedId, language: "en" })
    : cvIdRaw;

  const englishCv = await readCv(englishCvId);
  if (!englishCv) {
    return NextResponse.json(
      { error: `English CV variant not found: ${englishCvId}` },
      { status: 404 },
    );
  }

  let payload: RelevantPayload;
  let filePath: string;
  try {
    const resolved = await readRelevantPayloadByDataset(datasetId);
    payload = resolved.payload;
    filePath = resolved.filePath;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load keyword dataset." },
      { status: 400 },
    );
  }
  const allItems = Array.isArray(payload.items) ? payload.items : [];
  const docsTotal = allItems.length;
  const roleBuckets = new Map<string, { count: number; scoreSum: number }>();

  for (const item of allItems) {
    const roles = new Set(
      (Array.isArray(item.role_hits) ? item.role_hits : [])
        .map((value) => normalizeToken(String(value || "")))
        .filter(Boolean),
    );
    const signal = Number(item.score ?? 0);
    for (const role of roles) {
      const bucket = roleBuckets.get(role) ?? { count: 0, scoreSum: 0 };
      bucket.count += 1;
      bucket.scoreSum += signal;
      roleBuckets.set(role, bucket);
    }
  }

  const availableRoles: RoleMetric[] = [...roleBuckets.entries()]
    .map(([role, bucket]) => ({
      role,
      docCount: bucket.count,
      avgSignal: bucket.count > 0 ? bucket.scoreSum / bucket.count : 0,
    }))
    .sort((a, b) => b.docCount - a.docCount || b.avgSignal - a.avgSignal);

  const selectedRole = roleFilterRaw && availableRoles.some((entry) => entry.role === roleFilterRaw)
    ? roleFilterRaw
    : "all";

  const items = selectedRole === "all"
    ? allItems
    : allItems.filter((item) =>
      (Array.isArray(item.role_hits) ? item.role_hits : [])
        .map((value) => normalizeToken(String(value || "")))
        .includes(selectedRole),
    );

  const docs = items.length;
  if (docs === 0) {
    return NextResponse.json(
      { error: selectedRole === "all" ? "No relevant JD items available in latest output file." : `No JD items found for role: ${selectedRole}` },
      { status: 400 },
    );
  }

  const docFreq = new Map<string, number>();
  const scoreSums = new Map<string, number>();

  for (const item of items) {
    const unique = new Set(
      (Array.isArray(item.matched_keywords) ? item.matched_keywords : [])
        .map((value) => String(value || "").trim().toLowerCase())
        .filter(Boolean),
    );
    const signal = Number(item.score ?? 0);
    for (const keyword of unique) {
      docFreq.set(keyword, (docFreq.get(keyword) ?? 0) + 1);
      scoreSums.set(keyword, (scoreSums.get(keyword) ?? 0) + signal);
    }
  }

  const cvText = flattenCvText(englishCv).join("\n").toLowerCase();
  const keywords: KeywordMetric[] = [];
  const keywordLookup = new Map<string, KeywordMetric>();
  const seniorityAspect = inferSeniorityAspect(availableRoles, cvText);
  const gameIndustryAspect = inferGameIndustryAspect(items, availableRoles, cvText);
  let maxWeight = 0;

  for (const [keyword, df] of docFreq.entries()) {
    const idf = Math.log((1 + docs) / (1 + df)) + 1;
    const avgSignal = (scoreSums.get(keyword) ?? 0) / Math.max(1, df);
    const weight = df * idf * (1 + avgSignal / 50);
    if (weight > maxWeight) maxWeight = weight;
    const metric: KeywordMetric = {
      keyword,
      docFreq: df,
      idf,
      avgSignal,
      weight,
      normalized: 0,
      band: "grey",
      cvHits: countOccurrences(cvText, keyword),
      cvCoverage: 0,
      targetHits: 1,
      usageRatio: 0,
      status: "missing",
      recommendation: "",
      source: "jd",
    };
    keywords.push(metric);
    keywordLookup.set(keyword, metric);
  }

  const [seniorDb, gameDb] = await Promise.all([
    readSupplementalDb("keyword_db_senior_leadership.json"),
    readSupplementalDb("keyword_db_game_generic.json"),
  ]);
  const seniorEntries = normalizedSupplementalEntries(seniorDb);
  const gameEntries = normalizedSupplementalEntries(gameDb);
  const seniorKeywordSet = new Set(seniorEntries.map((entry) => entry.keyword));
  const activeDatabases: string[] = [];

  if (seniorityAspect) {
    for (const entry of seniorEntries) {
      const existing = keywordLookup.get(entry.keyword);
      const targetHits = Math.max(1, Number(entry.target_hits ?? 1));
      const docsFactor = Math.max(1, Math.log(1 + docs));
      const supplementalWeight = (Number(entry.weight ?? 1) * (1 + (docsFactor / 2)));
      if (existing) {
        existing.weight = Math.max(existing.weight, supplementalWeight);
        existing.docFreq = Math.max(existing.docFreq, 2);
        existing.targetHits = Math.max(existing.targetHits, targetHits);
        existing.source = existing.source === "jd" ? "combined" : existing.source;
        if (entry.category && !existing.category) existing.category = entry.category;
      } else {
        const metric: KeywordMetric = {
          keyword: entry.keyword,
          docFreq: 2,
          idf: 1,
          avgSignal: 0,
          weight: supplementalWeight,
          normalized: 0,
          band: "grey",
          cvHits: countOccurrences(cvText, entry.keyword),
          cvCoverage: 0,
          targetHits,
          usageRatio: 0,
          status: "missing",
          recommendation: "",
          source: "senior_leadership",
          category: entry.category,
        };
        keywords.push(metric);
        keywordLookup.set(entry.keyword, metric);
      }
      if (supplementalWeight > maxWeight) maxWeight = supplementalWeight;
    }
    if (seniorEntries.length > 0) activeDatabases.push(seniorDb?.label ?? "Senior Leadership Universal");
  }

  if (gameIndustryAspect) {
    for (const entry of gameEntries) {
      const existing = keywordLookup.get(entry.keyword);
      const targetHits = Math.max(1, Number(entry.target_hits ?? 1));
      const docsFactor = Math.max(1, Math.log(1 + docs));
      const supplementalWeight = (Number(entry.weight ?? 1) * (1 + (docsFactor / 2)));
      if (existing) {
        existing.weight = Math.max(existing.weight, supplementalWeight);
        existing.docFreq = Math.max(existing.docFreq, 2);
        existing.targetHits = Math.max(existing.targetHits, targetHits);
        existing.source = existing.source === "jd" || existing.source === "senior_leadership" ? "combined" : existing.source;
        if (entry.category && !existing.category) existing.category = entry.category;
      } else {
        const metric: KeywordMetric = {
          keyword: entry.keyword,
          docFreq: 2,
          idf: 1,
          avgSignal: 0,
          weight: supplementalWeight,
          normalized: 0,
          band: "grey",
          cvHits: countOccurrences(cvText, entry.keyword),
          cvCoverage: 0,
          targetHits,
          usageRatio: 0,
          status: "missing",
          recommendation: "",
          source: "game_generic",
          category: entry.category,
        };
        keywords.push(metric);
        keywordLookup.set(entry.keyword, metric);
      }
      if (supplementalWeight > maxWeight) maxWeight = supplementalWeight;
    }
    if (gameEntries.length > 0) activeDatabases.push(gameDb?.label ?? "Game Industry Generic");
  }

  for (const metric of keywords) {
    const normalized = maxWeight > 0 ? metric.weight / maxWeight : 0;
    metric.normalized = normalized;
    metric.band = slugBand(normalized);
    const targetHits = Math.max(calcTargetHits(metric.docFreq), Number(metric.targetHits ?? 1));
    const usageRatio = Math.min(1, metric.cvHits / targetHits);
    let status: KeywordMetric["status"] = "used";
    if (metric.cvHits === 0) {
      status = "missing";
    } else if (usageRatio < 1) {
      status = "underused";
    }
    metric.targetHits = targetHits;
    metric.usageRatio = usageRatio;
    metric.status = status;
    metric.recommendation = recommendForStatus(metric.keyword, status);
    metric.cvCoverage = usageRatio;
  }

  const sortedKeywords = keywords.sort((a, b) => b.weight - a.weight).slice(0, 180);
  const missingKeywords = sortedKeywords.filter((item) => item.status === "missing");
  const underusedKeywords = sortedKeywords.filter((item) => item.status === "underused");
  const usedKeywords = sortedKeywords.filter((item) => item.status === "used");
  const totalWeight = sortedKeywords.reduce((sum, item) => sum + item.weight, 0);
  const usedWeight = sortedKeywords.reduce((sum, item) => sum + (item.weight * item.usageRatio), 0);
  const weightedUsageScore = totalWeight > 0 ? (usedWeight / totalWeight) * 100 : 0;
  const missingWeightShare = totalWeight > 0
    ? (missingKeywords.reduce((sum, item) => sum + item.weight, 0) / totalWeight) * 100
    : 0;
  const underusedWeightShare = totalWeight > 0
    ? (underusedKeywords.reduce((sum, item) => sum + item.weight, 0) / totalWeight) * 100
    : 0;

  const clusterBuckets = new Map<string, { totalWeight: number; weightedCoverage: number; count: number }>();
  for (const metric of sortedKeywords) {
    const cluster = clusterForKeyword(metric.keyword);
    const bucket = clusterBuckets.get(cluster) ?? { totalWeight: 0, weightedCoverage: 0, count: 0 };
    bucket.totalWeight += metric.weight;
    bucket.weightedCoverage += metric.weight * metric.cvCoverage;
    bucket.count += 1;
    clusterBuckets.set(cluster, bucket);
  }

  let maxClusterWeight = 0;
  for (const bucket of clusterBuckets.values()) {
    if (bucket.totalWeight > maxClusterWeight) {
      maxClusterWeight = bucket.totalWeight;
    }
  }

  const clusters: ClusterMetric[] = [...clusterBuckets.entries()]
    .map(([cluster, bucket]) => ({
      cluster,
      totalWeight: bucket.totalWeight,
      normalized: maxClusterWeight > 0 ? bucket.totalWeight / maxClusterWeight : 0,
      keywordCount: bucket.count,
      cvCoverage: bucket.totalWeight > 0 ? bucket.weightedCoverage / bucket.totalWeight : 0,
    }))
    .sort((a, b) => b.totalWeight - a.totalWeight);

  const seniorityKeywords = seniorEntries
    .map((entry): KeywordMetric => {
      const fromMain = keywordLookup.get(entry.keyword);
      if (fromMain) {
        return fromMain;
      }
      const targetHits = Math.max(1, Number(entry.target_hits ?? 1));
      const cvHits = countOccurrences(cvText, entry.keyword);
      const usageRatio = Math.min(1, cvHits / targetHits);
      const status: KeywordMetric["status"] = cvHits === 0 ? "missing" : usageRatio < 1 ? "underused" : "used";
      const weight = Number(entry.weight ?? 1);
      const normalized = maxWeight > 0 ? weight / maxWeight : 0;
      return {
        keyword: entry.keyword,
        docFreq: 1,
        idf: 1,
        avgSignal: 0,
        weight,
        normalized,
        band: slugBand(normalized),
        cvHits,
        cvCoverage: usageRatio,
        targetHits,
        usageRatio,
        status,
        recommendation: recommendForStatus(entry.keyword, status),
        source: "senior_leadership",
        category: entry.category,
      };
    })
    .sort((a, b) => b.weight - a.weight || a.keyword.localeCompare(b.keyword));

  return NextResponse.json({
    ok: true,
    cvId: cvIdRaw,
    englishCvId,
    sourceFile: filePath,
    datasetId: path.basename(filePath),
    role: selectedRole,
    roles: [
      { role: "all", label: "All Professions", docCount: docsTotal, avgSignal: 0 },
      ...availableRoles.map((entry) => ({
        role: entry.role,
        label: titleCase(entry.role),
        docCount: entry.docCount,
        avgSignal: Number(entry.avgSignal.toFixed(2)),
      })),
    ],
    keywordDatabases: {
      seniorityAspect,
      gameIndustryAspect,
      active: activeDatabases,
    },
    generatedAt: payload.generated_at ?? new Date().toISOString(),
    jdRelevantCount: docs,
    clusterCount: clusters.length,
    clusters,
    keywords: sortedKeywords,
    seniorityKeywords,
    keywordSummary: {
      total: sortedKeywords.length,
      missing: missingKeywords.length,
      underused: underusedKeywords.length,
      used: usedKeywords.length,
    },
    analysisStats: {
      weightedUsageScore: Number(weightedUsageScore.toFixed(2)),
      missingWeightShare: Number(missingWeightShare.toFixed(2)),
      underusedWeightShare: Number(underusedWeightShare.toFixed(2)),
      totalKeywordWeight: Number(totalWeight.toFixed(2)),
    },
    missingKeywords: missingKeywords.slice(0, 30),
    underusedKeywords: underusedKeywords.slice(0, 30),
    usedKeywords: usedKeywords.slice(0, 30),
    supplementalKeywordSummary: {
      seniorityTotal: seniorEntries.length,
      seniorityPresentInRanking: sortedKeywords.filter((item) => seniorKeywordSet.has(item.keyword)).length,
      gameGenericTotal: gameEntries.length,
    },
    cv: englishCv,
  });
}
