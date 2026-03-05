import { NextResponse } from "next/server";

import { buildCvTemplateHtml } from "@/lib/server/renderCvTemplate";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const cvId = url.searchParams.get("cvId");
  const templateId = url.searchParams.get("templateId");

  if (!cvId || !templateId) {
    return NextResponse.json(
      { error: "Missing required query params: cvId and templateId." },
      { status: 400 },
    );
  }

  let browser: Awaited<ReturnType<(typeof import("playwright"))["chromium"]["launch"]>> | null =
    null;
  try {
    const { html } = await buildCvTemplateHtml({ cvId, templateId });
    const { chromium } = await import("playwright");
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
      viewport: { width: 1242, height: 1755 },
      deviceScaleFactor: 1,
    });
    await page.setContent(html, { waitUntil: "networkidle" });
    const image = await page.screenshot({
      type: "png",
      fullPage: false,
      clip: { x: 0, y: 0, width: 1242, height: 1755 },
    });
    await page.close();

    const fileName = `${cvId}__${templateId}.png`;
    return new NextResponse(new Uint8Array(image), {
      headers: {
        "content-type": "image/png",
        "content-disposition": `inline; filename="${fileName}"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate image." },
      { status: 500 },
    );
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
