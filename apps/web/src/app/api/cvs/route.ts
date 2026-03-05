import { validateCvV1 } from "@myfreeceevee/schemas";
import { NextResponse } from "next/server";

import { buildCvVariantId, isSupportedLanguage } from "@/lib/server/cvVariants";
import { listCvVariants, readCv, writeCv } from "@/lib/server/cvStore";

export const runtime = "nodejs";

function toCvId(input: unknown): string | null {
  if (typeof input !== "string") {
    return null;
  }
  const normalized = input.trim();
  return normalized.length > 0 ? normalized : null;
}

export async function GET(): Promise<NextResponse> {
  const items = await listCvVariants();
  return NextResponse.json({ items });
}

export async function POST(request: Request): Promise<NextResponse> {
  const payload = (await request.json()) as {
    cvId?: unknown;
    cv?: unknown;
    language?: unknown;
    iteration?: unknown;
    target?: unknown;
  };

  const cv = payload.cv;
  const explicitCvId = toCvId(payload.cvId);
  const language =
    typeof payload.language === "string" && isSupportedLanguage(payload.language)
      ? payload.language
      : null;
  const iteration =
    typeof payload.iteration === "string" && /^[0-9]{4}$/.test(payload.iteration)
      ? payload.iteration
      : null;
  const target =
    typeof payload.target === "string" && /^[a-z0-9][a-z0-9_-]{1,79}$/i.test(payload.target)
      ? payload.target.toLowerCase()
      : null;

  const cvId =
    explicitCvId ??
    (language && iteration && target
      ? buildCvVariantId({ language, iteration, target })
      : null);

  if (!cvId) {
    return NextResponse.json(
      {
        error:
          "Provide cvId or provide language + iteration + target for variant-based ID generation.",
      },
      { status: 400 },
    );
  }

  const validation = validateCvV1(cv);
  if (!validation.valid) {
    return NextResponse.json(
      { error: "cv payload failed validation.", issues: validation.issues },
      { status: 422 },
    );
  }

  const existing = await readCv(cvId);
  if (existing) {
    return NextResponse.json(
      { error: `CV '${cvId}' already exists.` },
      { status: 409 },
    );
  }

  await writeCv(cvId, cv as Record<string, unknown>, { createSnapshot: false });
  return NextResponse.json({ ok: true, cvId }, { status: 201 });
}
