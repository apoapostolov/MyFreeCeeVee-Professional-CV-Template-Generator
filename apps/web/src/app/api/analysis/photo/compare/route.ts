import { NextResponse } from "next/server";

import { appendPhotoComparison, getPhotoComparisonHistory } from "@/lib/server/photoAnalysisStore";
import { readOpenRouterSettings } from "@/lib/server/openRouterSettings";

export const runtime = "nodejs";

type CompareRequest = {
  images?: unknown;
  imageIds?: unknown;
  lookupOnly?: unknown;
  forceNew?: unknown;
  leftImageDataUrl?: unknown;
  rightImageDataUrl?: unknown;
  leftName?: unknown;
  rightName?: unknown;
};

type CompareAnalysis = {
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

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => String(entry ?? "").trim())
    .filter((entry) => entry.length > 0)
    .slice(0, 8);
}

function normalizeScore(value: unknown, fallback: number): number {
  const raw = Number(value);
  if (!Number.isFinite(raw)) return fallback;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

function normalizeVerdict(value: unknown, score: number): "excellent" | "good" | "usable" | "weak" {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "excellent" || raw === "good" || raw === "usable" || raw === "weak") return raw;
  if (score >= 85) return "excellent";
  if (score >= 70) return "good";
  if (score >= 55) return "usable";
  return "weak";
}

function normalizeCompare(raw: unknown, model: string): CompareAnalysis {
  const record =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
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
      return {
        name,
        summary: String(item.summary ?? "").trim(),
      };
    })
    .filter((entry): entry is CompareAnalysis["criteria"][number] => entry !== null)
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
      const score = normalizeScore(item.score, 60);
      return {
        name,
        score,
        verdict: normalizeVerdict(item.verdict, score),
        strengths: normalizeStringList(item.strengths),
        risks: normalizeStringList(item.risks),
        improvements: normalizeStringList(item.improvements),
      };
    })
    .filter((entry): entry is CompareAnalysis["ranked"][number] => entry !== null)
    .slice(0, 16);

  return {
    criteria,
    ranked,
    winnerName: String(record.winnerName ?? "").trim() || ranked[0]?.name || "",
    recommendation:
      String(record.recommendation ?? "").trim()
      || "Use the highest-ranked image with the cleanest framing, strongest lighting, and most professional presentation.",
    recommendationDetails: normalizeStringList(record.recommendationDetails),
    analyzedAt: new Date().toISOString(),
    model,
  };
}

export async function POST(request: Request): Promise<NextResponse> {
  const payload = (await request.json()) as CompareRequest;
  const lookupOnly = payload.lookupOnly === true;
  const forceNew = payload.forceNew === true;
  const imagesRaw = Array.isArray(payload.images) ? payload.images : [];
  const imageIds = Array.isArray(payload.imageIds)
    ? payload.imageIds.map((id) => String(id ?? "").trim()).filter(Boolean)
    : [];
  const normalizedImages = imagesRaw
    .map((entry, index) => {
      const item =
        entry && typeof entry === "object" && !Array.isArray(entry)
          ? (entry as Record<string, unknown>)
          : null;
      if (!item) return null;
      const imageDataUrl = typeof item.imageDataUrl === "string" ? item.imageDataUrl.trim() : "";
      if (!imageDataUrl.startsWith("data:image/")) return null;
      const name =
        typeof item.name === "string" && item.name.trim().length > 0
          ? item.name.trim()
          : `Image ${index + 1}`;
      return { imageDataUrl, name };
    })
    .filter((entry): entry is { imageDataUrl: string; name: string } => entry !== null);

  if (normalizedImages.length === 0) {
    const leftImageDataUrl =
      typeof payload.leftImageDataUrl === "string" ? payload.leftImageDataUrl.trim() : "";
    const rightImageDataUrl =
      typeof payload.rightImageDataUrl === "string" ? payload.rightImageDataUrl.trim() : "";
    if (leftImageDataUrl.startsWith("data:image/")) {
      normalizedImages.push({
        imageDataUrl: leftImageDataUrl,
        name:
          typeof payload.leftName === "string" && payload.leftName.trim().length > 0
            ? payload.leftName.trim()
            : "Image 1",
      });
    }
    if (rightImageDataUrl.startsWith("data:image/")) {
      normalizedImages.push({
        imageDataUrl: rightImageDataUrl,
        name:
          typeof payload.rightName === "string" && payload.rightName.trim().length > 0
            ? payload.rightName.trim()
            : "Image 2",
      });
    }
  }

  if (normalizedImages.length < 2) {
    return NextResponse.json({ error: "Provide at least 2 valid images." }, { status: 400 });
  }

  if (imageIds.length >= 2 && !forceNew) {
    const cachedHistory = await getPhotoComparisonHistory(imageIds);
    if (cachedHistory.length > 0) {
      return NextResponse.json({ ok: true, comparison: cachedHistory[0], history: cachedHistory, cached: true });
    }
  }

  if (lookupOnly) {
    return NextResponse.json({ ok: true, comparison: null, history: [], cached: false });
  }

  const settings = await readOpenRouterSettings();
  const apiKey = settings.apiKey || process.env.OPENROUTER_API_KEY || "";
  if (!apiKey) {
    return NextResponse.json({ error: "OpenRouter API key is not configured." }, { status: 400 });
  }

  const model = settings.model || "openai/gpt-4o-mini";
  const prompt = [
    "You compare multiple CV profile photos for professional hiring contexts.",
    "Score each image (0-100) and compare all images using these factors: composition/crop, lighting/sharpness, expression/posture, professionalism/background, print readability.",
    "Return a ranking from best to worst, and concrete improvement advice for each image.",
    "Then recommend the single best image for CV usage.",
    "Rules:",
    "- Keep feedback concrete and actionable.",
    "- Never infer or discuss protected traits.",
    'Return strict JSON only with this schema: {"criteria":[{"name":"...","summary":"cross-image comparison summary"}],"ranked":[{"name":"...","score":0-100,"verdict":"excellent|good|usable|weak","strengths":["..."],"risks":["..."],"improvements":["..."]}],"winnerName":"name of best image","recommendation":"...","recommendationDetails":["..."]}',
  ].join("\n");

  const response = await fetch(settings.baseUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `${prompt}\nImages (${normalizedImages.length}):\n${normalizedImages
                .map((image, index) => `${index + 1}. ${image.name}`)
                .join("\n")}`,
            },
            ...normalizedImages.map((image) => ({ type: "image_url", image_url: { url: image.imageDataUrl } })),
          ],
        },
      ],
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const raw = await response.text();
    return NextResponse.json(
      { error: "OpenRouter request failed.", status: response.status, raw },
      { status: 502 },
    );
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content ?? "";
  const parsed = extractFirstJsonBlock(content);
  const comparison = normalizeCompare(parsed, model);
  let history = [comparison];
  if (imageIds.length >= 2) {
    history = await appendPhotoComparison(imageIds, comparison);
  }
  return NextResponse.json({ ok: true, comparison, history, cached: false });
}
