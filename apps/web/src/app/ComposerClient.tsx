"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { JSX } from "react";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

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
  }>;
  cv?: Record<string, unknown>;
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
    isPrototype: boolean;
  }>;
};

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

  const [cvItems, setCvItems] = useState<CvListResponse["items"]>([]);
  const [templateItems, setTemplateItems] = useState<TemplateListResponse["items"]>([]);
  const [selectedCvId, setSelectedCvId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [previewNonce, setPreviewNonce] = useState(Date.now());
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<"bg" | "en">("bg");

  const [editorTab, setEditorTab] = useState<EditorTabKey>("person");
  const [editorView, setEditorView] = useState<EditorViewMode>("form");
  const [editorCv, setEditorCv] = useState<Record<string, unknown> | null>(null);
  const [sectionDraft, setSectionDraft] = useState<unknown>(null);
  const [yamlDraft, setYamlDraft] = useState("");
  const [editorLoading, setEditorLoading] = useState(false);
  const [editorSaving, setEditorSaving] = useState(false);
  const [editorNotice, setEditorNotice] = useState("");

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
  const [keywordDatasetLoading, setKeywordDatasetLoading] = useState(false);
  const [keywordStudioLoading, setKeywordStudioLoading] = useState(false);
  const [keywordStudioError, setKeywordStudioError] = useState("");
  const [keywordStudioData, setKeywordStudioData] = useState<KeywordStudioResponse | null>(null);
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
    const tokenIndex = new Map<string, { keyword: string; normalized: number; band: KeywordBand; weight: number }>();
    const phraseIndex = new Map<string, { keyword: string; normalized: number; band: KeywordBand; weight: number }>();
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
    return `/api/export/pdf?${params.toString()}`;
  }, [previewNonce, selectedCvId, selectedTemplateId]);

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
        const response = await fetch(`/api/analysis/keywords?${params.toString()}`);
        const payload = (await response.json()) as KeywordStudioResponse;
        if (cancelled) return;
        if (!response.ok || payload.error) {
          setKeywordStudioData(null);
          setKeywordStudioError(payload.error ?? "Failed to load keyword analysis.");
          return;
        }
        setKeywordStudioData(payload);
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
  }, [previewNonce, selectedCvId, selectedCvMeta?.language, selectedKeywordDataset, variantPair?.en?.id]);

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
    if (score >= 85) return "text-emerald-700";
    if (score >= 70) return "text-amber-700";
    return "text-rose-700";
  }

  function keywordBandClass(band: KeywordBand): string {
    if (band === "red") return "border-red-300 bg-red-50 text-red-900";
    if (band === "orange") return "border-orange-300 bg-orange-50 text-orange-900";
    if (band === "yellow") return "border-yellow-300 bg-yellow-50 text-yellow-900";
    if (band === "green") return "border-emerald-300 bg-emerald-50 text-emerald-900";
    return "border-slate-300 bg-slate-100 text-slate-700";
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

  function fuzzyKeywordForToken(token: string): { keyword: string; normalized: number; band: KeywordBand } | null {
    const normalized = normalizeToken(token);
    if (normalized.length < 3) return null;

    const exact = keywordMatcher.tokenIndex.get(normalized);
    if (exact) {
      return exact;
    }

    let best: { keyword: string; normalized: number; band: KeywordBand; score: number } | null = null;
    for (const [candidate, metric] of keywordMatcher.tokenIndex.entries()) {
      if (Math.abs(candidate.length - normalized.length) > 2) continue;
      const similarity = diceSimilarity(normalized, candidate);
      if (similarity < 0.86) continue;
      if (!best || similarity > best.score) {
        best = { ...metric, score: similarity };
      }
    }
    if (!best) return null;
    return { keyword: best.keyword, normalized: best.normalized, band: best.band };
  }

  function keywordForPhrase(tokens: string[]): { keyword: string; normalized: number; band: KeywordBand } | null {
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
            metric: { keyword: string; normalized: number; band: KeywordBand };
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
        nodes.push(
          <span
            key={`phrase-${i}-${matched.endIndex}`}
            className={`inline-flex rounded-md border px-1.5 py-[1px] ${keywordBandClass(matched.metric.band)}`}
            title={`${matched.metric.keyword} • ${(matched.metric.normalized * 100).toFixed(0)} importance`}
          >
            {matched.rawText}
          </span>,
        );
        i = matched.endIndex + 1;
        continue;
      }

      const hit = fuzzyKeywordForToken(raw);
      if (!hit) {
        nodes.push(<span key={`txt-${i}`}>{raw}</span>);
        i += 1;
        continue;
      }

      nodes.push(
        <span
          key={`tag-${i}`}
          className={`inline-flex rounded-md border px-1 py-[1px] ${keywordBandClass(hit.band)}`}
          title={`${hit.keyword} • ${(hit.normalized * 100).toFixed(0)} importance`}
        >
          {raw}
        </span>,
      );
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

  function refreshPreview() {
    setPreviewNonce(Date.now());
  }

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

            return (
              <article key={`exp-${index}`} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-base font-semibold text-slate-900">{renderKeywordAwareText(String(role.occupation ?? "Role"))}</p>
                    <p className="text-sm text-slate-700">{renderKeywordAwareText(String(role.employer ?? "Employer"))}</p>
                  </div>
                  <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-xs font-semibold text-slate-600">{range}</span>
                </div>

                <div className="mt-2 divide-y divide-slate-200">
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

    const person = asRecord(cvRoot.person);
    const contact = asRecord(person?.contact);
    const positioning = asRecord(cvRoot.positioning);
    const clusters = keywordStudioData?.clusters ?? [];
    const keywords = (keywordStudioData?.keywords ?? []).slice(0, 24);

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
          </div>

          <div className="mt-3 rounded-md border border-[var(--line)] bg-[var(--surface-1)] p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--ink-muted)]">Dataset Snapshot</p>
            <p className="mt-1 text-xs text-slate-700">Dataset ID: {keywordStudioData?.datasetId ?? "n/a"}</p>
            <p className="mt-1 text-xs text-slate-700">Relevant JDs: {keywordStudioData?.jdRelevantCount ?? 0}</p>
            <p className="mt-1 text-xs text-slate-700">Source: {keywordStudioData?.sourceFile ?? "n/a"}</p>
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
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--ink-muted)]">Top Keyword Weights</p>
            <div className="mt-2 space-y-2">
              {keywords.map((item) => (
                <div key={item.keyword} className="rounded-md border border-[var(--line)] bg-white p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold ${keywordBandClass(item.band)}`}>
                      {item.keyword}
                    </span>
                    <span className="text-xs font-bold text-slate-700">{item.weight.toFixed(1)}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-600">
                    CV hits {item.cvHits} • JD freq {item.docFreq} • usage score {(item.cvCoverage * 100).toFixed(0)}%
                  </p>
                </div>
              ))}
            </div>
          </div>
        </article>

        <article className="min-h-0 overflow-auto rounded-xl border border-[var(--line)] bg-[#fcfcfd] p-5">
          <div className="mx-auto w-full max-w-[920px] rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="grid border-b border-slate-200 md:grid-cols-[250px_1fr]">
              <div className="border-r border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Personal Information</p>
                <h3 className="mt-2 text-2xl font-bold leading-tight text-slate-900">
                  {String(person?.full_name ?? "Unnamed Candidate")}
                </h3>
                <div className="mt-3 divide-y divide-slate-200 text-sm text-slate-700">
                  {collectKeywordRows(
                    {
                      email: contact?.email,
                      phone: contact?.phone_e164,
                      residence: person?.residence,
                    },
                    ["person"],
                  ).map((row, index) => (
                    <div key={`personal-row-${index}`} className="grid gap-1 py-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-slate-500">{row.label}</p>
                      <p>{renderKeywordAwareText(row.value)}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Profile</p>
                <div className="mt-2 divide-y divide-slate-100">
                  {collectKeywordRows(positioning?.profile_summary, ["positioning", "profile_summary"]).map((row, index) => (
                    <div key={`sum-${index}`} className="grid gap-1 py-2 md:grid-cols-[180px_1fr] md:gap-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">{row.label}</p>
                      <p className="text-sm leading-6 text-slate-800">{renderKeywordAwareText(row.value)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3 p-4">
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
    <main className="paper-grid grain-overlay h-screen overflow-hidden px-4 py-4 md:px-8 md:py-6">
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
                activePanel === "templates" ? "bg-[var(--accent)] text-white" : "bg-[var(--surface-2)] text-slate-800"
              }`}
              onClick={() => setActivePanel("templates")}
              type="button"
            >
              Templates
            </button>
            <button
              className={`rounded-md px-4 py-2 text-sm font-semibold ${
                activePanel === "keywords" ? "bg-[var(--accent)] text-white" : "bg-[var(--surface-2)] text-slate-800"
              }`}
              onClick={() => setActivePanel("keywords")}
              type="button"
            >
              Keyword Studio
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
                      <textarea
                        className="h-full min-h-[400px] w-full resize-none bg-transparent font-mono text-xs leading-5 outline-none"
                        onChange={(event) => setYamlDraft(event.target.value)}
                        value={yamlDraft}
                      />
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
                              <p className="mt-1 text-xs text-rose-700">Issues: {(section.issues ?? []).join("; ")}</p>
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
        </section>
      </div>
    </main>
  );
}
