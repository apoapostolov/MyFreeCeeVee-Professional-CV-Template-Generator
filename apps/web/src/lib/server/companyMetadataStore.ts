import fs from "node:fs/promises";
import path from "node:path";

import { repoPath } from "./repoPaths";

export type CompanyMetadata = {
  id: string;
  name: string;
  priority?: number;
  company_details?: Record<string, unknown>;
  target_roles?: string[];
  target_functions?: string[];
  target_seniority?: string;
  tailoring_priorities?: string[];
  value_proposition?: string;
  motivation?: string;
  keywords_to_echo?: string[];
  application_context?: string;
  interview_context?: string;
  source?: "example" | "personal";
};

type CompanyMetadataFile = {
  companies?: unknown[];
};

const SETTINGS_DIR = repoPath("data", "settings");
const EXAMPLE_FILE = path.join(SETTINGS_DIR, "companies.example.json");
const PERSONAL_FILE = path.join(SETTINGS_DIR, "companies.personal.json");

function asRecord(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return null;
  }
  return input as Record<string, unknown>;
}

function stringList(input: unknown): string[] | undefined {
  if (!Array.isArray(input)) {
    return undefined;
  }
  const items = input
    .map((entry) => String(entry ?? "").trim())
    .filter((entry) => entry.length > 0);
  return items.length > 0 ? items : undefined;
}

async function readCompanyFile(
  filePath: string,
  source: "example" | "personal",
): Promise<CompanyMetadata[]> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as CompanyMetadataFile;
    const companies = Array.isArray(parsed.companies) ? parsed.companies : [];

    const normalized: CompanyMetadata[] = [];
    for (const rawEntry of companies) {
      const entry = asRecord(rawEntry);
      if (!entry) {
        continue;
      }
      const id = String(entry.id ?? "").trim();
      const name = String(entry.name ?? "").trim();
      if (!id || !name) {
        continue;
      }
      const priorityRaw = Number(entry.priority);
      normalized.push({
          id,
          name,
          priority: Number.isFinite(priorityRaw) ? priorityRaw : undefined,
          company_details: asRecord(entry.company_details) ?? undefined,
          target_roles: stringList(entry.target_roles),
          target_functions: stringList(entry.target_functions),
          target_seniority:
            typeof entry.target_seniority === "string" && entry.target_seniority.trim().length > 0
              ? entry.target_seniority.trim()
              : undefined,
          tailoring_priorities: stringList(entry.tailoring_priorities),
          value_proposition:
            typeof entry.value_proposition === "string" && entry.value_proposition.trim().length > 0
              ? entry.value_proposition.trim()
              : undefined,
          motivation:
            typeof entry.motivation === "string" && entry.motivation.trim().length > 0
              ? entry.motivation.trim()
              : undefined,
          keywords_to_echo: stringList(entry.keywords_to_echo),
          application_context:
            typeof entry.application_context === "string" && entry.application_context.trim().length > 0
              ? entry.application_context.trim()
              : undefined,
          interview_context:
            typeof entry.interview_context === "string" && entry.interview_context.trim().length > 0
              ? entry.interview_context.trim()
              : undefined,
          source,
        });
    }

    return normalized;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export async function readCompanyMetadata(): Promise<CompanyMetadata[]> {
  const [exampleCompanies, personalCompanies] = await Promise.all([
    readCompanyFile(EXAMPLE_FILE, "example"),
    readCompanyFile(PERSONAL_FILE, "personal"),
  ]);

  const merged = new Map<string, CompanyMetadata>();
  for (const company of exampleCompanies) {
    merged.set(company.id, company);
  }
  for (const company of personalCompanies) {
    merged.set(company.id, company);
  }

  return [...merged.values()].sort((a, b) => {
    const priorityA = a.priority ?? Number.MAX_SAFE_INTEGER;
    const priorityB = b.priority ?? Number.MAX_SAFE_INTEGER;
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    return a.name.localeCompare(b.name);
  });
}

export async function readCompanyMetadataById(
  companyId: string,
): Promise<CompanyMetadata | null> {
  if (!companyId.trim()) {
    return null;
  }
  const companies = await readCompanyMetadata();
  return companies.find((entry) => entry.id === companyId.trim()) ?? null;
}

function filePathForSource(source: "example" | "personal"): string {
  return source === "personal" ? PERSONAL_FILE : EXAMPLE_FILE;
}

export async function readCompanyMetadataDocument(
  source: "example" | "personal",
): Promise<{ companies: CompanyMetadata[] }> {
  const companies = await readCompanyFile(filePathForSource(source), source);
  return { companies };
}

export async function writeCompanyMetadataDocument(
  source: "example" | "personal",
  input: unknown,
): Promise<{ companies: CompanyMetadata[] }> {
  const record = asRecord(input);
  const companies = Array.isArray(record?.companies) ? record.companies : [];
  const normalized = await readCompanyFile(
    filePathForSource(source),
    source,
  ).catch(() => []);

  const nextCompanies: CompanyMetadata[] = [];
  for (const rawEntry of companies) {
    const entry = asRecord(rawEntry);
    if (!entry) {
      continue;
    }
    const id = String(entry.id ?? "").trim();
    const name = String(entry.name ?? "").trim();
    if (!id || !name) {
      continue;
    }
    const priorityRaw = Number(entry.priority);
    nextCompanies.push({
      id,
      name,
      priority: Number.isFinite(priorityRaw) ? priorityRaw : undefined,
      company_details: asRecord(entry.company_details) ?? undefined,
      target_roles: stringList(entry.target_roles),
      target_functions: stringList(entry.target_functions),
      target_seniority:
        typeof entry.target_seniority === "string" && entry.target_seniority.trim().length > 0
          ? entry.target_seniority.trim()
          : undefined,
      tailoring_priorities: stringList(entry.tailoring_priorities),
      value_proposition:
        typeof entry.value_proposition === "string" && entry.value_proposition.trim().length > 0
          ? entry.value_proposition.trim()
          : undefined,
      motivation:
        typeof entry.motivation === "string" && entry.motivation.trim().length > 0
          ? entry.motivation.trim()
          : undefined,
      keywords_to_echo: stringList(entry.keywords_to_echo),
      application_context:
        typeof entry.application_context === "string" && entry.application_context.trim().length > 0
          ? entry.application_context.trim()
          : undefined,
      interview_context:
        typeof entry.interview_context === "string" && entry.interview_context.trim().length > 0
          ? entry.interview_context.trim()
          : undefined,
      source,
    });
  }

  await fs.mkdir(SETTINGS_DIR, { recursive: true });
  await fs.writeFile(
    filePathForSource(source),
    JSON.stringify({ companies: nextCompanies }, null, 2) + "\n",
    "utf-8",
  );

  return { companies: nextCompanies.length > 0 ? nextCompanies : normalized.slice(0, 0) };
}
