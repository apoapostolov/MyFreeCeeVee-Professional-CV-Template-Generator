import { NextResponse } from "next/server";

import { listTemplates } from "@/lib/server/templateStore";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const items = await listTemplates();
  return NextResponse.json({ items });
}
