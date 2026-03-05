import fs from "node:fs/promises";

import { parse } from "yaml";

import { repoPath } from "./repoPaths";

export type TemplateCatalogEntry = {
  id: string;
  name: string;
  version: string;
  status: string;
  locale_support?: string[];
  files: {
    meta: string;
    layout: string;
    license: string;
  };
};

type TemplateCatalog = {
  version: number;
  templates: TemplateCatalogEntry[];
};

export async function listTemplates(): Promise<TemplateCatalogEntry[]> {
  const catalogPath = repoPath("templates", "catalog.yaml");
  const content = await fs.readFile(catalogPath, "utf-8");
  const parsed = parse(content) as TemplateCatalog;
  return (parsed.templates ?? []).slice();
}
