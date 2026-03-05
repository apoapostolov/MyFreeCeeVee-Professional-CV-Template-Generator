import { NextResponse } from "next/server";

import { getCvGitVersionInfo, listCvSnapshots } from "@/lib/server/cvStore";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ cvId: string }>;
};

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const { cvId } = await context.params;
  const snapshots = await listCvSnapshots(cvId);
  const git = await getCvGitVersionInfo(cvId);
  return NextResponse.json({
    cvId,
    snapshots,
    git,
  });
}
