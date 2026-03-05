import { validateCvV1 } from "@myfreeceevee/schemas";
import { NextResponse } from "next/server";

import { analyzeCvCompatibility } from "@/lib/server/cvCompatibility";
import { isSupportedLanguage } from "@/lib/server/cvVariants";
import {
  deleteCv,
  ensureLanguageVariant,
  getCvGitVersionInfo,
  readCv,
  writeCv,
} from "@/lib/server/cvStore";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ cvId: string }>;
};

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const { cvId: initialCvId } = await context.params;
  const url = new URL(request.url);
  const requestedLanguage = url.searchParams.get("language");
  const autoTranslate = url.searchParams.get("autoTranslate") === "true";

  let resolvedCvId = initialCvId;
  let variantCreated = false;
  if (requestedLanguage && isSupportedLanguage(requestedLanguage)) {
    try {
      const resolved = await ensureLanguageVariant(initialCvId, requestedLanguage, {
        autoTranslate,
      });
      resolvedCvId = resolved.cvId;
      variantCreated = resolved.created;
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to resolve requested language variant.",
        },
        { status: 404 },
      );
    }
  }

  const cv = await readCv(resolvedCvId);
  if (!cv) {
    return NextResponse.json({ error: "CV not found." }, { status: 404 });
  }

  const templateId = url.searchParams.get("templateId") ?? "europass-v1";
  const warnings = await analyzeCvCompatibility(resolvedCvId, cv, templateId);
  const git = await getCvGitVersionInfo(resolvedCvId);
  return NextResponse.json({
    cvId: resolvedCvId,
    requestedCvId: initialCvId,
    variantCreated,
    cv,
    warnings,
    git,
  });
}

export async function PUT(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const { cvId } = await context.params;
  const body = (await request.json()) as { cv?: unknown };
  const validation = validateCvV1(body.cv);

  if (!validation.valid) {
    return NextResponse.json(
      { error: "cv payload failed validation.", issues: validation.issues },
      { status: 422 },
    );
  }

  await writeCv(cvId, body.cv as Record<string, unknown>, {
    createSnapshot: true,
  });
  return NextResponse.json({
    ok: true,
    cvId,
    git: await getCvGitVersionInfo(cvId),
  });
}

export async function DELETE(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const { cvId } = await context.params;
  const deleted = await deleteCv(cvId);
  if (!deleted) {
    return NextResponse.json({ error: "CV not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, cvId });
}
