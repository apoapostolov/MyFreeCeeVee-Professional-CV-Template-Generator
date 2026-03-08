import fs from "node:fs/promises";
import path from "node:path";

import { parse, stringify } from "yaml";

import { repoPath } from "./repoPaths";

export type OpenRouterModelOption = {
  id: string;
  name: string;
  contextLength: number | null;
  promptPricePer1M: number | null;
  completionPricePer1M: number | null;
  mixedPricePer1M: number | null;
  isFree: boolean;
  supportsImageGeneration: boolean;
};

type ModelCacheFile = {
  fetchedAt: string;
  models: OpenRouterModelOption[];
};

const MODELS_DIR = repoPath("data", "settings");
const MODELS_FILE = path.join(MODELS_DIR, "openrouter_models.yaml");
const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
const CACHE_MAX_AGE_MS = 72 * 60 * 60 * 1000;

function parseNumberish(input: unknown): number | null {
  if (typeof input === "number" && Number.isFinite(input)) {
    return input;
  }
  if (typeof input === "string") {
    const value = Number(input.trim());
    return Number.isFinite(value) ? value : null;
  }
  return null;
}

async function readModelCache(): Promise<ModelCacheFile | null> {
  try {
    const raw = await fs.readFile(MODELS_FILE, "utf-8");
    const parsed = parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    const record = parsed as Record<string, unknown>;
    const models = Array.isArray(record.models)
      ? record.models
          .map((item) => {
            if (!item || typeof item !== "object" || Array.isArray(item)) return null;
            const model = item as Record<string, unknown>;
            const id = typeof model.id === "string" ? model.id.trim() : "";
            if (!id) return null;
            return {
              id,
              name:
                typeof model.name === "string" && model.name.trim().length > 0
                  ? model.name.trim()
                  : id,
              contextLength:
                typeof model.contextLength === "number" && Number.isFinite(model.contextLength)
                  ? model.contextLength
                  : null,
              promptPricePer1M: parseNumberish(model.promptPricePer1M),
              completionPricePer1M: parseNumberish(model.completionPricePer1M),
              mixedPricePer1M: parseNumberish(model.mixedPricePer1M),
              isFree: Boolean(model.isFree),
              supportsImageGeneration: Boolean(model.supportsImageGeneration),
            } satisfies OpenRouterModelOption;
          })
          .filter((item): item is OpenRouterModelOption => Boolean(item))
      : [];

    return {
      fetchedAt: typeof record.fetchedAt === "string" ? record.fetchedAt : "",
      models,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function writeModelCache(models: OpenRouterModelOption[]): Promise<ModelCacheFile> {
  const cache: ModelCacheFile = {
    fetchedAt: new Date().toISOString(),
    models,
  };
  await fs.mkdir(MODELS_DIR, { recursive: true });
  await fs.writeFile(MODELS_FILE, stringify(cache), "utf-8");
  return cache;
}

function isFresh(cache: ModelCacheFile | null): boolean {
  if (!cache?.fetchedAt) return false;
  const ts = Date.parse(cache.fetchedAt);
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts < CACHE_MAX_AGE_MS;
}

async function fetchModelsFromOpenRouter(apiKey?: string): Promise<OpenRouterModelOption[]> {
  const headers: Record<string, string> = {};
  if (apiKey && apiKey.trim().length > 0) {
    headers.authorization = `Bearer ${apiKey.trim()}`;
  }

  const response = await fetch(OPENROUTER_MODELS_URL, { headers });
  if (!response.ok) {
    throw new Error(`OpenRouter models request failed (${response.status}).`);
  }
  const payload = (await response.json()) as {
    data?: Array<Record<string, unknown> & {
      id?: string;
      name?: string;
      context_length?: number;
      pricing?: {
        prompt?: string;
        completion?: string;
        input?: string;
        output?: string;
      };
    }>;
  };

  function asStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.map((entry) => String(entry ?? "").trim().toLowerCase()).filter(Boolean);
  }

  function supportsImageGenerationFromModel(item: Record<string, unknown>): boolean {
    const directOutputModalities = asStringArray(item.output_modalities);
    if (directOutputModalities.includes("image")) return true;

    const architecture = item.architecture;
    if (architecture && typeof architecture === "object" && !Array.isArray(architecture)) {
      const architectureRecord = architecture as Record<string, unknown>;
      const outputModalities = asStringArray(
        architectureRecord.output_modalities ?? architectureRecord.modalities_out,
      );
      if (outputModalities.includes("image")) return true;
      const modality = String(architectureRecord.modality ?? "").toLowerCase();
      if (modality.includes("image->image") || modality.includes("text->image")) return true;
    }

    const endpoints = asStringArray(item.endpoints);
    if (endpoints.some((endpoint) => endpoint.includes("image"))) return true;

    const supportedGenerationTypes = asStringArray(item.supported_generation_types);
    if (supportedGenerationTypes.includes("image")) return true;

    const id = String(item.id ?? "").toLowerCase();
    return id.includes("image") && !id.includes("vision");
  }

  const models = (payload.data ?? [])
    .map((item) => {
      const id = (item.id ?? "").trim();
      if (!id) return null;
      const promptPerToken = parseNumberish(item.pricing?.prompt) ?? parseNumberish(item.pricing?.input);
      const completionPerToken = parseNumberish(item.pricing?.completion) ?? parseNumberish(item.pricing?.output);
      const promptPricePer1M = promptPerToken !== null ? promptPerToken * 1_000_000 : null;
      const completionPricePer1M = completionPerToken !== null ? completionPerToken * 1_000_000 : null;
      const mixedPricePer1M =
        promptPricePer1M !== null && completionPricePer1M !== null
          ? (promptPricePer1M + completionPricePer1M) / 2
          : promptPricePer1M ?? completionPricePer1M ?? null;
      const isFree =
        (promptPricePer1M ?? 0) <= 0.0000001 &&
        (completionPricePer1M ?? 0) <= 0.0000001;
      return {
        id,
        name: (item.name ?? "").trim() || id,
        contextLength:
          typeof item.context_length === "number" && Number.isFinite(item.context_length)
            ? item.context_length
            : null,
        promptPricePer1M,
        completionPricePer1M,
        mixedPricePer1M,
        isFree,
        supportsImageGeneration: supportsImageGenerationFromModel(item),
      } satisfies OpenRouterModelOption;
    })
    .filter((item): item is OpenRouterModelOption => Boolean(item))
    .sort((a, b) => a.id.localeCompare(b.id));

  return models;
}

function hasPricing(model: OpenRouterModelOption): boolean {
  return model.promptPricePer1M !== null || model.completionPricePer1M !== null || model.mixedPricePer1M !== null;
}

function isPricingIncomplete(cache: ModelCacheFile | null): boolean {
  if (!cache || !cache.models.length) return false;
  return cache.models.every((model) => !hasPricing(model));
}

export async function getOpenRouterModels(options?: {
  apiKey?: string;
  forceRefresh?: boolean;
}): Promise<{
  fetchedAt: string;
  models: OpenRouterModelOption[];
  fromCache: boolean;
}> {
  const cache = await readModelCache();
  if (!options?.forceRefresh && isFresh(cache) && !isPricingIncomplete(cache)) {
    return {
      fetchedAt: cache?.fetchedAt ?? "",
      models: cache?.models ?? [],
      fromCache: true,
    };
  }

  try {
    const fresh = await fetchModelsFromOpenRouter(options?.apiKey);
    const written = await writeModelCache(fresh);
    return {
      fetchedAt: written.fetchedAt,
      models: written.models,
      fromCache: false,
    };
  } catch {
    // If an API key is configured but invalid/expired, retry the public models API
    // without Authorization so pricing metadata can still be loaded for the UI.
    if (options?.apiKey && options.apiKey.trim().length > 0) {
      try {
        const fresh = await fetchModelsFromOpenRouter(undefined);
        const written = await writeModelCache(fresh);
        return {
          fetchedAt: written.fetchedAt,
          models: written.models,
          fromCache: false,
        };
      } catch {
        // Fall through to cache fallback below.
      }
    }

    if (cache) {
      return {
        fetchedAt: cache.fetchedAt,
        models: cache.models,
        fromCache: true,
      };
    }
    return {
      fetchedAt: "",
      models: [],
      fromCache: true,
    };
  }
}
