import fs from "node:fs";
import path from "node:path";

const REPO_SENTINELS = ["data", "templates", "TODO.md"];

function looksLikeRepoRoot(candidate: string): boolean {
  return REPO_SENTINELS.every((entry) =>
    fs.existsSync(path.join(candidate, entry)),
  );
}

export function resolveRepoRoot(): string {
  const cwd = process.cwd();
  const candidates = [cwd, path.resolve(cwd, ".."), path.resolve(cwd, "../..")];

  for (const candidate of candidates) {
    if (looksLikeRepoRoot(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Could not resolve repository root from cwd=${cwd}. Expected to find data/, templates/, TODO.md.`,
  );
}

export function repoPath(...segments: string[]): string {
  return path.join(resolveRepoRoot(), ...segments);
}
