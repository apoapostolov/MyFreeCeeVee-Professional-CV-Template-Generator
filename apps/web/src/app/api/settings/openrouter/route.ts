import { NextResponse } from "next/server";

import { getOpenRouterModels } from "@/lib/server/openRouterModels";
import {
  maskApiKey,
  readOpenRouterSettings,
  writeOpenRouterSettings,
} from "@/lib/server/openRouterSettings";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const settings = await readOpenRouterSettings();
  const models = await getOpenRouterModels({
    apiKey: settings.apiKey,
    forceRefresh: false,
  });
  return NextResponse.json({
    hasApiKey: settings.apiKey.length > 0,
    apiKeyMasked: maskApiKey(settings.apiKey),
    model: settings.model,
    baseUrl: settings.baseUrl,
    updatedAt: settings.updatedAt,
    models: models.models,
    modelsFetchedAt: models.fetchedAt,
    modelsFromCache: models.fromCache,
  });
}

export async function PUT(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as {
    apiKey?: unknown;
    model?: unknown;
    baseUrl?: unknown;
  };

  const updated = await writeOpenRouterSettings({
    apiKey: typeof body.apiKey === "string" ? body.apiKey : undefined,
    model: typeof body.model === "string" ? body.model : undefined,
    baseUrl: typeof body.baseUrl === "string" ? body.baseUrl : undefined,
  });
  const models = await getOpenRouterModels({
    apiKey: updated.apiKey,
    forceRefresh: true,
  });

  return NextResponse.json({
    ok: true,
    note:
      typeof body.apiKey === "string" && body.apiKey.trim().length > 0
        ? "API key is not persisted in repository settings; use OPENROUTER_API_KEY in .env."
        : undefined,
    hasApiKey: updated.apiKey.length > 0,
    apiKeyMasked: maskApiKey(updated.apiKey),
    model: updated.model,
    baseUrl: updated.baseUrl,
    updatedAt: updated.updatedAt,
    models: models.models,
    modelsFetchedAt: models.fetchedAt,
    modelsFromCache: models.fromCache,
  });
}
