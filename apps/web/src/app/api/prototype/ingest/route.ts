import { NextResponse } from "next/server";

export const runtime = "nodejs";

type IngestMode = "pdf" | "image";

function templateIdSuggestion(sourceName: string): string {
  const normalized = sourceName
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
  return `${normalized || "imported-template"}-v1`;
}

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as {
    mode?: unknown;
    sourceName?: unknown;
  };

  const mode = body.mode;
  const sourceName = body.sourceName;

  if (mode !== "pdf" && mode !== "image") {
    return NextResponse.json({ error: "mode must be 'pdf' or 'image'." }, { status: 400 });
  }

  if (typeof sourceName !== "string" || sourceName.trim().length === 0) {
    return NextResponse.json(
      { error: "sourceName must be a non-empty string." },
      { status: 400 },
    );
  }

  const phases =
    mode === "pdf"
      ? [
          "Document OCR and block extraction prepared",
          "Visual region clustering prepared",
          "Slot suggestion and role labeling prepared",
          "Template tokenization placeholder ready",
        ]
      : [
          "Image enhancement and perspective correction prepared",
          "Layout segmentation prepared",
          "Typography and spacing heuristic extraction prepared",
          "Template slot graph placeholder ready",
        ];

  const nextActions = [
    "Run license/source ownership validation before approval",
    "Open Template Studio and review slot placements",
    "Generate template.yaml + layout.yaml draft",
    "Run compatibility checks with cv_en_0001_john_doe",
  ];

  return NextResponse.json({
    mode: mode as IngestMode,
    sourceName: sourceName.trim(),
    templateIdSuggestion: templateIdSuggestion(sourceName),
    status: "prepared-placeholder-pipeline",
    phases,
    nextActions,
  });
}
