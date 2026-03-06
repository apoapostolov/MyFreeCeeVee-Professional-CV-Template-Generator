"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import type { JSX, KeyboardEvent, UIEvent } from "react";
import { parse as parseYaml, parseDocument, stringify as stringifyYaml } from "yaml";

type CvListResponse = {
  items: Array<{
    id: string;
    language: string | null;
    iteration: string | null;
    target: string | null;
    displayName: string;
    displayVersion: string;
    git?: {
      lastCommitAt: string | null;
    };
  }>;
};

type TemplateListResponse = {
  items: Array<{
    id: string;
    name: string;
    status: string;
    version: string;
  }>;
};

type OpenRouterSettingsResponse = {
  hasApiKey: boolean;
  apiKeyMasked: string;
  model: string;
  baseUrl: string;
  updatedAt: string;
  models?: Array<{
    id: string;
    name: string;
    contextLength: number | null;
    promptPricePer1M: number | null;
    completionPricePer1M: number | null;
    mixedPricePer1M: number | null;
    isFree: boolean;
  }>;
  modelsFetchedAt?: string;
  modelsFromCache?: boolean;
};

type OpenRouterCreditResponse = {
  available: boolean;
  remainingUsd: number | null;
  usageUsd: number | null;
  limitUsd: number | null;
  isFreeTier: boolean;
  label: string;
  checkedAt: string;
};

type SyncChangeItem = {
  path: string;
  direction: "BG > EN" | "BG < EN";
  sourceLanguage: "bg" | "en";
  targetLanguage: "bg" | "en";
  sourceValue: unknown;
  previousTargetValue: unknown;
  nextTargetValue: unknown;
};

type SyncResponse = {
  error?: string;
  changed?: boolean;
  message?: string;
  sourceCvId?: string;
  targetCvId?: string;
  direction?: "BG > EN" | "BG < EN";
  changes?: SyncChangeItem[];
  changedFields?: number;
};

type SyncStatusResponse = {
  ok: boolean;
  sourceCvId: string;
  targetCvId: string;
  sourceLanguage: "bg" | "en";
  targetLanguage: "bg" | "en";
  sourceLastEditedAt: string;
  targetLastEditedAt: string;
  timestampsDiffer: boolean;
  hasMissingFields: boolean;
  missingFieldCount: number;
  missingFieldPaths: string[];
  canSync: boolean;
};

type ActivePanel = "workspace" | "templates" | "editor" | "keywords";
type EditorViewMode = "form" | "yaml";
type ThemeMode = "light" | "dark" | "system";

type KeywordSource = "jd" | "senior_leadership" | "game_generic" | "combined";

type KeywordTagMetric = {
  keyword: string;
  normalized: number;
  band: KeywordBand;
  weight: number;
  status: "missing" | "underused" | "used";
  cvHits: number;
  targetHits: number;
  recommendation: string;
  usageRatio: number;
  source?: KeywordSource;
  category?: string;
};

type EditorTabKey =
  | "person"
  | "positioning"
  | "experience"
  | "education"
  | "skills"
  | "references"
  | "optional"
  | "metadata";

type PathSegment = string | number;

type CvPair = {
  key: string;
  displayName: string;
  displayVersion: string;
  bg: CvListResponse["items"][number] | null;
  en: CvListResponse["items"][number] | null;
  latestTs: number;
};

type FieldCopy = {
  label: string;
  description: string;
  requirement?: string;
};

type FieldMeta = {
  en: FieldCopy;
  bg: FieldCopy;
};

type SectionFieldFeedback = {
  field?: string;
  score?: number;
  analysis?: string;
  proposal?: string;
};

type SectionAnalysis = {
  scope?: "section";
  section?: string;
  score?: number;
  summary?: string;
  field_feedback?: SectionFieldFeedback[];
  top_actions?: string[];
};

type FullSectionScore = {
  section?: string;
  score?: number;
  strengths?: string[];
  issues?: string[];
  improvements?: string[];
};

type FullAnalysis = {
  scope?: "full";
  overall_score?: number;
  summary?: string;
  section_scores?: FullSectionScore[];
  top_actions?: string[];
};

type KeywordBand = "grey" | "green" | "yellow" | "orange" | "red";

type KeywordStudioResponse = {
  ok?: boolean;
  error?: string;
  englishCvId?: string;
  datasetId?: string;
  sourceFile?: string;
  generatedAt?: string;
  jdRelevantCount?: number;
  clusterCount?: number;
  clusters?: Array<{
    cluster: string;
    totalWeight: number;
    normalized: number;
    keywordCount: number;
    cvCoverage: number;
  }>;
  roles?: Array<{
    role: string;
    label: string;
    docCount: number;
    avgSignal: number;
  }>;
  role?: string;
  keywordSummary?: {
    total: number;
    missing: number;
    underused: number;
    used: number;
  };
  analysisStats?: {
    weightedUsageScore: number;
    missingWeightShare: number;
    underusedWeightShare: number;
    totalKeywordWeight: number;
  };
  keywords?: Array<{
    keyword: string;
    docFreq: number;
    idf: number;
    avgSignal: number;
    weight: number;
    normalized: number;
    band: KeywordBand;
    cvHits: number;
    cvCoverage: number;
    targetHits: number;
    usageRatio: number;
    status: "missing" | "underused" | "used";
    recommendation: string;
    source?: "jd" | "senior_leadership" | "game_generic" | "combined";
    category?: string;
  }>;
  seniorityKeywords?: Array<{
    keyword: string;
    weight: number;
    normalized: number;
    band: KeywordBand;
    cvHits: number;
    targetHits: number;
    usageRatio: number;
    status: "missing" | "underused" | "used";
    recommendation: string;
    source?: "jd" | "senior_leadership" | "game_generic" | "combined";
    category?: string;
  }>;
  missingKeywords?: Array<{
    keyword: string;
    weight: number;
    cvHits: number;
    targetHits: number;
    recommendation: string;
  }>;
  underusedKeywords?: Array<{
    keyword: string;
    weight: number;
    cvHits: number;
    targetHits: number;
    recommendation: string;
  }>;
  usedKeywords?: Array<{
    keyword: string;
    weight: number;
    cvHits: number;
    targetHits: number;
    recommendation: string;
  }>;
  keywordDatabases?: {
    seniorityAspect: boolean;
    gameIndustryAspect: boolean;
    active: string[];
  };
  supplementalKeywordSummary?: {
    seniorityTotal: number;
    seniorityPresentInRanking: number;
    gameGenericTotal: number;
  };
  cv?: Record<string, unknown>;
};

type KeywordManageStatsResponse = {
  ok?: boolean;
  stats?: {
    profilesScanned: {
      today: number;
      week: number;
      total: number;
    };
    coreDatasetProfiles: number;
    keywordsIdentified: number;
    cacheDbPath: string;
  };
  run?: {
    runId: string;
    state: "queued" | "scraping" | "merging" | "completed" | "failed";
    phase: string;
    startedAt: string;
    updatedAt: string;
    completedAt: string | null;
    error: string | null;
    mergedItems: number | null;
    sourceFiles: number | null;
    logs: string[];
  } | null;
  activeRunId?: string | null;
  started?: boolean;
  alreadyRunning?: boolean;
  note?: string;
  error?: string;
};

type KeywordDatasetListResponse = {
  ok?: boolean;
  defaultDatasetId?: string | null;
  datasets?: Array<{
    id: string;
    label: string;
    fileName: string;
    generatedAt: string | null;
    itemCount: number;
    provider: string | null;
    kind?: "core";
  }>;
};

type TemplateThemeOption = {
  id: string;
  label: string;
  color: string;
};

const EDINBURGH_THEME_OPTIONS: TemplateThemeOption[] = [
  { id: "default", label: "Default Purple", color: "#4E557B" },
  { id: "ocean_teal", label: "Ocean Teal", color: "#068799" },
  { id: "forest_green", label: "Forest Green", color: "#316834" },
  { id: "ruby_red", label: "Ruby Red", color: "#b0292a" },
  { id: "amber_gold", label: "Amber Gold", color: "#ffc209" },
];

const EDITOR_TABS: Array<{ key: EditorTabKey; label: string; path: string }> = [
  { key: "person", label: "Person", path: "person" },
  { key: "positioning", label: "Positioning", path: "positioning" },
  { key: "experience", label: "Experience", path: "experience" },
  { key: "education", label: "Education", path: "education" },
  { key: "skills", label: "Skills", path: "skills" },
  { key: "references", label: "References", path: "references" },
  { key: "optional", label: "Optional", path: "optional_sections" },
  { key: "metadata", label: "Metadata", path: "metadata" },
];

const FIELD_META: Record<string, FieldMeta> = {
  "person.full_name": {
    en: { label: "Full Name", description: "Official full name for CV header.", requirement: "Required" },
    bg: { label: "Пълно име", description: "Официално пълно име за заглавие на CV.", requirement: "Задължително" },
  },
  "person.birth_date": {
    en: { label: "Birth Date", description: "Use calendar selector in YYYY-MM-DD format." },
    bg: { label: "Дата на раждане", description: "Използвайте календар в формат YYYY-MM-DD." },
  },
  "person.nationality": {
    en: { label: "Nationality", description: "Citizenship or nationality wording." },
    bg: { label: "Националност", description: "Гражданство или националност." },
  },
  "person.residence": {
    en: { label: "Residence", description: "Current residence and postal details." },
    bg: { label: "Местоживеене", description: "Текущ адрес и пощенски детайли." },
  },
  "person.contact": {
    en: { label: "Contact", description: "Public contact channels used in CV." },
    bg: { label: "Контакти", description: "Публични канали за контакт в CV." },
  },
  positioning: {
    en: { label: "Positioning", description: "Headline and strategic profile text." },
    bg: { label: "Позициониране", description: "Заглавие и стратегически профил." },
  },
  "positioning.profile_summary": {
    en: { label: "Profile Summary", description: "Core 1-2 sentence professional summary." },
    bg: { label: "Профил", description: "Кратко професионално резюме в 1-2 изречения." },
  },
  experience: {
    en: { label: "Experience", description: "Professional roles with responsibilities and outputs." },
    bg: { label: "Опит", description: "Професионални позиции с отговорности и резултати." },
  },
  "experience[].start_date": {
    en: { label: "Start Date", description: "Role start date." },
    bg: { label: "Начална дата", description: "Начална дата на позицията." },
  },
  "experience[].end_date": {
    en: { label: "End Date", description: "Role end date, leave empty if current." },
    bg: { label: "Крайна дата", description: "Крайна дата; оставете празно ако е текуща." },
  },
  "experience[].responsibilities": {
    en: { label: "Responsibilities", description: "Action-oriented bullet list." },
    bg: { label: "Отговорности", description: "Списък с действия и принос." },
  },
  education: {
    en: { label: "Education", description: "Degrees, institutions, and subjects." },
    bg: { label: "Образование", description: "Степени, институции и предмети." },
  },
  skills: {
    en: { label: "Skills", description: "Language, technical, social and core strengths." },
    bg: { label: "Умения", description: "Езици, технически, социални и ключови силни страни." },
  },
  references: {
    en: { label: "References", description: "Referees and contact details." },
    bg: { label: "Препоръки", description: "Лица за препоръка и контакти." },
  },
  optional_sections: {
    en: { label: "Optional Sections", description: "Projects, publications, interests, and extras." },
    bg: { label: "Допълнителни секции", description: "Проекти, публикации, интереси и допълнения." },
  },
  metadata: {
    en: { label: "Metadata", description: "Internal CV naming, versioning, and variant tags." },
    bg: { label: "Метаданни", description: "Вътрешно име, версия и варианти на CV." },
  },
};

function asRecord(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return null;
  }
  return input as Record<string, unknown>;
}

function getByPath(input: unknown, dotPath: string): unknown {
  return dotPath.split(".").reduce<unknown>((cursor, segment) => {
    if (cursor === null || cursor === undefined) {
      return undefined;
    }
    if (Array.isArray(cursor)) {
      const index = Number(segment);
      if (!Number.isInteger(index)) {
        return undefined;
      }
      return cursor[index];
    }
    const record = asRecord(cursor);
    if (!record) {
      return undefined;
    }
    return record[segment];
  }, input);
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeMetaPath(path: string): string {
  return path.replace(/\[\d+\]/g, "[]");
}

function prettyKey(raw: string): string {
  return raw
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (value) => value.toUpperCase());
}

function resolveFieldCopy(path: string, key: string, language: "bg" | "en"): FieldCopy {
  const normalized = normalizeMetaPath(path);
  const meta = FIELD_META[normalized];
  if (meta) {
    return meta[language];
  }
  const label = prettyKey(key);
  return {
    label,
    description:
      language === "bg"
        ? "Редактируемо поле от структурата на CV."
        : "Editable field from the CV structure.",
  };
}

