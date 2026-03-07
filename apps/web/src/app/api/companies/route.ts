import { NextResponse } from "next/server";

import {
  readCompanyMetadata,
  readCompanyMetadataDocument,
  writeCompanyMetadataDocument,
} from "@/lib/server/companyMetadataStore";

export const runtime = "nodejs";

function parseSource(input: string | null): "example" | "personal" | null {
  if (input === "example" || input === "personal") {
    return input;
  }
  return null;
}

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const source = parseSource(url.searchParams.get("source"));

  if (source) {
    const document = await readCompanyMetadataDocument(source);
    return NextResponse.json({
      ok: true,
      source,
      document,
    });
  }

  const companies = await readCompanyMetadata();
  return NextResponse.json({
    ok: true,
    items: companies.map((company) => ({
      id: company.id,
      name: company.name,
      priority: company.priority ?? null,
      source: company.source ?? null,
    })),
  });
}

export async function PUT(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const source = parseSource(url.searchParams.get("source"));
  if (!source) {
    return NextResponse.json({ error: "source must be example or personal." }, { status: 400 });
  }

  const body = (await request.json()) as { document?: unknown };
  const document = await writeCompanyMetadataDocument(source, body.document ?? {});
  return NextResponse.json({
    ok: true,
    source,
    document,
  });
}