function isDateLike(value: unknown): boolean {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function shouldUseTextarea(value: string): boolean {
  return value.length > 120 || value.includes("\n");
}

function estimateTextareaRows(value: string): number {
  const lines = value.split("\n");
  let rowEstimate = 0;
  for (const line of lines) {
    rowEstimate += Math.max(1, Math.ceil(line.length / 90));
  }
  return Math.max(4, Math.min(16, rowEstimate));
}

function templateDisplayName(raw: string): string {
  return raw.replace(/\s*\((?:Rebuilt|Prototype)\)\s*/gi, " ").replace(/\s{2,}/g, " ").trim();
}

function formatDiffValue(value: unknown): string {
  if (value === undefined) return "(missing)";
  if (value === null) return "null";
  if (typeof value === "string") return value.length > 0 ? value : "(empty string)";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function defaultFromSample(sample: unknown): unknown {
  if (Array.isArray(sample)) {
    return [];
  }
  if (sample && typeof sample === "object") {
    const record = sample as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) {
      if (typeof value === "number") out[key] = 0;
      else if (typeof value === "boolean") out[key] = false;
      else if (Array.isArray(value)) out[key] = [];
      else out[key] = "";
    }
    return out;
  }
  if (typeof sample === "number") return 0;
  if (typeof sample === "boolean") return false;
  return "";
}

function setAtPath(root: unknown, path: PathSegment[], value: unknown): unknown {
  if (path.length === 0) {
    return value;
  }
  const [head, ...tail] = path;
  if (typeof head === "number") {
    const list = Array.isArray(root) ? [...root] : [];
    list[head] = setAtPath(list[head], tail, value);
    return list;
  }
  const record = root && typeof root === "object" && !Array.isArray(root) ? { ...(root as Record<string, unknown>) } : {};
  record[head] = setAtPath(record[head], tail, value);
  return record;
}

function removeAtPath(root: unknown, path: PathSegment[]): unknown {
  if (path.length === 0) return root;
  const [head, ...tail] = path;
  if (tail.length === 0) {
    if (typeof head === "number") {
      const list = Array.isArray(root) ? [...root] : [];
      list.splice(head, 1);
      return list;
    }
    const record = root && typeof root === "object" && !Array.isArray(root) ? { ...(root as Record<string, unknown>) } : {};
    delete record[head];
    return record;
  }
  if (typeof head === "number") {
    const list = Array.isArray(root) ? [...root] : [];
    list[head] = removeAtPath(list[head], tail);
    return list;
  }
  const record = root && typeof root === "object" && !Array.isArray(root) ? { ...(root as Record<string, unknown>) } : {};
  record[head] = removeAtPath(record[head], tail);
  return record;
}

function appendToArrayAtPath(root: unknown, path: PathSegment[], value: unknown): unknown {
  const current = path.reduce<unknown>((cursor, segment) => {
    if (cursor === null || cursor === undefined) return undefined;
    if (typeof segment === "number") {
      return Array.isArray(cursor) ? cursor[segment] : undefined;
    }
    return asRecord(cursor)?.[segment];
  }, root);
  const list = Array.isArray(current) ? [...current, value] : [value];
  return setAtPath(root, path, list);
}

function setByPath(input: Record<string, unknown>, dotPath: string, value: unknown): Record<string, unknown> {
  const segments = dotPath.split(".").filter((part) => part.length > 0);
  return setAtPath(input, segments, value) as Record<string, unknown>;
}

export function ComposerClient() {
  const [activePanel, setActivePanel] = useState<ActivePanel>("workspace");
  const [themeMode, setThemeMode] = useState<ThemeMode>("system");

  const [cvItems, setCvItems] = useState<CvListResponse["items"]>([]);
  const [templateItems, setTemplateItems] = useState<TemplateListResponse["items"]>([]);
  const [selectedCvId, setSelectedCvId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedTemplateTheme, setSelectedTemplateTheme] = useState("default");
  const [previewNonce, setPreviewNonce] = useState(Date.now());
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<"bg" | "en">("bg");

  const [editorTab, setEditorTab] = useState<EditorTabKey>("person");
  const [editorView, setEditorView] = useState<EditorViewMode>("form");
  const [editorCv, setEditorCv] = useState<Record<string, unknown> | null>(null);
  const [sectionDraft, setSectionDraft] = useState<unknown>(null);
  const [yamlDraft, setYamlDraft] = useState("");
  const [yamlLintIssues, setYamlLintIssues] = useState<string[]>([]);
  const [editorLoading, setEditorLoading] = useState(false);
  const [editorSaving, setEditorSaving] = useState(false);
  const [editorNotice, setEditorNotice] = useState("");
  const yamlTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const yamlHighlightRef = useRef<HTMLDivElement | null>(null);

  const [settings, setSettings] = useState<OpenRouterSettingsResponse | null>(null);
  const [showAiSettings, setShowAiSettings] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsNotice, setSettingsNotice] = useState("");
  const [creditStatus, setCreditStatus] = useState<OpenRouterCreditResponse | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [modelInput, setModelInput] = useState("openai/gpt-4o-mini");
  const [baseUrlInput, setBaseUrlInput] = useState("https://openrouter.ai/api/v1/chat/completions");
  const [modelOptions, setModelOptions] = useState<
    Array<{
      id: string;
      name: string;
      contextLength: number | null;
      promptPricePer1M: number | null;
      completionPricePer1M: number | null;
      mixedPricePer1M: number | null;
      isFree: boolean;
    }>
  >([]);

  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisText, setAnalysisText] = useState("");
  const [analysisData, setAnalysisData] = useState<SectionAnalysis | FullAnalysis | null>(null);
  const [keywordDatasets, setKeywordDatasets] = useState<KeywordDatasetListResponse["datasets"]>([]);
  const [selectedKeywordDataset, setSelectedKeywordDataset] = useState("");
  const [selectedKeywordRole, setSelectedKeywordRole] = useState("all");
  const [keywordDatasetLoading, setKeywordDatasetLoading] = useState(false);
  const [keywordStudioLoading, setKeywordStudioLoading] = useState(false);
  const [keywordStudioError, setKeywordStudioError] = useState("");
  const [keywordStudioData, setKeywordStudioData] = useState<KeywordStudioResponse | null>(null);
  const [keywordManageStats, setKeywordManageStats] = useState<KeywordManageStatsResponse["stats"] | null>(null);
  const [keywordManageBusy, setKeywordManageBusy] = useState(false);
  const [keywordManageNotice, setKeywordManageNotice] = useState("");
  const [keywordRunStatus, setKeywordRunStatus] = useState<KeywordManageStatsResponse["run"] | null>(null);
  const [keywordRunModalOpen, setKeywordRunModalOpen] = useState(false);
  const [showSeniorityPriorityTags, setShowSeniorityPriorityTags] = useState(true);
  const [showHardPriorityTags, setShowHardPriorityTags] = useState(true);
  const [showSoftPriorityTags, setShowSoftPriorityTags] = useState(true);
  const [keywordHover, setKeywordHover] = useState<{
    label: string;
    metric: KeywordTagMetric;
    left: number;
    top: number;
  } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatusResponse | null>(null);
  const [syncReport, setSyncReport] = useState<{
    open: boolean;
    direction: "BG > EN" | "BG < EN";
    sourceCvId: string;
    targetCvId: string;
    changed: boolean;
    changes: SyncChangeItem[];
    message: string;
  } | null>(null);

  const resolvedTheme = useMemo<"light" | "dark">(() => {
    if (themeMode === "light" || themeMode === "dark") {
      return themeMode;
    }
    if (typeof window === "undefined") {
      return "light";
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }, [themeMode]);

  const editorPath = useMemo(
    () => EDITOR_TABS.find((item) => item.key === editorTab)?.path ?? "person",
    [editorTab],
  );

  const mostRecentCv = useMemo(() => {
    if (!cvItems.length) return null;
    return [...cvItems].sort((a, b) => {
      const aTs = a.git?.lastCommitAt ? Date.parse(a.git.lastCommitAt) : 0;
      const bTs = b.git?.lastCommitAt ? Date.parse(b.git.lastCommitAt) : 0;
      if (aTs !== bTs) return bTs - aTs;
      return b.id.localeCompare(a.id);
    })[0] ?? null;
  }, [cvItems]);

  const cvSizeTokenEstimate = useMemo(() => {
    if (!editorCv) return 2200;
    const chars = JSON.stringify(editorCv).length;
    return Math.max(1200, Math.round(chars / 4));
  }, [editorCv]);

  const fullCvOutputTokenEstimate = useMemo(
    () => Math.max(900, Math.min(2600, Math.round(cvSizeTokenEstimate * 0.35))),
    [cvSizeTokenEstimate],
  );

  const keywordMatcher = useMemo(() => {
    type KeywordMapEntry = {
      keyword: string;
      normalized: number;
      band: KeywordBand;
      weight: number;
      status: "missing" | "underused" | "used";
      cvHits: number;
      targetHits: number;
      recommendation: string;
      usageRatio: number;
      source?: "jd" | "senior_leadership" | "game_generic" | "combined";
      category?: string;
    };
    const tokenIndex = new Map<string, KeywordMapEntry>();
    const phraseIndex = new Map<string, KeywordMapEntry>();
    let maxPhraseWords = 1;

    for (const item of keywordStudioData?.keywords ?? []) {
      const normalizedTokens = item.keyword
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 3);
      if (normalizedTokens.length === 0) {
        continue;
      }

      const phrase = normalizedTokens.join(" ");
      const existingPhrase = phraseIndex.get(phrase);
      if (!existingPhrase || item.weight > existingPhrase.weight) {
        phraseIndex.set(phrase, {
          keyword: item.keyword,
          normalized: item.normalized,
          band: item.band,
          weight: item.weight,
          status: item.status,
          cvHits: item.cvHits,
          targetHits: item.targetHits,
          recommendation: item.recommendation,
          usageRatio: item.usageRatio,
          source: item.source,
          category: item.category,
        });
      }

      maxPhraseWords = Math.max(maxPhraseWords, normalizedTokens.length);

      for (const token of normalizedTokens) {
        const existing = tokenIndex.get(token);
        if (!existing || item.weight > existing.weight) {
          tokenIndex.set(token, {
            keyword: item.keyword,
            normalized: item.normalized,
            band: item.band,
            weight: item.weight,
            status: item.status,
            cvHits: item.cvHits,
            targetHits: item.targetHits,
            recommendation: item.recommendation,
            usageRatio: item.usageRatio,
            source: item.source,
            category: item.category,
          });
        }
      }
    }

    return {
      tokenIndex,
      phraseIndex,
      maxPhraseWords: Math.max(1, Math.min(maxPhraseWords, 5)),
    };
  }, [keywordStudioData?.keywords]);

  function formatUsd(value: number): string {
    return `$${value.toFixed(2)}`;
  }

  function ThemeSunIcon(): JSX.Element {
    return (
      <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="4" fill="currentColor" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
      </svg>
    );
  }

  function ThemeMoonIcon(): JSX.Element {
    return (
      <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.7" />
        <path d="M12 4a8 8 0 1 0 0 16a6 8 0 1 1 0-16z" fill="currentColor" opacity="0.85" />
      </svg>
    );
  }

  function ThemeSystemIcon(): JSX.Element {
    return (
      <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24">
        <rect x="3.5" y="4.5" width="17" height="12" rx="1.8" fill="none" stroke="currentColor" strokeWidth="1.7" />
        <path d="M9 19h6M11 16.5v2.5M13 16.5v2.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
      </svg>
    );
  }

  function modelOptionLabel(model: {
    id: string;
    name: string;
    mixedPricePer1M: number | null;
    promptPricePer1M: number | null;
    completionPricePer1M: number | null;
    isFree: boolean;
  }): string {
    const mixed = model.mixedPricePer1M ?? model.promptPricePer1M ?? model.completionPricePer1M;
    const overhead = 1.2;
    const inputTokensWithOverhead = cvSizeTokenEstimate * overhead;
    const outputTokensWithOverhead = fullCvOutputTokenEstimate * overhead;
    const promptPrice = model.promptPricePer1M ?? mixed;
    const completionPrice = model.completionPricePer1M ?? mixed;
    const estimatedCost =
      promptPrice !== null && completionPrice !== null
        ? (inputTokensWithOverhead / 1_000_000) * promptPrice + (outputTokensWithOverhead / 1_000_000) * completionPrice
        : null;
    const labelName = model.name || model.id;
    const mixedLabel = model.isFree ? "FREE" : mixed !== null ? `avg ${formatUsd(mixed)}/1M` : "avg N/A";
    const estimatedLabel = model.isFree ? "est $0.00/check" : estimatedCost !== null ? `est ${formatUsd(estimatedCost)}/check` : "est N/A";
    return `${labelName}${model.isFree ? " FREE" : ""} • ${mixedLabel} • ${estimatedLabel}`;
  }

  const orderedTemplateItems = useMemo(() => {
    const priority = (id: string): number => {
      if (id === "europass-v1") return 0;
      if (id === "edinburgh-v1") return 1;
      return 2;
    };
    return [...templateItems].sort((a, b) => {
      const p = priority(a.id) - priority(b.id);
      if (p !== 0) return p;
      return a.name.localeCompare(b.name);
    });
  }, [templateItems]);

  const cvPairs = useMemo<CvPair[]>(() => {
    const pairs = new Map<string, CvPair>();
    for (const item of cvItems) {
      const key = item.iteration && item.target ? `${item.iteration}::${item.target}` : item.id;
      const ts = item.git?.lastCommitAt ? Date.parse(item.git.lastCommitAt) : 0;
      const existing = pairs.get(key);

      if (!existing) {
        pairs.set(key, {
          key,
          displayName: item.displayName,
          displayVersion: item.displayVersion,
          bg: item.language === "bg" ? item : null,
          en: item.language === "en" ? item : null,
          latestTs: ts,
        });
        continue;
      }

      if (item.language === "bg") {
        existing.bg = item;
        existing.displayName = item.displayName;
        existing.displayVersion = item.displayVersion;
      } else if (item.language === "en") {
        existing.en = item;
      }
      existing.latestTs = Math.max(existing.latestTs, ts);
    }

    return [...pairs.values()].sort((a, b) => {
      if (a.latestTs !== b.latestTs) return b.latestTs - a.latestTs;
      return a.key.localeCompare(b.key);
    });
  }, [cvItems]);

  const pdfUrl = useMemo(() => {
    if (!selectedCvId || !selectedTemplateId) {
      return "";
    }
    const params = new URLSearchParams({
      cvId: selectedCvId,
      templateId: selectedTemplateId,
      v: String(previewNonce),
    });
    if (selectedTemplateId === "edinburgh-v1") {
      params.set("theme", selectedTemplateTheme);
    }
    return `/api/export/pdf?${params.toString()}`;
  }, [previewNonce, selectedCvId, selectedTemplateId, selectedTemplateTheme]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("mfcv_theme_mode");
      if (saved === "light" || saved === "dark" || saved === "system") {
        setThemeMode(saved);
      }
    } catch {
      // no-op
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const applyTheme = () => {
      const mode = themeMode === "system"
        ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
        : themeMode;
      root.setAttribute("data-theme", mode);
    };
    applyTheme();
    try {
      window.localStorage.setItem("mfcv_theme_mode", themeMode);
    } catch {
      // no-op
    }

    if (themeMode !== "system") {
      return;
    }
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme();
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, [themeMode]);

  useEffect(() => {
    let cancelled = false;
    async function loadWorkspaceData() {
      setLoadingWorkspace(true);
      try {
        const [cvsRes, templatesRes] = await Promise.all([fetch("/api/cvs"), fetch("/api/templates")]);
        const cvs = (await cvsRes.json()) as CvListResponse;
        const templates = (await templatesRes.json()) as TemplateListResponse;
        if (cancelled) {
          return;
        }
        setCvItems(cvs.items ?? []);
        setTemplateItems(templates.items ?? []);

        if ((!selectedCvId || !cvs.items?.some((item) => item.id === selectedCvId)) && cvs.items?.length) {
          const first = cvs.items[0];
          setSelectedCvId(first.id);
          setSelectedLanguage(first.language === "en" ? "en" : "bg");
        }

        if (
          (!selectedTemplateId || !templates.items?.some((item) => item.id === selectedTemplateId)) &&
          templates.items?.length
        ) {
          const preferred = templates.items.find((entry) => entry.id === "europass-v1");
          setSelectedTemplateId(preferred?.id ?? templates.items[0].id);
        }
      } finally {
        if (!cancelled) {
          setLoadingWorkspace(false);
        }
      }
    }
    void loadWorkspaceData();
    return () => {
      cancelled = true;
    };
    // Initial load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!keywordRunModalOpen || !keywordRunStatus?.runId) {
      return;
    }
    if (keywordRunStatus.state === "completed" || keywordRunStatus.state === "failed") {
      return;
    }

    let cancelled = false;
    const runId = keywordRunStatus.runId;
    const intervalId = window.setInterval(() => {
      void (async () => {
        try {
          const response = await fetch(`/api/analysis/keywords/manage?runId=${encodeURIComponent(runId)}`);
          const payload = (await response.json()) as KeywordManageStatsResponse;
          if (cancelled) return;
          if (!response.ok || payload.error) {
            return;
          }
          setKeywordManageStats(payload.stats ?? null);
          setKeywordRunStatus(payload.run ?? null);
          if (payload.run?.state === "completed" || payload.run?.state === "failed") {
            setPreviewNonce(Date.now());
          }
        } catch {
          // keep polling; transient failures should not close modal
        }
      })();
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [keywordRunModalOpen, keywordRunStatus?.runId, keywordRunStatus?.state]);

  useEffect(() => {
    let cancelled = false;

    async function loadKeywordManageStats() {
      try {
        const response = await fetch("/api/analysis/keywords/manage");
        const payload = (await response.json()) as KeywordManageStatsResponse;
        if (cancelled) return;
        if (!response.ok || !payload.ok) {
          setKeywordManageStats(null);
          return;
        }
        setKeywordManageStats(payload.stats ?? null);
        setKeywordRunStatus(payload.run ?? null);
      } catch {
        if (!cancelled) {
          setKeywordManageStats(null);
          setKeywordRunStatus(null);
        }
      }
    }

    void loadKeywordManageStats();
    const intervalId = window.setInterval(() => {
      void loadKeywordManageStats();
    }, 30_000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadCreditStatus() {
      try {
        const response = await fetch("/api/settings/openrouter/credit");
        const payload = (await response.json()) as OpenRouterCreditResponse;
        if (!cancelled) {
          setCreditStatus(payload);
        }
      } catch {
        if (!cancelled) {
          setCreditStatus({
            available: false,
            remainingUsd: null,
            usageUsd: null,
            limitUsd: null,
            isFreeTier: false,
            label: "OpenRouter credit: unavailable",
            checkedAt: new Date().toISOString(),
          });
        }
      }
    }

    void loadCreditStatus();
    const intervalId = window.setInterval(() => {
      void loadCreditStatus();
    }, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const selectedCvMeta = useMemo(
    () => cvItems.find((item) => item.id === selectedCvId) ?? null,
    [cvItems, selectedCvId],
  );

  const variantPair = useMemo(() => {
    if (!selectedCvMeta?.target || !selectedCvMeta?.iteration) {
      return null;
    }
    const bgId = `cv_bg_${selectedCvMeta.iteration}_${selectedCvMeta.target}`;
    const enId = `cv_en_${selectedCvMeta.iteration}_${selectedCvMeta.target}`;
    return {
      bg: cvItems.find((item) => item.id === bgId) ?? null,
      en: cvItems.find((item) => item.id === enId) ?? null,
    };
  }, [cvItems, selectedCvMeta?.iteration, selectedCvMeta?.target]);
  const bgVariantId = variantPair?.bg?.id ?? "";
  const enVariantId = variantPair?.en?.id ?? "";

  useEffect(() => {
    let cancelled = false;

    async function loadSyncStatus() {
      if (!selectedCvId || !bgVariantId || !enVariantId) {
        setSyncStatus(null);
        return;
      }
      try {
        const response = await fetch("/api/cvs/sync/status", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            cvId: selectedCvId,
            sourceLanguage: selectedLanguage,
          }),
        });
        const payload = (await response.json()) as SyncStatusResponse & { error?: string };
        if (!cancelled) {
          if (!response.ok || payload.error) {
            setSyncStatus(null);
            return;
          }
          setSyncStatus(payload);
        }
      } catch {
        if (!cancelled) {
          setSyncStatus(null);
        }
      }
    }

    void loadSyncStatus();
    return () => {
      cancelled = true;
    };
  }, [bgVariantId, enVariantId, previewNonce, selectedCvId, selectedLanguage]);

  const selectedPairKey = useMemo(() => {
    if (!selectedCvMeta) return "";
    if (selectedCvMeta.iteration && selectedCvMeta.target) {
      return `${selectedCvMeta.iteration}::${selectedCvMeta.target}`;
    }
    return selectedCvMeta.id;
  }, [selectedCvMeta]);

  useEffect(() => {
    const lang = selectedCvMeta?.language === "en" ? "en" : "bg";
    setSelectedLanguage(lang);
  }, [selectedCvMeta?.id, selectedCvMeta?.language]);

  useEffect(() => {
    let cancelled = false;
    async function loadEditorCv() {
      if (!selectedCvId) {
        setEditorCv(null);
        setSectionDraft(null);
        setYamlDraft("");
        return;
      }
      setEditorLoading(true);
      try {
        const response = await fetch(`/api/cvs/${encodeURIComponent(selectedCvId)}`);
        const payload = (await response.json()) as { cv?: Record<string, unknown> };
        if (cancelled) return;
        const doc = payload.cv ?? null;
        setEditorCv(doc);
      } finally {
        if (!cancelled) {
          setEditorLoading(false);
        }
      }
    }
    void loadEditorCv();
    return () => {
      cancelled = true;
    };
  }, [selectedCvId]);

  useEffect(() => {
    let cancelled = false;

    async function loadKeywordDatasets() {
      setKeywordDatasetLoading(true);
      try {
        const response = await fetch("/api/analysis/keywords/datasets");
        const payload = (await response.json()) as KeywordDatasetListResponse;
        if (cancelled) return;
        const datasets = payload.datasets ?? [];
        setKeywordDatasets(datasets);
        setSelectedKeywordDataset((current) => {
          if (current && datasets.some((item) => item.id === current)) {
            return current;
          }
          return payload.defaultDatasetId ?? datasets[0]?.id ?? "";
        });
      } catch {
        if (!cancelled) {
          setKeywordDatasets([]);
          setSelectedKeywordDataset("");
        }
      } finally {
        if (!cancelled) {
          setKeywordDatasetLoading(false);
        }
      }
    }

    void loadKeywordDatasets();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadKeywordStudio() {
      const englishId = variantPair?.en?.id ?? (selectedCvMeta?.language === "en" ? selectedCvId : "");
      if (!englishId) {
        setKeywordStudioData(null);
        setKeywordStudioError("English CV variant is required for Keyword Studio.");
        return;
      }

      setKeywordStudioLoading(true);
      setKeywordStudioError("");
      try {
        const params = new URLSearchParams({ cvId: englishId });
        if (selectedKeywordDataset) {
          params.set("dataset", selectedKeywordDataset);
        }
        if (selectedKeywordRole && selectedKeywordRole !== "all") {
          params.set("role", selectedKeywordRole);
        }
        const response = await fetch(`/api/analysis/keywords?${params.toString()}`);
        const payload = (await response.json()) as KeywordStudioResponse;
        if (cancelled) return;
        if (!response.ok || payload.error) {
          setKeywordStudioData(null);
          setKeywordStudioError(payload.error ?? "Failed to load keyword analysis.");
          return;
        }
        setKeywordStudioData(payload);
        setSelectedKeywordRole((current) => {
          const roles = payload.roles ?? [];
          if (current && roles.some((entry) => entry.role === current)) {
            return current;
          }
          return payload.role ?? roles[0]?.role ?? "all";
        });
      } catch {
        if (!cancelled) {
          setKeywordStudioData(null);
          setKeywordStudioError("Failed to load keyword analysis.");
        }
      } finally {
        if (!cancelled) {
          setKeywordStudioLoading(false);
        }
      }
    }

    void loadKeywordStudio();
    return () => {
      cancelled = true;
    };
  }, [previewNonce, selectedCvId, selectedCvMeta?.language, selectedKeywordDataset, selectedKeywordRole, variantPair?.en?.id]);

  useEffect(() => {
    if (!editorCv) {
      setSectionDraft(null);
      setYamlDraft("");
      return;
    }
    const section = cloneValue(getByPath(editorCv, editorPath) ?? {});
    setSectionDraft(section);
    setYamlDraft(stringifyYaml(section ?? {}));
  }, [editorCv, editorPath]);

  useEffect(() => {
    let cancelled = false;
    async function loadSettings() {
      setSettingsLoading(true);
      try {
        const response = await fetch("/api/settings/openrouter");
        const payload = (await response.json()) as OpenRouterSettingsResponse;
        if (cancelled) return;
        setSettings(payload);
        setModelInput(payload.model || "openai/gpt-4o-mini");
        setBaseUrlInput(payload.baseUrl || "https://openrouter.ai/api/v1/chat/completions");
        setModelOptions(payload.models ?? []);
      } finally {
        if (!cancelled) {
          setSettingsLoading(false);
        }
      }
    }
    void loadSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  function switchLanguage(language: "bg" | "en") {
    setSelectedLanguage(language);
    if (!variantPair) {
      return;
    }
    const next = language === "bg" ? variantPair.bg : variantPair.en;
    if (next?.id) {
      setSelectedCvId(next.id);
      setPreviewNonce(Date.now());
    }
  }

  function switchCvPair(pairKey: string) {
    const pair = cvPairs.find((entry) => entry.key === pairKey);
    if (!pair) {
      return;
    }
    const next = selectedLanguage === "bg" ? (pair.bg ?? pair.en) : (pair.en ?? pair.bg);
    if (next?.id) {
      setSelectedCvId(next.id);
      setPreviewNonce(Date.now());
    }
  }

  function updateDraftAt(path: PathSegment[], value: unknown) {
    setSectionDraft((current: unknown) => {
      const next = setAtPath(current, path, value);
      setYamlDraft(stringifyYaml(next ?? {}));
      return next;
    });
  }

  function removeDraftAt(path: PathSegment[]) {
    setSectionDraft((current: unknown) => {
      const next = removeAtPath(current, path);
      setYamlDraft(stringifyYaml(next ?? {}));
      return next;
    });
  }

  function addArrayEntry(path: PathSegment[], sample: unknown) {
    setSectionDraft((current: unknown) => {
      const next = appendToArrayAtPath(current, path, defaultFromSample(sample));
      setYamlDraft(stringifyYaml(next ?? {}));
      return next;
    });
  }

  function addCustomObjectField(path: PathSegment[]) {
    const key = window.prompt(selectedLanguage === "bg" ? "Име на ново поле" : "New field name", "custom_field");
    if (!key || key.trim().length === 0) return;
    const value = window.prompt(selectedLanguage === "bg" ? "Стойност" : "Value", "") ?? "";
    updateDraftAt([...path, key.trim()], value);
  }

  function addCustomArrayEntry(path: PathSegment[]) {
    const value = window.prompt(selectedLanguage === "bg" ? "Стойност за нов запис" : "Value for new entry", "");
    if (value === null) return;
    setSectionDraft((current: unknown) => {
      const next = appendToArrayAtPath(current, path, value);
      setYamlDraft(stringifyYaml(next ?? {}));
      return next;
    });
  }

  async function saveEditorSection() {
    if (!editorCv || !selectedCvId) {
      return;
    }

    let parsedSection = sectionDraft;
    if (editorView === "yaml") {
      try {
        parsedSection = parseYaml(yamlDraft);
      } catch {
        setEditorNotice(selectedLanguage === "bg" ? "Невалиден YAML." : "Invalid YAML.");
        return;
      }
    }

    setEditorSaving(true);
    setEditorNotice("");
    try {
      const updated = setByPath(editorCv, editorPath, parsedSection) as Record<string, unknown>;
      const response = await fetch(`/api/cvs/${encodeURIComponent(selectedCvId)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cv: updated }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setEditorNotice(payload.error ?? (selectedLanguage === "bg" ? "Грешка при запис." : "Save failed."));
        return;
      }
      setEditorCv(updated);
      setPreviewNonce(Date.now());
      setEditorNotice(selectedLanguage === "bg" ? "Секцията е запазена." : "Section saved.");
    } finally {
      setEditorSaving(false);
    }
  }

  async function saveAiSettings() {
    setSettingsSaving(true);
    setSettingsNotice("");
    try {
      const response = await fetch("/api/settings/openrouter", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          apiKey: apiKeyInput,
          model: modelInput,
          baseUrl: baseUrlInput,
        }),
      });
      const payload = (await response.json()) as OpenRouterSettingsResponse & { error?: string };
      if (!response.ok || payload.error) {
        setSettingsNotice(payload.error ?? "Failed to save settings.");
        return;
      }
      setSettings(payload);
      setApiKeyInput("");
      setModelOptions(payload.models ?? []);
      setSettingsNotice("Settings saved.");
      try {
        const creditResponse = await fetch("/api/settings/openrouter/credit");
        const creditPayload = (await creditResponse.json()) as OpenRouterCreditResponse;
        setCreditStatus(creditPayload);
      } catch {
        // no-op: credit polling effect will refresh soon.
      }
    } finally {
      setSettingsSaving(false);
    }
  }

  async function runAnalysis(scope: "section" | "full") {
    if (!selectedCvId || !selectedTemplateId) {
      return;
    }
    setAnalysisLoading(true);
    setAnalysisText("");
    setAnalysisData(null);
    try {
      const response = await fetch("/api/analysis/cv", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          cvId: selectedCvId,
          templateId: selectedTemplateId,
          scope,
          sectionKey: editorPath,
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        analysis?: unknown;
        raw?: string;
      };
      if (!response.ok) {
        setAnalysisText(payload.error ?? "AI scoring failed.");
        return;
      }
      if (payload.analysis && typeof payload.analysis === "object") {
        setAnalysisData(payload.analysis as SectionAnalysis | FullAnalysis);
        return;
      }
      setAnalysisText(JSON.stringify(payload.analysis ?? payload.raw ?? {}, null, 2));
    } finally {
      setAnalysisLoading(false);
    }
  }

  async function runKeywordManageAction(action: "run_collection") {
    setKeywordManageBusy(true);
    setKeywordManageNotice("");
    try {
      const response = await fetch("/api/analysis/keywords/manage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = (await response.json()) as KeywordManageStatsResponse;
      if (!response.ok || payload.error) {
        setKeywordManageNotice(payload.error ?? "Keyword data operation failed.");
        return;
      }
      setKeywordManageStats(payload.stats ?? null);
      setKeywordRunStatus(payload.run ?? null);
      if (action === "run_collection" && payload.run?.runId) {
        setKeywordRunModalOpen(true);
      }
      setKeywordManageNotice(
        action === "run_collection"
          ? (payload.alreadyRunning ? "Collection run already in progress." : "Collection run started.")
          : "Collection run started.",
      );
      setPreviewNonce(Date.now());
    } catch {
      setKeywordManageNotice("Keyword data operation failed.");
    } finally {
      setKeywordManageBusy(false);
    }
  }

  async function syncLanguagePair() {
    if (!selectedCvId) {
      return;
    }
    setSyncing(true);
    setEditorNotice("");
    try {
      const response = await fetch("/api/cvs/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          cvId: selectedCvId,
          sourceLanguage: selectedLanguage,
        }),
      });
      const payload = (await response.json()) as SyncResponse;
      if (!response.ok) {
        setEditorNotice(payload.error ?? "SYNC failed.");
        return;
      }

      setEditorNotice(payload.message ?? (payload.changed ? "SYNC completed." : "No missing fields to sync."));
      setSyncReport({
        open: true,
        direction: payload.direction ?? (selectedLanguage === "bg" ? "BG > EN" : "BG < EN"),
        sourceCvId: payload.sourceCvId ?? selectedCvId,
        targetCvId: payload.targetCvId ?? "",
        changed: Boolean(payload.changed),
        changes: payload.changes ?? [],
        message: payload.message ?? (payload.changed ? "Missing fields synced and translated." : "No missing fields found."),
      });

      if (payload.changed) {
        const targetLang = selectedLanguage === "bg" ? "en" : "bg";
        const targetVariant = targetLang === "bg" ? variantPair?.bg : variantPair?.en;
        if (targetVariant) {
          setSelectedCvId(targetVariant.id);
          setSelectedLanguage(targetLang);
        }
      }
      setPreviewNonce(Date.now());
    } finally {
      setSyncing(false);
    }
  }

  function scoreTone(score: number): string {
    if (resolvedTheme === "dark") {
      if (score >= 85) return "text-emerald-300";
      if (score >= 70) return "text-amber-300";
      return "text-rose-300";
    }
    if (score >= 85) return "text-emerald-700";
    if (score >= 70) return "text-amber-700";
    return "text-rose-700";
  }

  function keywordBandClass(
    band: KeywordBand,
    source?: "jd" | "senior_leadership" | "game_generic" | "combined",
    category?: string,
  ): string {
    const seniorityCategories = new Set([
      "leadership_management",
      "achievement_growth",
      "innovation",
      "optimization",
      "analysis",
      "collaboration",
    ]);
    const gameGenericCategories = new Set([
      "design_specializations",
      "engines_scripting",
      "design_frameworks",
      "prototyping_documentation",
      "data_design",
      "kpis",
      "live_ops",
      "soft_skills",
    ]);
    if (source === "senior_leadership" || (source === "combined" && seniorityCategories.has(String(category ?? "")))) {
      return "border-indigo-300 bg-indigo-50 text-indigo-900";
    }
    if (source === "game_generic" || (source === "combined" && gameGenericCategories.has(String(category ?? "")))) {
      return "border-cyan-300 bg-cyan-50 text-cyan-900";
    }
    if (band === "red") return "border-red-300 bg-red-50 text-red-900";
    if (band === "orange") return "border-orange-300 bg-orange-50 text-orange-900";
    if (band === "yellow") return "border-yellow-300 bg-yellow-50 text-yellow-900";
    if (band === "green") return "border-emerald-300 bg-emerald-50 text-emerald-900";
    return "border-slate-300 bg-slate-100 text-slate-700";
  }

  function keywordSourceLabel(source?: "jd" | "senior_leadership" | "game_generic" | "combined"): string {
    if (source === "senior_leadership") return "Seniority";
    if (source === "game_generic") return "Game Generic";
    if (source === "combined") return "Combined";
    return "JD";
  }

  function keywordSourceBadgeClass(
    source: KeywordSource | undefined,
    theme: "light" | "dark",
  ): string {
    if (theme === "dark") {
      if (source === "senior_leadership") return "border-indigo-500 bg-indigo-900/55 text-indigo-100";
      if (source === "game_generic") return "border-cyan-500 bg-cyan-900/55 text-cyan-100";
      if (source === "combined") return "border-violet-500 bg-violet-900/55 text-violet-100";
      return "border-slate-600 bg-slate-800 text-slate-200";
    }
    if (source === "senior_leadership") return "border-indigo-300 bg-indigo-100 text-indigo-900";
    if (source === "game_generic") return "border-cyan-300 bg-cyan-100 text-cyan-900";
    if (source === "combined") return "border-violet-300 bg-violet-100 text-violet-900";
    return "border-slate-300 bg-slate-100 text-slate-700";
  }

  function keywordStatusBadgeClass(
    status: "missing" | "underused" | "used" | undefined,
    theme: "light" | "dark",
  ): string {
    if (theme === "dark") {
      if (status === "missing") return "border-rose-500 bg-rose-900/55 text-rose-100";
      if (status === "underused") return "border-amber-500 bg-amber-900/50 text-amber-100";
      if (status === "used") return "border-emerald-500 bg-emerald-900/55 text-emerald-100";
      return "border-slate-600 bg-slate-800 text-slate-200";
    }
    if (status === "missing") return "border-red-300 bg-red-100 text-red-900";
    if (status === "underused") return "border-amber-300 bg-amber-100 text-amber-900";
    if (status === "used") return "border-emerald-300 bg-emerald-100 text-emerald-900";
    return "border-slate-300 bg-slate-100 text-slate-700";
  }

  function renderKeywordTagChip(
    key: string,
    label: string,
    metric: KeywordTagMetric,
  ): JSX.Element {
    const handleMouseEnter = (event: React.MouseEvent<HTMLSpanElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const tooltipWidth = 320;
      const tooltipHeight = 210;
      const margin = 10;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      let left = rect.left + (rect.width / 2) - (tooltipWidth / 2);
      left = Math.max(margin, Math.min(left, viewportWidth - tooltipWidth - margin));
      let top = rect.bottom + 10;
      if (top + tooltipHeight > viewportHeight - margin) {
        top = rect.top - tooltipHeight - 10;
      }
      top = Math.max(margin, top);
      setKeywordHover({ label, metric, left, top });
    };

    const handleMouseLeave = () => {
      setKeywordHover((current) => (current?.label === label && current?.metric.keyword === metric.keyword ? null : current));
    };

    return (
      <span key={key} className="inline-flex">
        <span
          className={`inline-flex rounded-md border px-1.5 py-[1px] ${keywordBandClass(metric.band, metric.source, metric.category)}`}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {label}
        </span>
      </span>
    );
  }

  function isSeniorityMetricSource(
    source?: "jd" | "senior_leadership" | "game_generic" | "combined",
    category?: string,
  ): boolean {
    if (source === "senior_leadership") return true;
    if (source !== "combined") return false;
    return new Set([
      "leadership_management",
      "achievement_growth",
      "innovation",
      "optimization",
      "analysis",
      "collaboration",
    ]).has(String(category ?? ""));
  }

  function isSoftMetricSource(
    source?: KeywordSource,
    category?: string,
  ): boolean {
    return category === "soft_skills" || category === "soft_skill";
  }

  function isHardMetricSource(
    source?: KeywordSource,
    category?: string,
  ): boolean {
    const hardCategories = new Set([
      "hard_skill",
      "design_specializations",
      "engines_scripting",
      "design_frameworks",
      "prototyping_documentation",
      "data_design",
      "kpis",
      "live_ops",
    ]);
    if (hardCategories.has(String(category ?? ""))) {
      return true;
    }
    return source === "game_generic" && !isSoftMetricSource(source, category) && !isSeniorityMetricSource(source, category);
  }

  function normalizeToken(token: string): string {
    return token.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");
  }

  function diceSimilarity(a: string, b: string): number {
    if (a === b) return 1;
    if (a.length < 2 || b.length < 2) return 0;
    const gramsA = new Map<string, number>();
    for (let i = 0; i < a.length - 1; i += 1) {
      const gram = a.slice(i, i + 2);
      gramsA.set(gram, (gramsA.get(gram) ?? 0) + 1);
    }
    let overlap = 0;
    for (let i = 0; i < b.length - 1; i += 1) {
      const gram = b.slice(i, i + 2);
      const count = gramsA.get(gram) ?? 0;
      if (count > 0) {
        overlap += 1;
        gramsA.set(gram, count - 1);
      }
    }
    return (2 * overlap) / (a.length - 1 + (b.length - 1));
  }

  function fuzzyKeywordForToken(token: string): {
    keyword: string;
    normalized: number;
    band: KeywordBand;
    weight: number;
    status: "missing" | "underused" | "used";
    cvHits: number;
    targetHits: number;
    recommendation: string;
    usageRatio: number;
    source?: "jd" | "senior_leadership" | "game_generic" | "combined";
    category?: string;
  } | null {
    const normalized = normalizeToken(token);
    if (normalized.length < 3) return null;

    const exact = keywordMatcher.tokenIndex.get(normalized);
    if (exact) {
      return exact;
    }

    let best: {
      keyword: string;
      normalized: number;
      band: KeywordBand;
      weight: number;
      status: "missing" | "underused" | "used";
      cvHits: number;
      targetHits: number;
      recommendation: string;
      usageRatio: number;
      source?: "jd" | "senior_leadership" | "game_generic" | "combined";
      category?: string;
      score: number;
    } | null = null;
    for (const [candidate, metric] of keywordMatcher.tokenIndex.entries()) {
      if (Math.abs(candidate.length - normalized.length) > 2) continue;
      const similarity = diceSimilarity(normalized, candidate);
      if (similarity < 0.86) continue;
      if (!best || similarity > best.score) {
        best = { ...metric, score: similarity };
      }
    }
    if (!best) return null;
    return {
      keyword: best.keyword,
      normalized: best.normalized,
      band: best.band,
      weight: best.weight,
      status: best.status,
      cvHits: best.cvHits,
      targetHits: best.targetHits,
      recommendation: best.recommendation,
      usageRatio: best.usageRatio,
      source: best.source,
      category: best.category,
    };
  }

  function keywordForPhrase(tokens: string[]): {
    keyword: string;
    normalized: number;
    band: KeywordBand;
    weight: number;
    status: "missing" | "underused" | "used";
    cvHits: number;
    targetHits: number;
    recommendation: string;
    usageRatio: number;
    source?: "jd" | "senior_leadership" | "game_generic" | "combined";
    category?: string;
  } | null {
    const phrase = tokens.map((item) => normalizeToken(item)).filter(Boolean).join(" ");
    if (!phrase) return null;
    const exact = keywordMatcher.phraseIndex.get(phrase);
    if (exact) {
      return exact;
    }
    return null;
  }

  function renderKeywordAwareText(text: string): JSX.Element {
    const tokens = text.split(/(\s+)/);
    const nodes: JSX.Element[] = [];
    let i = 0;

    while (i < tokens.length) {
      const raw = tokens[i];
      if (raw.trim().length === 0) {
        nodes.push(<span key={`ws-${i}`}>{raw}</span>);
        i += 1;
        continue;
      }

      let matched:
        | {
            endIndex: number;
            rawText: string;
            metric: {
              keyword: string;
              normalized: number;
              band: KeywordBand;
              weight: number;
              status: "missing" | "underused" | "used";
              cvHits: number;
              targetHits: number;
              recommendation: string;
              usageRatio: number;
              source?: "jd" | "senior_leadership" | "game_generic" | "combined";
              category?: string;
            };
          }
        | null = null;

      for (let phraseLen = keywordMatcher.maxPhraseWords; phraseLen >= 2; phraseLen -= 1) {
        let wordCount = 0;
        let cursor = i;
        const parts: string[] = [];
        const phraseWordTokens: string[] = [];

        while (cursor < tokens.length && wordCount < phraseLen) {
          const part = tokens[cursor];
          parts.push(part);
          if (part.trim().length > 0) {
            phraseWordTokens.push(part);
            wordCount += 1;
          }
          cursor += 1;
        }

        if (wordCount !== phraseLen) {
          continue;
        }

        const metric = keywordForPhrase(phraseWordTokens);
        if (!metric) {
          continue;
        }

        matched = {
          endIndex: cursor - 1,
          rawText: parts.join(""),
          metric,
        };
        break;
      }

      if (matched) {
        if (isSeniorityMetricSource(matched.metric.source, matched.metric.category) && !showSeniorityPriorityTags) {
          nodes.push(<span key={`phrase-plain-${i}-${matched.endIndex}`}>{matched.rawText}</span>);
          i = matched.endIndex + 1;
          continue;
        }
        if (isHardMetricSource(matched.metric.source, matched.metric.category) && !showHardPriorityTags) {
          nodes.push(<span key={`phrase-plain-${i}-${matched.endIndex}`}>{matched.rawText}</span>);
          i = matched.endIndex + 1;
          continue;
        }
        if (isSoftMetricSource(matched.metric.source, matched.metric.category) && !showSoftPriorityTags) {
          nodes.push(<span key={`phrase-plain-${i}-${matched.endIndex}`}>{matched.rawText}</span>);
          i = matched.endIndex + 1;
          continue;
        }
        nodes.push(renderKeywordTagChip(`phrase-${i}-${matched.endIndex}`, matched.rawText, matched.metric));
        i = matched.endIndex + 1;
        continue;
      }

      const hit = fuzzyKeywordForToken(raw);
      if (!hit) {
        nodes.push(<span key={`txt-${i}`}>{raw}</span>);
        i += 1;
        continue;
      }

      if (isSeniorityMetricSource(hit.source, hit.category) && !showSeniorityPriorityTags) {
        nodes.push(<span key={`plain-${i}`}>{raw}</span>);
        i += 1;
        continue;
      }
      if (isHardMetricSource(hit.source, hit.category) && !showHardPriorityTags) {
        nodes.push(<span key={`plain-${i}`}>{raw}</span>);
        i += 1;
        continue;
      }
      if (isSoftMetricSource(hit.source, hit.category) && !showSoftPriorityTags) {
        nodes.push(<span key={`plain-${i}`}>{raw}</span>);
        i += 1;
        continue;
      }

      nodes.push(renderKeywordTagChip(`tag-${i}`, raw, hit));
      i += 1;
    }

    return (
      <>{nodes}</>
    );
  }

  type KeywordFieldRow = { label: string; value: string };

  function formatKeywordPathLabel(path: PathSegment[]): string {
    const labels: string[] = [];
    for (const segment of path) {
      if (typeof segment === "number") {
        if (labels.length > 0) {
          labels[labels.length - 1] = `${labels[labels.length - 1]} ${segment + 1}`;
        } else {
          labels.push(`Entry ${segment + 1}`);
        }
        continue;
      }
      labels.push(prettyKey(segment));
    }
    if (labels.length === 0) return "Field";
    if (labels.length === 1) return labels[0];
    return `${labels[labels.length - 2]} - ${labels[labels.length - 1]}`;
  }

  function collectKeywordRows(value: unknown, path: PathSegment[] = [], rows: KeywordFieldRow[] = []): KeywordFieldRow[] {
    if (value === null || value === undefined) {
      return rows;
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        rows.push({ label: formatKeywordPathLabel(path), value: trimmed });
      }
      return rows;
    }

    if (typeof value === "number" || typeof value === "boolean") {
      rows.push({ label: formatKeywordPathLabel(path), value: String(value) });
      return rows;
    }

    if (Array.isArray(value)) {
      value.forEach((entry, index) => {
        collectKeywordRows(entry, [...path, index], rows);
      });
      return rows;
    }

    if (typeof value === "object") {
      Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
        collectKeywordRows(entry, [...path, key], rows);
      });
    }

    return rows;
  }

  function renderYamlLine(line: string, index: number): JSX.Element {
    const keyValueMatch = /^(\s*)(-\s+)?([A-Za-z0-9_.-]+):(.*)$/.exec(line);
    const lineNumber = String(index + 1).padStart(3, " ");
    const isDark = resolvedTheme === "dark";
    const lineNumberClass = isDark ? "select-none text-[10px] text-slate-500" : "select-none text-[10px] text-slate-400";
    const blankClass = isDark ? "text-xs leading-5 text-slate-500" : "text-xs leading-5 text-slate-500";
    const commentClass = isDark ? "whitespace-pre text-xs italic leading-5 text-slate-400" : "whitespace-pre text-xs italic leading-5 text-slate-500";
    const indentClass = isDark ? "text-slate-500" : "text-slate-500";
    const keyClass = isDark ? "font-semibold text-sky-300" : "font-semibold text-sky-700";
    const listClass = isDark ? "font-semibold text-fuchsia-300" : "font-semibold text-fuchsia-700";
    const colonClass = isDark ? "text-slate-400" : "text-slate-600";
    const fallbackLineClass = isDark ? "whitespace-pre text-xs leading-5 text-slate-300" : "whitespace-pre text-xs leading-5 text-slate-700";

    if (line.trim().length === 0) {
      return (
        <div key={`yaml-line-${index}`} className="grid grid-cols-[36px_1fr] gap-2">
          <span className={lineNumberClass}>{lineNumber}</span>
          <span className={blankClass}>&nbsp;</span>
        </div>
      );
    }

    if (/^\s*#/.test(line)) {
      return (
        <div key={`yaml-line-${index}`} className="grid grid-cols-[36px_1fr] gap-2">
          <span className={lineNumberClass}>{lineNumber}</span>
          <span className={commentClass}>{line}</span>
        </div>
      );
    }

    if (keyValueMatch) {
      const [, leading, listPrefix = "", key, rawValue] = keyValueMatch;
      const value = rawValue ?? "";
      const valueTrim = value.trim();
      let valueClass = isDark ? "text-emerald-300" : "text-emerald-700";
      if (/^(true|false|null)$/i.test(valueTrim)) {
        valueClass = isDark ? "text-violet-300" : "text-violet-700";
      } else if (/^-?\d+(\.\d+)?$/.test(valueTrim)) {
        valueClass = isDark ? "text-amber-300" : "text-amber-700";
      } else if (valueTrim.length === 0) {
        valueClass = isDark ? "text-slate-500" : "text-slate-400";
      }
      return (
        <div key={`yaml-line-${index}`} className="grid grid-cols-[36px_1fr] gap-2">
          <span className={lineNumberClass}>{lineNumber}</span>
          <span className="whitespace-pre text-xs leading-5">
            <span className={indentClass}>{leading}</span>
            {listPrefix ? <span className={listClass}>{listPrefix}</span> : null}
            <span className={keyClass}>{key}</span>
            <span className={colonClass}>:</span>
            <span className={` ${valueClass}`}>{value}</span>
          </span>
        </div>
      );
    }

    if (/^\s*-\s+/.test(line)) {
      const listMatch = /^(\s*)(-\s+)(.*)$/.exec(line);
      if (listMatch) {
        return (
          <div key={`yaml-line-${index}`} className="grid grid-cols-[36px_1fr] gap-2">
            <span className={lineNumberClass}>{lineNumber}</span>
            <span className="whitespace-pre text-xs leading-5">
              <span className={indentClass}>{listMatch[1]}</span>
              <span className={listClass}>{listMatch[2]}</span>
              <span className={isDark ? "text-emerald-300" : "text-emerald-700"}>{listMatch[3]}</span>
            </span>
          </div>
        );
      }
    }

    return (
      <div key={`yaml-line-${index}`} className="grid grid-cols-[36px_1fr] gap-2">
        <span className={lineNumberClass}>{lineNumber}</span>
        <span className={fallbackLineClass}>{line}</span>
      </div>
    );
  }

  function handleYamlEditorKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key !== "Tab") {
      return;
    }
    event.preventDefault();
    const target = event.currentTarget;
    const start = target.selectionStart;
    const end = target.selectionEnd;
    const before = yamlDraft.slice(0, start);
    const after = yamlDraft.slice(end);
    const next = `${before}  ${after}`;
    setYamlDraft(next);
    requestAnimationFrame(() => {
      target.selectionStart = start + 2;
      target.selectionEnd = start + 2;
    });
  }

  function extractYamlLintIssuesFromDocument(text: string): string[] {
    const doc = parseDocument(text, { prettyErrors: false });
    if ((doc.errors ?? []).length === 0) {
      return [];
    }
    const issues = (doc.errors ?? []).map((error) => {
      const linePos = (error as { linePos?: Array<{ line?: number }> }).linePos;
      const line = linePos?.[0]?.line;
      const message = String((error as { message?: string }).message ?? "Invalid YAML")
        .replace(/\s+at line\s+\d+.*$/i, "")
        .trim();
      if (typeof line === "number" && Number.isFinite(line)) {
        return `Line ${line}: ${message}`;
      }
      return message;
    });
    return Array.from(new Set(issues));
  }

  function handleYamlEditorScroll(event: UIEvent<HTMLTextAreaElement>): void {
    if (!yamlHighlightRef.current) return;
    yamlHighlightRef.current.scrollTop = event.currentTarget.scrollTop;
    yamlHighlightRef.current.scrollLeft = event.currentTarget.scrollLeft;
  }

  function refreshPreview() {
    setPreviewNonce(Date.now());
  }

  useEffect(() => {
    if (editorView !== "yaml") {
      setYamlLintIssues([]);
      return;
    }
    const handle = window.setTimeout(() => {
      const trimmed = yamlDraft.trim();
      if (!trimmed) {
        setYamlLintIssues([]);
        return;
      }
      setYamlLintIssues(extractYamlLintIssuesFromDocument(yamlDraft));
    }, 800);
    return () => window.clearTimeout(handle);
  }, [editorView, yamlDraft]);

  function openPdf() {
    if (!pdfUrl) {
      return;
    }
    window.open(pdfUrl, "_blank", "noopener,noreferrer");
  }

  function downloadPdf() {
    if (!selectedCvId || !selectedTemplateId) {
      return;
    }
    const params = new URLSearchParams({
      cvId: selectedCvId,
      templateId: selectedTemplateId,
      download: "1",
      v: String(Date.now()),
    });
    if (selectedTemplateId === "edinburgh-v1") {
      params.set("theme", selectedTemplateTheme);
    }
    window.open(`/api/export/pdf?${params.toString()}`, "_blank", "noopener,noreferrer");
  }

  function renderFormNode(
    node: unknown,
    path: PathSegment[],
    pathLabel: string,
    keyName: string,
    options?: { onRemove?: () => void },
  ): JSX.Element {
    const copy = resolveFieldCopy(pathLabel, keyName, selectedLanguage);
    const removeButton = options?.onRemove ? (
      <button
        aria-label={selectedLanguage === "bg" ? "Премахни поле" : "Remove field"}
        className="inline-flex h-6 w-6 items-center justify-center rounded border border-[var(--line)] bg-white text-xs font-bold text-slate-700 hover:bg-[var(--surface-2)]"
        onClick={options.onRemove}
        title={selectedLanguage === "bg" ? "Премахни поле" : "Remove field"}
        type="button"
      >
        ✕
      </button>
    ) : null;

    if (Array.isArray(node)) {
      return (
        <div className="rounded-md border border-[var(--line)] bg-[var(--surface-1)] p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-slate-900">{copy.label}</p>
              <p className="text-xs text-[var(--ink-muted)]">{copy.description}</p>
            </div>
            <div className="flex gap-2">
              {removeButton}
              <button
                aria-label={selectedLanguage === "bg" ? "Добави елемент" : "Add item"}
                className="inline-flex h-6 w-6 items-center justify-center rounded border border-[var(--line)] bg-white text-xs font-bold text-slate-700 hover:bg-[var(--surface-2)]"
                onClick={() => addArrayEntry(path, node[0])}
                title={selectedLanguage === "bg" ? "Добави елемент" : "Add item"}
                type="button"
              >
                +
              </button>
              <button
                aria-label={selectedLanguage === "bg" ? "Добави custom елемент" : "Add custom item"}
                className="inline-flex h-6 w-6 items-center justify-center rounded border border-[var(--line)] bg-white text-xs font-bold text-slate-700 hover:bg-[var(--surface-2)]"
                onClick={() => addCustomArrayEntry(path)}
                title={selectedLanguage === "bg" ? "Добави custom елемент" : "Add custom item"}
                type="button"
              >
                ✎
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {node.length === 0 && (
              <p className="text-xs text-[var(--ink-muted)]">
                {selectedLanguage === "bg" ? "Празен списък." : "Empty list."}
              </p>
            )}
            {node.map((item, index) => {
              const childPath = [...path, index];
              const childLabel = `${pathLabel}[${index}]`;
              const primitive = item === null || ["string", "number", "boolean"].includes(typeof item);
              if (primitive) {
                const stringValue = String(item ?? "");
                const useTextarea = shouldUseTextarea(stringValue);
                return (
                  <div key={childLabel} className="flex items-start gap-2 rounded-md border border-[var(--line)] bg-white p-2">
                    {useTextarea ? (
                      <textarea
                        className="w-full rounded border border-[var(--line)] bg-white px-2 py-1 text-xs"
                        onChange={(event) => updateDraftAt(childPath, event.target.value)}
                        rows={estimateTextareaRows(stringValue)}
                        value={stringValue}
                      />
                    ) : (
                      <input
                        className="w-full rounded border border-[var(--line)] bg-white px-2 py-1 text-xs"
                        onChange={(event) => updateDraftAt(childPath, event.target.value)}
                        value={stringValue}
                      />
                    )}
                    <button
                      aria-label={selectedLanguage === "bg" ? "Премахни елемент" : "Remove item"}
                      className="inline-flex h-6 w-6 items-center justify-center rounded border border-[var(--line)] bg-white text-xs font-bold text-slate-700 hover:bg-[var(--surface-2)]"
                      onClick={() => removeDraftAt(childPath)}
                      title={selectedLanguage === "bg" ? "Премахни елемент" : "Remove item"}
                      type="button"
                    >
                      ✕
                    </button>
                  </div>
                );
              }

              return (
                <div key={childLabel}>
                  {renderFormNode(item, childPath, childLabel, `${keyName} ${index + 1}`, {
                    onRemove: () => removeDraftAt(childPath),
                  })}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    if (node && typeof node === "object") {
      const entries = Object.entries(node as Record<string, unknown>);
      return (
        <div className="rounded-md border border-[var(--line)] bg-[var(--surface-1)] p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-slate-900">{copy.label}</p>
              <p className="text-xs text-[var(--ink-muted)]">{copy.description}</p>
            </div>
            <div className="flex gap-2">
              {removeButton}
              <button
                aria-label={selectedLanguage === "bg" ? "Добави custom поле" : "Add custom field"}
                className="inline-flex h-6 w-6 items-center justify-center rounded border border-[var(--line)] bg-white text-xs font-bold text-slate-700 hover:bg-[var(--surface-2)]"
                onClick={() => addCustomObjectField(path)}
                title={selectedLanguage === "bg" ? "Добави custom поле" : "Add custom field"}
                type="button"
              >
                +
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {entries.map(([key, value]) => {
              const childPath = [...path, key];
              const childLabel = pathLabel ? `${pathLabel}.${key}` : key;
              return (
                <div key={childLabel}>
                  {renderFormNode(value, childPath, childLabel, key, {
                    onRemove: () => removeDraftAt(childPath),
                  })}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    const primitive = node ?? "";
    const isBool = typeof primitive === "boolean";
    const isNum = typeof primitive === "number";
    const isDate = isDateLike(primitive);

    return (
      <div className="rounded-md border border-[var(--line)] bg-[var(--surface-1)] p-3">
        <div className="flex items-start justify-between gap-2">
          <label className="block text-sm font-semibold text-slate-900">{copy.label}</label>
          {removeButton}
        </div>
        <p className="mt-1 text-xs text-[var(--ink-muted)]">
          {copy.description}
          {copy.requirement ? ` • ${copy.requirement}` : ""}
        </p>

        {isBool ? (
          <label className="mt-2 inline-flex items-center gap-2 text-xs">
            <input
              checked={Boolean(primitive)}
              onChange={(event) => updateDraftAt(path, event.target.checked)}
              type="checkbox"
            />
            {selectedLanguage === "bg" ? "Да/Не" : "True/False"}
          </label>
        ) : isDate ? (
          <input
            className="mt-2 w-full rounded border border-[var(--line)] bg-white px-2 py-1.5 text-xs"
            onChange={(event) => updateDraftAt(path, event.target.value)}
            type="date"
            value={String(primitive)}
          />
        ) : isNum ? (
          <input
            className="mt-2 w-full rounded border border-[var(--line)] bg-white px-2 py-1.5 text-xs"
            onChange={(event) => updateDraftAt(path, Number(event.target.value))}
            type="number"
            value={Number(primitive)}
          />
        ) : shouldUseTextarea(String(primitive)) ? (
          <textarea
            className="mt-2 w-full rounded border border-[var(--line)] bg-white px-2 py-1.5 text-xs"
            onChange={(event) => updateDraftAt(path, event.target.value)}
            rows={estimateTextareaRows(String(primitive))}
            value={String(primitive)}
          />
        ) : (
          <input
            className="mt-2 w-full rounded border border-[var(--line)] bg-white px-2 py-1.5 text-xs"
            onChange={(event) => updateDraftAt(path, event.target.value)}
            type="text"
            value={String(primitive)}
          />
        )}
      </div>
    );
  }

  function renderKeywordFieldRow(label: string, value: unknown, key: string): JSX.Element | null {
    const lines = collectKeywordRows(value, [label.toLowerCase().replace(/[^a-z0-9]+/g, "_")]);
    if (lines.length === 0) {
      return null;
    }
    return (
      <div key={key} className="grid gap-1 py-1.5 md:grid-cols-[170px_1fr] md:gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">{label}</p>
        <div className="space-y-1 text-sm leading-6 text-slate-800">
          {lines.map((line, index) => (
            <p key={`${key}-line-${index}`}>{renderKeywordAwareText(line.value)}</p>
          ))}
        </div>
      </div>
    );
  }

  function renderKeywordStringList(items: unknown, keyPrefix: string): JSX.Element | null {
    const list = Array.isArray(items)
      ? items.map((item) => String(item ?? "").trim()).filter((item) => item.length > 0)
      : [];
    if (list.length === 0) {
      return null;
    }
    return (
      <ul className="space-y-1 text-sm leading-6 text-slate-800">
        {list.map((item, index) => (
          <li key={`${keyPrefix}-${index}`} className="grid grid-cols-[10px_1fr] gap-2">
            <span className="mt-[9px] h-1.5 w-1.5 rounded-full bg-slate-400" />
            <span>{renderKeywordAwareText(item)}</span>
          </li>
        ))}
      </ul>
    );
  }

  function renderKeywordPositioning(positioning: unknown): JSX.Element | null {
    const rows = collectKeywordRows(positioning, ["positioning"]);
    if (rows.length === 0) {
      return null;
    }
    return (
      <section className="rounded-md border border-[var(--line)] bg-white p-4 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
        <h4 className="border-b border-slate-200 pb-2 text-sm font-bold uppercase tracking-[0.08em] text-slate-800">
          Positioning
        </h4>
        <article className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
          <div className="divide-y divide-slate-200">
            {rows.map((row, index) => (
              <div key={`positioning-${index}`} className="grid gap-1 py-1.5 md:grid-cols-[180px_1fr] md:gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">{row.label}</p>
                <p className="text-sm leading-6 text-slate-800">{renderKeywordAwareText(row.value)}</p>
              </div>
            ))}
          </div>
        </article>
      </section>
    );
  }

  function renderKeywordExperience(experience: unknown): JSX.Element | null {
    const items = Array.isArray(experience) ? experience : [];
    if (items.length === 0) {
      return null;
    }

    return (
      <section className="rounded-md border border-[var(--line)] bg-white p-4 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
        <h4 className="border-b border-slate-200 pb-2 text-sm font-bold uppercase tracking-[0.08em] text-slate-800">
          Professional Experience
        </h4>
        <div className="mt-3 space-y-3">
          {items.map((item, index) => {
            const role = asRecord(item);
            if (!role) return null;
            const start = String(role.start_date ?? "").trim();
            const end = String(role.end_date ?? "").trim();
            const range = [start, end].filter(Boolean).join(" - ") || "Date not specified";
            const roleTitle = String(
              role.role ?? role.occupation ?? role.title ?? role.job_title ?? role.position ?? "Role",
            ).trim();
            const employerName = String(role.employer ?? role.company ?? role.organization ?? "Employer").trim();
            const durationText = String(role.duration_text ?? "").trim();
            const isCurrent = role.is_current === true;
            const parallelRole = role.parallel_role === true;
            const tools = Array.isArray(role.tools) ? role.tools : [];
            const quantifiedResults = Array.isArray(role.quantified_results) ? role.quantified_results : [];
            const publicationLinks = Array.isArray(role.publication_links) ? role.publication_links : [];

            return (
              <article key={`exp-${index}`} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-base font-semibold text-slate-900">{renderKeywordAwareText(roleTitle)}</p>
                    <p className="text-sm text-slate-700">{renderKeywordAwareText(employerName)}</p>
                  </div>
                  <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-xs font-semibold text-slate-600">{range}</span>
                </div>

                <div className="mt-2 divide-y divide-slate-200">
                  {renderKeywordFieldRow("Duration", durationText, `exp-${index}-duration`)}
                  {renderKeywordFieldRow("Current", isCurrent ? "Yes" : "No", `exp-${index}-current`)}
                  {renderKeywordFieldRow("Parallel Role", parallelRole ? "Yes" : "No", `exp-${index}-parallel`)}
                  {renderKeywordFieldRow("Location", role.location, `exp-${index}-location`)}
                  {renderKeywordFieldRow("Industry", role.industry, `exp-${index}-industry`)}
                  {renderKeywordFieldRow("Employment Type", role.employment_type, `exp-${index}-employment-type`)}
                </div>

                {Array.isArray(role.responsibilities) && role.responsibilities.length > 0 ? (
                  <div className="mt-3">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">Responsibilities</p>
                    {renderKeywordStringList(role.responsibilities, `exp-${index}-resp`)}
                  </div>
                ) : null}

                {Array.isArray(role.products) && role.products.length > 0 ? (
                  <div className="mt-3">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">Products / Scope</p>
                    <ul className="space-y-1 text-sm leading-6 text-slate-800">
                      {role.products.map((product, pIndex) => {
                        if (typeof product === "string") {
                          return (
                            <li key={`exp-${index}-product-${pIndex}`} className="grid grid-cols-[10px_1fr] gap-2">
                              <span className="mt-[9px] h-1.5 w-1.5 rounded-full bg-slate-400" />
                              <span>{renderKeywordAwareText(product)}</span>
                            </li>
                          );
                        }
                        const record = asRecord(product);
                        if (!record) return null;
                        return (
                          <li key={`exp-${index}-product-${pIndex}`} className="grid grid-cols-[10px_1fr] gap-2">
                            <span className="mt-[9px] h-1.5 w-1.5 rounded-full bg-slate-400" />
                            <div>
                              <p>{renderKeywordAwareText(String(record.name ?? ""))}</p>
                              {record.note ? <p className="pl-4 text-xs text-slate-600">{renderKeywordAwareText(String(record.note))}</p> : null}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}

                {quantifiedResults.length > 0 ? (
                  <div className="mt-3">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">Quantified Results</p>
                    <ul className="space-y-1 text-sm leading-6 text-slate-800">
                      {quantifiedResults.map((result, rIndex) => {
                        const record = asRecord(result);
                        if (!record) return null;
                        const metric = String(record.metric ?? "").trim();
                        const value = String(record.value ?? "").trim();
                        const note = String(record.note ?? "").trim();
                        const line = [metric, value].filter(Boolean).join(": ");
                        if (!line && !note) return null;
                        return (
                          <li key={`exp-${index}-result-${rIndex}`} className="grid grid-cols-[10px_1fr] gap-2">
                            <span className="mt-[9px] h-1.5 w-1.5 rounded-full bg-slate-400" />
                            <div>
                              {line ? <p>{renderKeywordAwareText(line)}</p> : null}
                              {note ? <p className="pl-4 text-xs text-slate-600">{renderKeywordAwareText(note)}</p> : null}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}

                {tools.length > 0 ? (
                  <div className="mt-3">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">Tools</p>
                    <div className="flex flex-wrap gap-2">
                      {tools.map((entry, tIndex) => (
                        <span key={`exp-${index}-tool-${tIndex}`} className="rounded-full border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800">
                          {renderKeywordAwareText(String(entry))}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {publicationLinks.length > 0 ? (
                  <div className="mt-3">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">Publication Links</p>
                    <ul className="space-y-1 text-sm leading-6 text-slate-800">
                      {publicationLinks.map((link, lIndex) => {
                        if (typeof link === "string") {
                          return (
                            <li key={`exp-${index}-pub-${lIndex}`} className="grid grid-cols-[10px_1fr] gap-2">
                              <span className="mt-[9px] h-1.5 w-1.5 rounded-full bg-slate-400" />
                              <span>{renderKeywordAwareText(link)}</span>
                            </li>
                          );
                        }
                        const record = asRecord(link);
                        if (!record) return null;
                        const label = String(record.title ?? record.url ?? "").trim();
                        const url = String(record.url ?? "").trim();
                        if (!label && !url) return null;
                        return (
                          <li key={`exp-${index}-pub-${lIndex}`} className="grid grid-cols-[10px_1fr] gap-2">
                            <span className="mt-[9px] h-1.5 w-1.5 rounded-full bg-slate-400" />
                            <div>
                              {label ? <p>{renderKeywordAwareText(label)}</p> : null}
                              {url && url !== label ? <p className="pl-4 text-xs text-slate-600">{renderKeywordAwareText(url)}</p> : null}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>
    );
  }

  function renderKeywordEducation(education: unknown): JSX.Element | null {
    const items = Array.isArray(education) ? education : [];
    if (items.length === 0) {
      return null;
    }
    return (
      <section className="rounded-md border border-[var(--line)] bg-white p-4 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
        <h4 className="border-b border-slate-200 pb-2 text-sm font-bold uppercase tracking-[0.08em] text-slate-800">
          Education and Training
        </h4>
        <div className="mt-3 space-y-3">
          {items.map((item, index) => {
            const row = asRecord(item);
            if (!row) return null;
            const start = String(row.start_date ?? "").trim();
            const end = String(row.end_date ?? "").trim();
            const range = [start, end].filter(Boolean).join(" - ") || "Date not specified";
            return (
              <article key={`edu-${index}`} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-base font-semibold text-slate-900">{renderKeywordAwareText(String(row.qualification ?? "Qualification"))}</p>
                    <p className="text-sm text-slate-700">{renderKeywordAwareText(String(row.institution ?? "Institution"))}</p>
                  </div>
                  <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-xs font-semibold text-slate-600">{range}</span>
                </div>
                <div className="mt-2 divide-y divide-slate-200">
                  {renderKeywordFieldRow("Field", row.field_of_study, `edu-${index}-field`)}
                  {renderKeywordFieldRow("Level", row.level_eqf_or_nqf, `edu-${index}-level`)}
                  {renderKeywordFieldRow("Location", row.location, `edu-${index}-location`)}
                  {renderKeywordFieldRow("Completed", row.completed, `edu-${index}-completed`)}
                </div>
                {Array.isArray(row.subjects) && row.subjects.length > 0 ? (
                  <div className="mt-3">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">Subjects</p>
                    {renderKeywordStringList(row.subjects, `edu-${index}-subjects`)}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>
    );
  }

  function renderKeywordSkills(skills: unknown): JSX.Element | null {
    const row = asRecord(skills);
    if (!row) return null;
    const languageSkills = Array.isArray(row.languages) ? row.languages : [];
    const technicalSkills = Array.isArray(row.technical) ? row.technical : [];
    const socialSkills = Array.isArray(row.social) ? row.social : [];
    const coreStrengths = Array.isArray(row.core_strengths) ? row.core_strengths : [];

    return (
      <section className="rounded-md border border-[var(--line)] bg-white p-4 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
        <h4 className="border-b border-slate-200 pb-2 text-sm font-bold uppercase tracking-[0.08em] text-slate-800">Skills</h4>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">Languages</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {languageSkills.length > 0
                ? languageSkills.map((entry, index) => {
                    if (typeof entry === "string") {
                      return (
                        <span key={`lang-${index}`} className="rounded-full border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800">
                          {renderKeywordAwareText(entry)}
                        </span>
                      );
                    }
                    const record = asRecord(entry);
                    const label = [String(record?.language ?? ""), String(record?.level ?? "")].filter(Boolean).join(" - ");
                    return (
                      <span key={`lang-${index}`} className="rounded-full border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800">
                        {renderKeywordAwareText(label || "Language")}
                      </span>
                    );
                  })
                : <p className="text-xs text-slate-500">No language entries.</p>}
            </div>
          </div>

          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">Technical</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {technicalSkills.length > 0
                ? technicalSkills.map((entry, index) => (
                    <span key={`tech-${index}`} className="rounded-full border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800">
                      {renderKeywordAwareText(String(entry))}
                    </span>
                  ))
                : <p className="text-xs text-slate-500">No technical entries.</p>}
            </div>
          </div>

          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">Core Strengths</p>
            <div className="mt-2">{renderKeywordStringList(coreStrengths, "skills-core") ?? <p className="text-xs text-slate-500">No core strengths.</p>}</div>
          </div>

          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">Social Skills</p>
            <div className="mt-2">{renderKeywordStringList(socialSkills, "skills-social") ?? <p className="text-xs text-slate-500">No social skills.</p>}</div>
          </div>
        </div>
      </section>
    );
  }

  function renderKeywordOptional(optional: unknown): JSX.Element | null {
    const record = asRecord(optional);
    if (!record) return null;
    const entries = Object.entries(record).filter(([, value]) => collectKeywordRows(value).length > 0);
    if (entries.length === 0) return null;

    return (
      <section className="rounded-md border border-[var(--line)] bg-white p-4 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
        <h4 className="border-b border-slate-200 pb-2 text-sm font-bold uppercase tracking-[0.08em] text-slate-800">Additional Information</h4>
        <div className="mt-3 space-y-3">
          {entries.map(([sectionKey, sectionValue]) => (
            <article key={`optional-${sectionKey}`} className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">{prettyKey(sectionKey)}</p>
              <div className="divide-y divide-slate-200">
                {collectKeywordRows(sectionValue, [sectionKey]).map((row, index) => (
                  <div key={`optional-${sectionKey}-${index}`} className="grid gap-1 py-1.5 md:grid-cols-[180px_1fr] md:gap-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">{row.label}</p>
                    <p className="text-sm leading-6 text-slate-800">{renderKeywordAwareText(row.value)}</p>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  }

  function renderKeywordStudio(): JSX.Element {
    if (keywordStudioLoading) {
      return <p className="text-sm text-[var(--ink-muted)]">Loading keyword analysis and CV render...</p>;
    }
    if (keywordStudioError) {
      return <p className="text-sm text-rose-700">{keywordStudioError}</p>;
    }

    const cvRoot = asRecord(keywordStudioData?.cv);
    if (!cvRoot) {
      return <p className="text-sm text-[var(--ink-muted)]">Keyword Studio requires an English CV variant.</p>;
    }

    const positioning = asRecord(cvRoot.positioning);
    const clusters = keywordStudioData?.clusters ?? [];
    const keywordSummary = keywordStudioData?.keywordSummary;
    const missingKeywords = keywordStudioData?.missingKeywords ?? [];
    const underusedKeywords = keywordStudioData?.underusedKeywords ?? [];
    const usedKeywords = keywordStudioData?.usedKeywords ?? [];
    const seniorityKeywords = keywordStudioData?.seniorityKeywords ?? [];
    const fallbackSeniorityKeywords = (keywordStudioData?.keywords ?? [])
      .filter((item) => isSeniorityMetricSource(item.source, item.category))
      .sort((a, b) => b.weight - a.weight || a.keyword.localeCompare(b.keyword));
    const seniorityPriorityKeywords = seniorityKeywords.length > 0 ? seniorityKeywords : fallbackSeniorityKeywords;
    const hardSkillCategories = new Set([
      "design_specializations",
      "engines_scripting",
      "design_frameworks",
      "prototyping_documentation",
      "data_design",
      "kpis",
      "live_ops",
    ]);
    const hardSkillRegex = /\b(sql|python|c\+\+|c#|unity|unreal|blueprints|lua|looker|snowflake|bigquery|a\/b testing|retention|arpu|arppu|ltv|monetization|live ops|systems design|economy balancing)\b/i;
    const softSkillRegex = /\b(communication|collaboration|stakeholder|mentored|facilitated|liaised|partnered|feedback|listening|adaptability|problem solving|critical thinking|cross-functional|team)\b/i;
    const allSkillCandidates = keywordStudioData?.keywords ?? [];
    const softPriorityKeywords = allSkillCandidates
      .filter((item) => item.category === "soft_skills" || softSkillRegex.test(item.keyword))
      .sort((a, b) => b.weight - a.weight || a.keyword.localeCompare(b.keyword));
    const hardPriorityKeywords = allSkillCandidates
      .filter((item) =>
        !softPriorityKeywords.some((soft) => soft.keyword === item.keyword) &&
        (hardSkillCategories.has(String(item.category ?? "")) || hardSkillRegex.test(item.keyword))
      )
      .sort((a, b) => b.weight - a.weight || a.keyword.localeCompare(b.keyword));
    const isDark = resolvedTheme === "dark";
    const roles = keywordStudioData?.roles ?? [];
    const keywordRunActive =
      keywordRunStatus?.state === "queued" ||
      keywordRunStatus?.state === "scraping" ||
      keywordRunStatus?.state === "merging";

    const experiences = Array.isArray(cvRoot.experience) ? cvRoot.experience : [];
    const education = Array.isArray(cvRoot.education) ? cvRoot.education : [];
    const optional = asRecord(cvRoot.optional_sections);
    const skills = asRecord(cvRoot.skills);

    return (
      <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[340px_1fr]">
        <article className="min-h-0 overflow-auto rounded-xl border border-[var(--line)] bg-white p-4">
          <h2 className="text-xl font-bold text-slate-900">Keyword Studio</h2>
          <p className="mt-2 text-sm text-[var(--ink-muted)]">
            English Europass-like analysis view with fuzzy keyword tagging and weighted relevance heat.
          </p>

          <div className="mt-3 rounded-md border border-[var(--line)] bg-[var(--surface-1)] p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--ink-muted)]">Dataset</p>
            <label className="mt-2 block text-xs font-medium text-slate-700">
              Snapshot
              <select
                className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-2 py-1.5 text-xs"
                disabled={keywordDatasetLoading || (keywordDatasets?.length ?? 0) === 0}
                onChange={(event) => setSelectedKeywordDataset(event.target.value)}
                value={selectedKeywordDataset}
              >
                {(keywordDatasets ?? []).map((dataset) => (
                  <option key={dataset.id} value={dataset.id}>
                    {dataset.label} ({dataset.itemCount})
                  </option>
                ))}
              </select>
            </label>
            <p className="mt-1 text-[11px] text-slate-600">
              Core database is the single live dataset refreshed from every run.
            </p>
            {keywordStudioData?.keywordDatabases?.active?.length ? (
              <p className="mt-1 text-[11px] text-slate-600">
                Active keyword DBs: {keywordStudioData.keywordDatabases.active.join(" • ")}
              </p>
            ) : null}
            <label className="mt-2 block text-xs font-medium text-slate-700">
              Profession Focus
              <select
                className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-2 py-1.5 text-xs"
                onChange={(event) => setSelectedKeywordRole(event.target.value)}
                value={selectedKeywordRole}
              >
                {roles.map((item) => (
                  <option key={item.role} value={item.role}>
                    {item.label} ({item.docCount})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-3 rounded-md border border-[var(--line)] bg-[var(--surface-1)] p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--ink-muted)]">Role Clusters</p>
            <div className="mt-2 space-y-2">
              {clusters.map((cluster) => (
                <div key={cluster.cluster} className="rounded-md border border-[var(--line)] bg-white p-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-900">{cluster.cluster}</p>
                    <p className="text-xs font-bold text-slate-700">{(cluster.normalized * 100).toFixed(0)}%</p>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-600">
                    Weight {cluster.totalWeight.toFixed(1)} • CV coverage {(cluster.cvCoverage * 100).toFixed(0)}%
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 rounded-md border border-[var(--line)] bg-[var(--surface-1)] p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--ink-muted)]">Keyword Status</p>
            <p className="mt-1 text-[11px] text-slate-600">
              Missing {keywordSummary?.missing ?? 0} • Underused {keywordSummary?.underused ?? 0} • Used {keywordSummary?.used ?? 0}
            </p>
            <p className="mt-1 text-[11px] text-slate-600">
              Usage score {(keywordStudioData?.analysisStats?.weightedUsageScore ?? 0).toFixed(1)}% • Missing weight {(keywordStudioData?.analysisStats?.missingWeightShare ?? 0).toFixed(1)}%
            </p>
            <div className="mt-2 space-y-2">
              {(missingKeywords.slice(0, 8)).map((item) => (
                <div key={`missing-${item.keyword}`} className="rounded-md border border-red-200 bg-red-50 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex rounded-md border border-red-300 bg-white px-2 py-0.5 text-xs font-semibold text-red-900">
                      {item.keyword}
                    </span>
                    <span className="text-xs font-bold text-red-900">Missing</span>
                  </div>
                  <p className="mt-1 text-[11px] text-red-800">
                    Hits {item.cvHits}/{item.targetHits} • Weight {item.weight.toFixed(1)}
                  </p>
                  <p className="mt-1 text-[11px] text-red-700">{item.recommendation}</p>
                </div>
              ))}
              {(underusedKeywords.slice(0, 8)).map((item) => (
                <div key={`underused-${item.keyword}`} className="rounded-md border border-amber-200 bg-amber-50 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex rounded-md border border-amber-300 bg-white px-2 py-0.5 text-xs font-semibold text-amber-900">
                      {item.keyword}
                    </span>
                    <span className="text-xs font-bold text-amber-900">Underused</span>
                  </div>
                  <p className="mt-1 text-[11px] text-amber-800">
                    Hits {item.cvHits}/{item.targetHits} • Weight {item.weight.toFixed(1)}
                  </p>
                  <p className="mt-1 text-[11px] text-amber-700">{item.recommendation}</p>
                </div>
              ))}
              {(usedKeywords.slice(0, 6)).map((item) => (
                <div key={`used-${item.keyword}`} className="rounded-md border border-emerald-200 bg-emerald-50 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex rounded-md border border-emerald-300 bg-white px-2 py-0.5 text-xs font-semibold text-emerald-900">
                      {item.keyword}
                    </span>
                    <span className="text-xs font-bold text-emerald-900">Used</span>
                  </div>
                  <p className="mt-1 text-[11px] text-emerald-800">
                    Hits {item.cvHits}/{item.targetHits} • Weight {item.weight.toFixed(1)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className={`mt-3 rounded-md border p-3 ${isDark ? "border-indigo-700 bg-indigo-950/35" : "border-indigo-200 bg-indigo-50/50"}`}>
            <div className="flex items-center justify-between gap-2">
              <p className={`text-xs font-semibold uppercase tracking-[0.08em] ${isDark ? "text-indigo-200" : "text-indigo-900"}`}>Seniority Priority Keywords</p>
              <button
                className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${
                  showSeniorityPriorityTags
                    ? (isDark ? "border-indigo-500 bg-indigo-900/70 text-indigo-100" : "border-indigo-300 bg-indigo-100 text-indigo-900")
                    : (isDark ? "border-slate-600 bg-slate-900 text-slate-200" : "border-slate-300 bg-white text-slate-700")
                }`}
                onClick={() => setShowSeniorityPriorityTags((current) => !current)}
                type="button"
              >
                {showSeniorityPriorityTags ? "Hide" : "Show"}
              </button>
            </div>
            <p className={`mt-1 text-[11px] ${isDark ? "text-indigo-200/90" : "text-indigo-800"}`}>
              Always shown to enforce senior-impact language in CV content. Seniority tags are currently {showSeniorityPriorityTags ? "visible" : "hidden"} in the right panel.
            </p>
            <div className="mt-2 space-y-2">
              {seniorityPriorityKeywords.map((item) => (
                <div key={`seniority-${item.keyword}`} className={`rounded-md border p-2 ${isDark ? "border-indigo-700 bg-slate-900/65" : "border-indigo-200 bg-white"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold ${isDark ? "border-indigo-500 bg-indigo-900/50 text-indigo-100" : "border-indigo-300 bg-indigo-50 text-indigo-900"}`}>
                      {item.keyword}
                    </span>
                    <span className={`text-xs font-bold ${isDark ? "text-indigo-100" : "text-indigo-900"}`}>{item.status === "used" ? "Used" : item.status === "underused" ? "Underused" : "Missing"}</span>
                  </div>
                  <p className={`mt-1 text-[11px] ${isDark ? "text-indigo-200/90" : "text-indigo-800"}`}>
                    Hits {item.cvHits}/{item.targetHits} • Weight {item.weight.toFixed(1)}
                  </p>
                  <p className={`mt-1 text-[11px] ${isDark ? "text-indigo-200/85" : "text-indigo-700"}`}>{item.recommendation}</p>
                </div>
              ))}
              {seniorityPriorityKeywords.length === 0 ? (
                <p className={`text-xs ${isDark ? "text-indigo-200/85" : "text-indigo-700"}`}>No seniority keywords available in current analysis response.</p>
              ) : null}
            </div>
          </div>

          <div className={`mt-3 rounded-md border p-3 ${isDark ? "border-cyan-700 bg-cyan-950/30" : "border-cyan-200 bg-cyan-50/50"}`}>
            <div className="flex items-center justify-between gap-2">
              <p className={`text-xs font-semibold uppercase tracking-[0.08em] ${isDark ? "text-cyan-200" : "text-cyan-900"}`}>Hard Skills Priority</p>
              <button
                className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${
                  showHardPriorityTags
                    ? (isDark ? "border-cyan-500 bg-cyan-900/60 text-cyan-100" : "border-cyan-300 bg-cyan-100 text-cyan-900")
                    : (isDark ? "border-slate-600 bg-slate-900 text-slate-200" : "border-slate-300 bg-white text-slate-700")
                }`}
                onClick={() => setShowHardPriorityTags((current) => !current)}
                type="button"
              >
                {showHardPriorityTags ? "Hide" : "Show"}
              </button>
            </div>
            <p className={`mt-1 text-[11px] ${isDark ? "text-cyan-200/90" : "text-cyan-800"}`}>
              Hard-skill tags are currently {showHardPriorityTags ? "visible" : "hidden"} in the right panel.
            </p>
            <div className="mt-2 space-y-2">
              {hardPriorityKeywords.map((item) => (
                <div key={`hard-${item.keyword}`} className={`rounded-md border p-2 ${isDark ? "border-cyan-700 bg-slate-900/65" : "border-cyan-200 bg-white"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold ${isDark ? "border-cyan-500 bg-cyan-900/45 text-cyan-100" : "border-cyan-300 bg-cyan-50 text-cyan-900"}`}>
                      {item.keyword}
                    </span>
                    <span className={`text-xs font-bold ${isDark ? "text-cyan-100" : "text-cyan-900"}`}>{item.status === "used" ? "Used" : item.status === "underused" ? "Underused" : "Missing"}</span>
                  </div>
                  <p className={`mt-1 text-[11px] ${isDark ? "text-cyan-200/90" : "text-cyan-800"}`}>
                    Hits {item.cvHits}/{item.targetHits} • Weight {item.weight.toFixed(1)}
                  </p>
                  <p className={`mt-1 text-[11px] ${isDark ? "text-cyan-200/85" : "text-cyan-700"}`}>{item.recommendation}</p>
                </div>
              ))}
              {hardPriorityKeywords.length === 0 ? <p className={`text-xs ${isDark ? "text-cyan-200/85" : "text-cyan-700"}`}>No hard-skill keywords available in current analysis response.</p> : null}
            </div>
          </div>

          <div className={`mt-3 rounded-md border p-3 ${isDark ? "border-emerald-700 bg-emerald-950/30" : "border-emerald-200 bg-emerald-50/50"}`}>
            <div className="flex items-center justify-between gap-2">
              <p className={`text-xs font-semibold uppercase tracking-[0.08em] ${isDark ? "text-emerald-200" : "text-emerald-900"}`}>Soft Skills Priority</p>
              <button
                className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${
                  showSoftPriorityTags
                    ? (isDark ? "border-emerald-500 bg-emerald-900/60 text-emerald-100" : "border-emerald-300 bg-emerald-100 text-emerald-900")
                    : (isDark ? "border-slate-600 bg-slate-900 text-slate-200" : "border-slate-300 bg-white text-slate-700")
                }`}
                onClick={() => setShowSoftPriorityTags((current) => !current)}
                type="button"
              >
                {showSoftPriorityTags ? "Hide" : "Show"}
              </button>
            </div>
            <p className={`mt-1 text-[11px] ${isDark ? "text-emerald-200/90" : "text-emerald-800"}`}>
              Soft-skill tags are currently {showSoftPriorityTags ? "visible" : "hidden"} in the right panel.
            </p>
            <div className="mt-2 space-y-2">
              {softPriorityKeywords.map((item) => (
                <div key={`soft-${item.keyword}`} className={`rounded-md border p-2 ${isDark ? "border-emerald-700 bg-slate-900/65" : "border-emerald-200 bg-white"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold ${isDark ? "border-emerald-500 bg-emerald-900/45 text-emerald-100" : "border-emerald-300 bg-emerald-50 text-emerald-900"}`}>
                      {item.keyword}
                    </span>
                    <span className={`text-xs font-bold ${isDark ? "text-emerald-100" : "text-emerald-900"}`}>{item.status === "used" ? "Used" : item.status === "underused" ? "Underused" : "Missing"}</span>
                  </div>
                  <p className={`mt-1 text-[11px] ${isDark ? "text-emerald-200/90" : "text-emerald-800"}`}>
                    Hits {item.cvHits}/{item.targetHits} • Weight {item.weight.toFixed(1)}
                  </p>
                  <p className={`mt-1 text-[11px] ${isDark ? "text-emerald-200/85" : "text-emerald-700"}`}>{item.recommendation}</p>
                </div>
              ))}
              {softPriorityKeywords.length === 0 ? <p className={`text-xs ${isDark ? "text-emerald-200/85" : "text-emerald-700"}`}>No soft-skill keywords available in current analysis response.</p> : null}
            </div>
          </div>

          <div className="mt-3 rounded-md border border-[var(--line)] bg-[var(--surface-1)] p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--ink-muted)]">Data Ops</p>
            <p className="mt-1 text-[11px] text-slate-600">
              Core DB profiles: today {keywordManageStats?.profilesScanned.today ?? 0} • total {keywordManageStats?.profilesScanned.total ?? 0}
            </p>
            <p className="mt-1 text-[11px] text-slate-600">
              Core dataset size {keywordManageStats?.coreDatasetProfiles ?? 0} • keywords identified {keywordManageStats?.keywordsIdentified ?? 0}
            </p>
            <div className="mt-2 grid grid-cols-1 gap-1.5">
              <button
                className="rounded-md border border-[var(--line)] bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                disabled={keywordManageBusy || keywordRunActive}
                onClick={() => void runKeywordManageAction("run_collection")}
                title="Run new JD collection and auto-merge into core database"
                type="button"
              >
                Run
              </button>
            </div>
            {keywordManageNotice ? <p className="mt-2 text-[11px] text-slate-700">{keywordManageNotice}</p> : null}
          </div>
        </article>

        <article className="min-h-0 overflow-auto rounded-xl border border-[var(--line)] bg-[#fcfcfd] p-5">
          <div className="mx-auto w-full max-w-[920px] rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="space-y-3 p-4">
              {renderKeywordPositioning(positioning)}
              {renderKeywordExperience(experiences)}
              {renderKeywordEducation(education)}
              {renderKeywordSkills(skills)}
              {renderKeywordOptional(optional)}
            </div>
          </div>
        </article>
      </div>
    );
  }

  return (
    <main className="app-shell paper-grid grain-overlay h-screen overflow-hidden px-4 py-4 md:px-8 md:py-6">
      <div className="fixed right-4 top-4 z-50 flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--surface-1)]/85 px-1 py-1 shadow-sm backdrop-blur-sm">
        <button
          className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm ${themeMode === "light" ? "bg-[var(--surface-2)] text-slate-900" : "text-[var(--ink-muted)] hover:bg-[var(--surface-2)]"}`}
          onClick={() => setThemeMode("light")}
          title={`Light mode${resolvedTheme === "light" ? " (active)" : ""}`}
          type="button"
        >
          <ThemeSunIcon />
        </button>
        <button
          className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm ${themeMode === "dark" ? "bg-[var(--surface-2)] text-slate-900" : "text-[var(--ink-muted)] hover:bg-[var(--surface-2)]"}`}
          onClick={() => setThemeMode("dark")}
          title={`Dark mode${resolvedTheme === "dark" ? " (active)" : ""}`}
          type="button"
        >
          <ThemeMoonIcon />
        </button>
        <button
          className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm ${themeMode === "system" ? "bg-[var(--surface-2)] text-slate-900" : "text-[var(--ink-muted)] hover:bg-[var(--surface-2)]"}`}
          onClick={() => setThemeMode("system")}
          title={`System mode${themeMode === "system" ? ` (${resolvedTheme})` : ""}`}
          type="button"
        >
          <ThemeSystemIcon />
        </button>
      </div>
      <div className="mx-auto flex h-full w-full max-w-7xl flex-col gap-4">
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface-1)] p-4 shadow-[0_10px_40px_rgba(31,41,55,0.12)] md:p-6">
          <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="mt-2 text-3xl font-black text-slate-900 md:text-4xl">MuhFweeCeeVee Composer</h1>
              <p className="mt-2 max-w-3xl text-sm text-[var(--ink-muted)]">
                Build, edit, and score bilingual CV variants with template-accurate PDF previews.
              </p>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            <button
              className={`rounded-md px-4 py-2 text-sm font-semibold ${
                activePanel === "workspace" ? "bg-[var(--accent)] text-white" : "bg-[var(--surface-2)] text-slate-800"
              }`}
              onClick={() => setActivePanel("workspace")}
              type="button"
            >
              Print Room
            </button>
            <button
              className={`rounded-md px-4 py-2 text-sm font-semibold ${
                activePanel === "editor" ? "bg-[var(--accent)] text-white" : "bg-[var(--surface-2)] text-slate-800"
              }`}
              onClick={() => setActivePanel("editor")}
              type="button"
            >
              Editor
            </button>
            <button
              className={`rounded-md px-4 py-2 text-sm font-semibold ${
                activePanel === "keywords" ? "bg-[var(--accent)] text-white" : "bg-[var(--surface-2)] text-slate-800"
              }`}
              onClick={() => setActivePanel("keywords")}
              type="button"
            >
              Keywords
            </button>
            <button
              className={`rounded-md px-4 py-2 text-sm font-semibold ${
                activePanel === "templates" ? "bg-[var(--accent)] text-white" : "bg-[var(--surface-2)] text-slate-800"
              }`}
              onClick={() => setActivePanel("templates")}
              type="button"
            >
              Templates
            </button>
          </div>

          {activePanel === "workspace" && (
            <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[340px_1fr]">
              <article className="min-h-0 overflow-auto rounded-xl border border-[var(--line)] bg-white p-4 pb-6">
                <h2 className="text-xl font-bold text-slate-900">Print Controls</h2>
                <p className="mt-2 text-sm text-[var(--ink-muted)]">
                  Select CV pair and template to render a real PDF preview.
                </p>

                <div className="mt-4 space-y-3">
                  <div>
                    <p className="mb-1 text-sm font-medium text-slate-800">Language</p>
                    <div className="flex items-center justify-center">
                      <div className="inline-flex w-[90%] overflow-hidden rounded-full border border-[var(--line)]">
                        <button
                          className={`flex-1 px-4 py-2 text-sm font-semibold ${
                            selectedLanguage === "bg" ? "bg-[var(--accent)] text-white" : "bg-white text-slate-800"
                          }`}
                          disabled={!variantPair?.bg}
                          onClick={() => switchLanguage("bg")}
                          type="button"
                        >
                          BG
                        </button>
                        <button
                          className={`flex-1 border-l border-[var(--line)] px-4 py-2 text-sm font-semibold ${
                            selectedLanguage === "en" ? "bg-[var(--accent)] text-white" : "bg-white text-slate-800"
                          }`}
                          disabled={!variantPair?.en}
                          onClick={() => switchLanguage("en")}
                          type="button"
                        >
                          EN
                        </button>
                      </div>
                    </div>
                  </div>

                  <label className="block text-sm font-medium text-slate-800">
                    CV Variant
                    <select
                      className="mt-1 w-full rounded-md border border-[var(--line)] bg-[var(--surface-1)] px-3 py-2"
                      onChange={(event) => switchCvPair(event.target.value)}
                      value={selectedPairKey}
                    >
                      {cvPairs.map((pair) => (
                        <option key={pair.key} value={pair.key}>
                          {pair.displayName} {pair.displayVersion}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-sm font-medium text-slate-800">
                    Template
                    <select
                      className="mt-1 w-full rounded-md border border-[var(--line)] bg-[var(--surface-1)] px-3 py-2"
                      onChange={(event) => setSelectedTemplateId(event.target.value)}
                      value={selectedTemplateId}
                    >
                      {orderedTemplateItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {templateDisplayName(item.name)} {item.version}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-sm font-medium text-slate-800">
                    Theme
                    <select
                      className="mt-1 w-full rounded-md border border-[var(--line)] bg-[var(--surface-1)] px-3 py-2 disabled:opacity-60"
                      disabled={selectedTemplateId !== "edinburgh-v1"}
                      onChange={(event) => {
                        setSelectedTemplateTheme(event.target.value);
                        setPreviewNonce(Date.now());
                      }}
                      value={selectedTemplateTheme}
                    >
                      {EDINBURGH_THEME_OPTIONS.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label} ({option.color})
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    className="w-24 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    disabled={!selectedCvId || !selectedTemplateId || loadingWorkspace}
                    onClick={refreshPreview}
                    type="button"
                  >
                    Refresh
                  </button>
                  <button
                    className="w-24 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60"
                    disabled={!pdfUrl}
                    onClick={openPdf}
                    type="button"
                  >
                    Open
                  </button>
                  <button
                    className="w-24 rounded-md border border-[var(--line)] bg-[var(--surface-2)] px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60"
                    disabled={!pdfUrl}
                    onClick={downloadPdf}
                    type="button"
                  >
                    Print
                  </button>
                </div>
              </article>

              <article className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--line)] bg-white">
                {pdfUrl ? (
                  <iframe className="h-full w-full" src={pdfUrl} title="CV PDF Preview" />
                ) : (
                  <div className="p-4 text-sm text-[var(--ink-muted)]">Select a CV and template to generate preview.</div>
                )}
              </article>
            </div>
          )}

          {activePanel === "editor" && (
            <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[360px_1fr]">
              <article className="min-h-0 overflow-auto rounded-xl border border-[var(--line)] bg-white p-4 pb-6">
                <h2 className="text-xl font-bold text-slate-900">Editor Controls</h2>
                <p className="mt-2 text-sm text-[var(--ink-muted)]">
                  Choose CV pair/language and section sub-tab, then edit in Form View or YAML View.
                </p>

                <div className="mt-4 space-y-3">
                  <div>
                    <p className="mb-1 text-sm font-medium text-slate-800">Language</p>
                    <div className="flex w-full items-center justify-center gap-2">
                      <div className="inline-flex w-[90%] overflow-hidden rounded-full border border-[var(--line)]">
                        <button
                          className={`flex-1 px-4 py-2 text-sm font-semibold ${
                            selectedLanguage === "bg" ? "bg-[var(--accent)] text-white" : "bg-white text-slate-800"
                          }`}
                          disabled={!variantPair?.bg}
                          onClick={() => switchLanguage("bg")}
                          type="button"
                        >
                          BG
                        </button>
                        <button
                          className={`flex-1 border-l border-[var(--line)] px-4 py-2 text-sm font-semibold ${
                            selectedLanguage === "en" ? "bg-[var(--accent)] text-white" : "bg-white text-slate-800"
                          }`}
                          disabled={!variantPair?.en}
                          onClick={() => switchLanguage("en")}
                          type="button"
                        >
                          EN
                        </button>
                      </div>
                      <button
                        className={`rounded-md border px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed ${
                          syncStatus?.canSync
                            ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                            : "border-[var(--line)] bg-[var(--surface-2)] text-slate-500"
                        }`}
                        disabled={syncing || !selectedCvId || !syncStatus?.canSync}
                        onClick={syncLanguagePair}
                        title={
                          syncStatus?.canSync
                            ? `SYNC ${syncStatus.sourceLanguage.toUpperCase()} -> ${syncStatus.targetLanguage.toUpperCase()}`
                            : "SYNC is enabled only when missing fields or last-edited timestamp difference is detected."
                        }
                        type="button"
                      >
                        {syncing ? "SYNC..." : "SYNC"}
                      </button>
                    </div>
                    {!syncStatus?.canSync ? (
                      <p className="mt-1 text-xs text-[var(--ink-muted)]">
                        SYNC disabled: BG and EN are currently in sync (no missing fields and no edit timestamp difference).
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-[var(--ink-muted)]">
                        SYNC ready: {syncStatus.hasMissingFields ? `${syncStatus.missingFieldCount} missing fields` : "no missing fields"}
                        {syncStatus.timestampsDiffer ? " + edit timestamp difference detected." : "."}
                      </p>
                    )}
                  </div>

                  <label className="block text-sm font-medium text-slate-800">
                    CV Variant
                    <select
                      className="mt-1 w-full rounded-md border border-[var(--line)] bg-[var(--surface-1)] px-3 py-2"
                      onChange={(event) => switchCvPair(event.target.value)}
                      value={selectedPairKey}
                    >
                      {cvPairs.map((pair) => (
                        <option key={pair.key} value={pair.key}>
                          {pair.displayName} {pair.displayVersion}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div>
                    <p className="mb-1 text-sm font-medium text-slate-800">Section Sub-tabs</p>
                    <div className="grid grid-cols-2 gap-2">
                      {EDITOR_TABS.map((tab) => (
                        <button
                          key={tab.key}
                          className={`rounded-md px-3 py-2 text-xs font-semibold ${
                            editorTab === tab.key ? "bg-[var(--accent)] text-white" : "bg-[var(--surface-2)] text-slate-800"
                          }`}
                          onClick={() => setEditorTab(tab.key)}
                          type="button"
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-md border border-[var(--line)] bg-[var(--surface-1)] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-800">OpenRouter Settings</p>
                      <button
                        className="rounded-md border border-[var(--line)] bg-white px-2 py-1 text-xs font-semibold text-slate-700"
                        onClick={() => setShowAiSettings((value) => !value)}
                        type="button"
                      >
                        {showAiSettings ? "Hide" : "Show"}
                      </button>
                    </div>
                    <p
                      className={`mt-1 break-all text-xs ${
                        settings?.hasApiKey ? "font-semibold text-[var(--ink-muted)]" : "text-[var(--ink-muted)]"
                      }`}
                    >
                      {settingsLoading
                        ? "Loading..."
                        : settings?.hasApiKey
                          ? `OpenRouter API configured (${settings.apiKeyMasked})`
                          : "No API key saved"}
                    </p>

                    {showAiSettings && (
                      <div className="mt-3 space-y-2">
                        <label className="block text-xs font-medium text-slate-700">
                          API Key
                          <input
                            className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-2 py-1.5 text-xs"
                            onChange={(event) => setApiKeyInput(event.target.value)}
                            placeholder={settings?.hasApiKey ? "Configured. Enter new key to replace." : "or-..."}
                            type="password"
                            value={apiKeyInput}
                          />
                        </label>
                        <label className="block text-xs font-medium text-slate-700">
                          Model
                          <select
                            className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-2 py-1.5 text-xs"
                            onChange={(event) => setModelInput(event.target.value)}
                            value={modelInput}
                          >
                            {!modelOptions.some((item) => item.id === modelInput) ? (
                              <option value={modelInput}>{modelInput}</option>
                            ) : null}
                            {modelOptions.map((item) => (
                              <option key={item.id} value={item.id}>
                                {modelOptionLabel(item)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block text-xs font-medium text-slate-700">
                          Base URL
                          <input
                            className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-2 py-1.5 text-xs"
                            onChange={(event) => setBaseUrlInput(event.target.value)}
                            value={baseUrlInput}
                          />
                        </label>
                        <button
                          className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                          disabled={settingsSaving}
                          onClick={saveAiSettings}
                          type="button"
                        >
                          Save Settings
                        </button>
                        {settingsNotice && <p className="text-xs text-[var(--ink-muted)]">{settingsNotice}</p>}
                      </div>
                    )}
                    <p className="mt-2 text-xs text-[var(--ink-muted)]">
                      {creditStatus?.label ?? "OpenRouter credit: checking..."}
                    </p>
                  </div>
                </div>
              </article>

              <article className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--line)] bg-white p-4 pb-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg font-bold text-slate-900">
                    Section Editor: {EDITOR_TABS.find((tab) => tab.key === editorTab)?.label}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    <div className="inline-flex overflow-hidden rounded-md border border-[var(--line)]">
                      <button
                        className={`px-3 py-1.5 text-xs font-semibold ${
                          editorView === "form" ? "bg-[var(--accent)] text-white" : "bg-white text-slate-800"
                        }`}
                        onClick={() => setEditorView("form")}
                        type="button"
                      >
                        Form View
                      </button>
                      <button
                        className={`border-l border-[var(--line)] px-3 py-1.5 text-xs font-semibold ${
                          editorView === "yaml" ? "bg-[var(--accent)] text-white" : "bg-white text-slate-800"
                        }`}
                        onClick={() => setEditorView("yaml")}
                        type="button"
                      >
                        YAML View
                      </button>
                    </div>
                    <button
                      className="rounded-md border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 disabled:opacity-60"
                      disabled={analysisLoading || !selectedCvId || !selectedTemplateId}
                      onClick={() => runAnalysis("section")}
                      type="button"
                    >
                      Score Section
                    </button>
                    <button
                      className="rounded-md border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 disabled:opacity-60"
                      disabled={analysisLoading || !selectedCvId || !selectedTemplateId}
                      onClick={() => runAnalysis("full")}
                      type="button"
                    >
                      Score Whole CV
                    </button>
                    <button
                      className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                      disabled={editorSaving || editorLoading || !selectedCvId}
                      onClick={saveEditorSection}
                      type="button"
                    >
                      Save Section
                    </button>
                  </div>
                </div>

                <p className="mt-2 text-xs text-[var(--ink-muted)]">
                  {selectedLanguage === "bg"
                    ? "Редактирайте секцията във форма или YAML. Записът обновява YAML варианта и snapshot историята."
                    : "Edit the section in form or YAML mode. Save updates the YAML variant and snapshot history."}
                </p>

                <div className="mt-3 grid min-h-0 flex-1 gap-3 md:grid-cols-[1fr_360px]">
                  <div className="min-h-0 overflow-auto rounded-md border border-[var(--line)] bg-[var(--surface-1)] p-3">
                    {editorLoading ? (
                      <p className="text-xs text-[var(--ink-muted)]">Loading CV...</p>
                    ) : editorView === "yaml" ? (
                      <div className="flex h-full min-h-[400px] flex-col rounded-md border border-[var(--line)] bg-white p-2">
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">YAML Editor</p>
                        <div
                          className={`relative min-h-0 flex-1 overflow-hidden rounded-md border ${
                            resolvedTheme === "dark"
                              ? "border-slate-700 bg-slate-900/85"
                              : "border-slate-200 bg-slate-50"
                          }`}
                        >
                          <div ref={yamlHighlightRef} aria-hidden className="pointer-events-none absolute inset-0 overflow-auto p-2 font-mono">
                            {yamlDraft.split("\n").map((line, index) => renderYamlLine(line, index))}
                          </div>
                          <textarea
                            ref={yamlTextareaRef}
                            className={`absolute inset-0 z-10 h-full w-full resize-none overflow-auto bg-transparent p-2 pl-[52px] font-mono text-xs leading-5 text-transparent outline-none ${
                              resolvedTheme === "dark"
                                ? "caret-slate-100 selection:bg-slate-500/50"
                                : "caret-slate-900 selection:bg-sky-200/70"
                            }`}
                            onChange={(event) => setYamlDraft(event.target.value.replace(/\t/g, "  "))}
                            onKeyDown={handleYamlEditorKeyDown}
                            onScroll={handleYamlEditorScroll}
                            spellCheck={false}
                            style={{ tabSize: 2 }}
                            value={yamlDraft}
                            wrap="off"
                          />
                        </div>
                        <div
                          className={`mt-2 rounded-md border px-2 py-1.5 text-[11px] ${
                            yamlLintIssues.length === 0
                              ? (resolvedTheme === "dark"
                                ? "border-emerald-700 bg-emerald-950/30 text-emerald-200"
                                : "border-emerald-200 bg-emerald-50 text-emerald-800")
                              : (resolvedTheme === "dark"
                                ? "border-rose-700 bg-rose-950/30 text-rose-200"
                                : "border-rose-200 bg-rose-50 text-rose-800")
                          }`}
                        >
                          {yamlLintIssues.length === 0 ? (
                            <p>YAML lint: ok</p>
                          ) : (
                            <div className="space-y-0.5">
                              <p className="font-semibold">YAML lint errors ({yamlLintIssues.length})</p>
                              {yamlLintIssues.map((issue) => (
                                <p key={issue}>• {issue}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      renderFormNode(
                        sectionDraft ?? {},
                        [],
                        editorPath,
                        EDITOR_TABS.find((tab) => tab.key === editorTab)?.label ?? editorTab,
                      )
                    )}
                  </div>

                  <div className="min-h-0 overflow-auto rounded-md border border-[var(--line)] bg-[var(--surface-1)] p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--ink-muted)]">AI Scoring Analysis</p>
                    {analysisLoading ? (
                      <p className="mt-2 text-xs text-[var(--ink-muted)]">Running analysis...</p>
                    ) : analysisData?.scope === "section" ? (
                      <div className="mt-2 space-y-3">
                        <div className="rounded-md border border-[var(--line)] bg-white p-2">
                          <p className="text-xs uppercase tracking-[0.08em] text-[var(--ink-muted)]">
                            Section: {analysisData.section ?? editorPath}
                          </p>
                          <p className={`mt-1 text-lg font-bold ${scoreTone(Number(analysisData.score ?? 0))}`}>
                            Score {Number(analysisData.score ?? 0)}/100
                          </p>
                          {analysisData.summary ? (
                            <p className="mt-1 text-xs text-slate-700">{analysisData.summary}</p>
                          ) : null}
                        </div>

                        {(analysisData.field_feedback ?? []).map((item, index) => (
                          <div key={`${item.field ?? "field"}-${index}`} className="rounded-md border border-[var(--line)] bg-white p-2">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-xs font-semibold text-slate-900">{item.field ?? `Field ${index + 1}`}</p>
                              <p className={`text-xs font-bold ${scoreTone(Number(item.score ?? 0))}`}>
                                {Number(item.score ?? 0)}/100
                              </p>
                            </div>
                            {item.analysis ? <p className="mt-1 text-xs text-slate-700">{item.analysis}</p> : null}
                            {item.proposal ? (
                              <div className="mt-1 rounded bg-[var(--surface-2)] px-2 py-1 text-xs text-slate-800">
                                <span className="font-semibold">Proposal:</span> {item.proposal}
                              </div>
                            ) : null}
                          </div>
                        ))}

                        {(analysisData.top_actions ?? []).length > 0 ? (
                          <div className="rounded-md border border-[var(--line)] bg-white p-2">
                            <p className="text-xs font-semibold text-slate-900">Top Actions</p>
                            <ul className="mt-1 list-disc pl-4 text-xs text-slate-700">
                              {(analysisData.top_actions ?? []).map((action, index) => (
                                <li key={`${action}-${index}`}>{action}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    ) : analysisData?.scope === "full" ? (
                      <div className="mt-2 space-y-3">
                        <div className="rounded-md border border-[var(--line)] bg-white p-2">
                          <p className={`text-lg font-bold ${scoreTone(Number(analysisData.overall_score ?? 0))}`}>
                            Overall Score {Number(analysisData.overall_score ?? 0)}/100
                          </p>
                          {analysisData.summary ? (
                            <p className="mt-1 text-xs text-slate-700">{analysisData.summary}</p>
                          ) : null}
                        </div>
                        {(analysisData.section_scores ?? []).map((section, index) => (
                          <div key={`${section.section ?? "section"}-${index}`} className="rounded-md border border-[var(--line)] bg-white p-2">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-xs font-semibold text-slate-900">{section.section ?? `Section ${index + 1}`}</p>
                              <p className={`text-xs font-bold ${scoreTone(Number(section.score ?? 0))}`}>
                                {Number(section.score ?? 0)}/100
                              </p>
                            </div>
                            {(section.issues ?? []).length > 0 ? (
                              <p className={`mt-1 text-xs ${resolvedTheme === "dark" ? "text-rose-300" : "text-rose-700"}`}>
                                Issues: {(section.issues ?? []).join("; ")}
                              </p>
                            ) : null}
                            {(section.improvements ?? []).length > 0 ? (
                              <p className="mt-1 text-xs text-slate-700">
                                Improvements: {(section.improvements ?? []).join("; ")}
                              </p>
                            ) : null}
                          </div>
                        ))}
                        {(analysisData.top_actions ?? []).length > 0 ? (
                          <div className="rounded-md border border-[var(--line)] bg-white p-2">
                            <p className="text-xs font-semibold text-slate-900">Top Actions</p>
                            <ul className="mt-1 list-disc pl-4 text-xs text-slate-700">
                              {(analysisData.top_actions ?? []).map((action, index) => (
                                <li key={`${action}-${index}`}>{action}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    ) : analysisText ? (
                      <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs leading-5 text-slate-800">
                        {analysisText}
                      </pre>
                    ) : (
                      <p className="mt-2 text-xs text-[var(--ink-muted)]">
                        Run section or full CV scoring to receive score, field-level analysis, and rewrite proposals.
                      </p>
                    )}
                  </div>
                </div>

                {editorNotice && <p className="mt-2 text-xs text-[var(--ink-muted)]">{editorNotice}</p>}
              </article>
            </div>
          )}

          {activePanel === "templates" && (
            <div className="flex h-full min-h-0 flex-col">
              <div className="grid min-h-0 flex-1 gap-4 overflow-auto md:grid-cols-2 xl:grid-cols-3">
                {orderedTemplateItems.map((item) => {
                  const galleryUrl = mostRecentCv
                    ? `/api/export/image?cvId=${encodeURIComponent(mostRecentCv.id)}&templateId=${encodeURIComponent(item.id)}&v=${previewNonce}`
                    : "";
                  return (
                    <article key={item.id} className="flex h-fit self-start flex-col rounded-xl border border-[var(--line)] bg-white p-3">
                      <h3 className="text-base font-bold text-slate-900">
                        {templateDisplayName(item.name)} {item.version}
                      </h3>
                      <div className="mb-3 mt-3 aspect-[210/297] w-full overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface-1)]">
                        {galleryUrl ? (
                          <Image
                            alt={`${item.id} preview`}
                            className="h-full w-full object-contain"
                            height={1755}
                            src={galleryUrl}
                            unoptimized
                            width={1242}
                          />
                        ) : (
                          <div className="p-3 text-xs text-[var(--ink-muted)]">No CV available for preview.</div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          )}

          {activePanel === "keywords" && renderKeywordStudio()}

          {keywordHover ? (
            <div
              className={`pointer-events-none fixed z-[120] w-[320px] rounded-lg border p-3 shadow-2xl ${
                resolvedTheme === "light"
                  ? "border-slate-200 bg-white text-slate-900"
                  : "border-slate-700 bg-slate-900 text-slate-100"
              }`}
              style={{ left: keywordHover.left, top: keywordHover.top }}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold leading-5">{keywordHover.label}</p>
                <span
                  className={`inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${keywordSourceBadgeClass(keywordHover.metric.source, resolvedTheme)}`}
                >
                  {keywordSourceLabel(keywordHover.metric.source)}
                </span>
              </div>
              <div className={`mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] ${resolvedTheme === "light" ? "text-slate-700" : "text-slate-300"}`}>
                <p>Status</p>
                <span
                  className={`justify-self-end rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${keywordStatusBadgeClass(keywordHover.metric.status, resolvedTheme)}`}
                >
                  {keywordHover.metric.status}
                </span>
                <p>Category</p>
                <p className="justify-self-end text-right font-medium text-current">{prettyKey(keywordHover.metric.category ?? "general")}</p>
                <p>Hits</p>
                <p className="justify-self-end font-medium text-current">
                  {keywordHover.metric.cvHits}/{keywordHover.metric.targetHits}
                </p>
                <p>Usage</p>
                <p className="justify-self-end font-medium text-current">
                  {(keywordHover.metric.usageRatio * 100).toFixed(0)}%
                </p>
                <p>Weight</p>
                <p className="justify-self-end font-medium text-current">{keywordHover.metric.weight.toFixed(1)}</p>
              </div>
              <div className={`mt-2 rounded-md border px-2 py-1.5 text-[11px] leading-4 ${
                resolvedTheme === "light"
                  ? "border-slate-200 bg-slate-50 text-slate-700"
                  : "border-slate-700 bg-slate-800 text-slate-200"
              }`}>
                {keywordHover.metric.recommendation}
              </div>
            </div>
          ) : null}
          {syncReport?.open ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
              <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-[var(--line)] bg-white shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] px-5 py-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--ink-muted)]">SYNC Report</p>
                    <h3 className="mt-1 text-lg font-bold text-slate-900">
                      {syncReport.direction} • {syncReport.changed ? `${syncReport.changes.length} field updates` : "No updates"}
                    </h3>
                    <p className="mt-1 text-xs text-[var(--ink-muted)]">
                      Source: {syncReport.sourceCvId} • Target: {syncReport.targetCvId || "n/a"}
                    </p>
                    <p className="mt-1 text-xs text-slate-700">{syncReport.message}</p>
                  </div>
                  <button
                    className="rounded-md border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                    onClick={() => setSyncReport((current) => (current ? { ...current, open: false } : current))}
                    type="button"
                  >
                    Close
                  </button>
                </div>

                <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
                  {syncReport.changed && syncReport.changes.length > 0 ? (
                    <div className="space-y-3">
                      {syncReport.changes.map((change, index) => (
                        <article key={`${change.path}-${index}`} className="rounded-lg border border-[var(--line)] bg-[var(--surface-1)] p-3">
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <p className="font-mono text-xs font-semibold text-slate-900">{change.path}</p>
                            <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-700">
                              {change.direction}
                            </span>
                          </div>
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="rounded-md border border-[var(--line)] bg-white p-2">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-muted)]">
                                Previous Target Value
                              </p>
                              <pre className="mt-1 whitespace-pre-wrap break-words text-xs text-slate-700">
                                {formatDiffValue(change.previousTargetValue)}
                              </pre>
                            </div>
                            <div className="rounded-md border border-[var(--line)] bg-white p-2">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-muted)]">
                                New Target Value
                              </p>
                              <pre className="mt-1 whitespace-pre-wrap break-words text-xs text-slate-900">
                                {formatDiffValue(change.nextTargetValue)}
                              </pre>
                            </div>
                          </div>
                          <div className="mt-2 rounded-md border border-[var(--line)] bg-white p-2">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-muted)]">
                              Source of Truth ({change.sourceLanguage.toUpperCase()})
                            </p>
                            <pre className="mt-1 whitespace-pre-wrap break-words text-xs text-slate-700">
                              {formatDiffValue(change.sourceValue)}
                            </pre>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--ink-muted)]">No missing fields were detected in the target language variant.</p>
                  )}
                </div>

                <div className="flex justify-end border-t border-[var(--line)] px-5 py-3">
                  <button
                    className="rounded-md bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-white"
                    onClick={() => setSyncReport((current) => (current ? { ...current, open: false } : current))}
                    type="button"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          {keywordRunModalOpen && keywordRunStatus ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="w-full max-w-2xl rounded-xl border border-[var(--line)] bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">JD Collection Run</p>
                    <p className="text-xs text-slate-600">Run ID: {keywordRunStatus.runId}</p>
                  </div>
                  <button
                    className="rounded-md border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                    onClick={() => setKeywordRunModalOpen(false)}
                    type="button"
                  >
                    Close
                  </button>
                </div>
                <div className="space-y-3 px-4 py-3">
                  <p className="text-xs text-slate-700">
                    Status: <span className="font-semibold">{keywordRunStatus.phase}</span> ({keywordRunStatus.state})
                  </p>
                  <p className="text-xs text-slate-600">
                    This run uses role-expanded seeds and URL/content-hash dedupe, so repeated profiles are skipped and new unique profiles are prioritized.
                  </p>
                  <p className="text-xs text-slate-600">
                    Scrape scope per run is expanded (up to 2400 pages, depth 2, up to 50000 profiles before ranking).
                  </p>
                  <div className="h-56 overflow-auto rounded-md border border-[var(--line)] bg-slate-50 p-2">
                    {(keywordRunStatus.logs ?? []).length > 0 ? (
                      (keywordRunStatus.logs ?? []).map((line, index) => (
                        <p key={`run-log-${index}`} className="font-mono text-[11px] leading-5 text-slate-700">
                          {line}
                        </p>
                      ))
                    ) : (
                      <p className="text-xs text-slate-600">Waiting for logs...</p>
                    )}
                  </div>
                  {keywordRunStatus.state === "completed" ? (
                    <p className="text-xs font-semibold text-emerald-700">
                      Completed. Core database refreshed to {keywordRunStatus.mergedItems ?? 0} profiles.
                    </p>
                  ) : null}
                  {keywordRunStatus.state === "failed" ? (
                    <p className="text-xs font-semibold text-rose-700">
                      Failed: {keywordRunStatus.error ?? "Unknown error"}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
