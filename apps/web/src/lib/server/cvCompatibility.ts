import fs from "node:fs/promises";

import { parse } from "yaml";

import type { CvDocument } from "./cvStore";
import { repoPath } from "./repoPaths";
import { buildCvVariantId, parseCvVariantId } from "./cvVariants";

type MappingBinding = {
  cv_path?: string;
  slot_id?: string;
};

type TemplateRuleSet = {
  bullet_limit_per_experience_item?: number;
};

type TemplateDocument = {
  slots?: Array<{ id?: string }>;
  rules?: TemplateRuleSet;
};

type MappingDocument = {
  bindings?: MappingBinding[];
};

export type CvCompatibilityWarning = {
  code: "missing_required_slot" | "slot_overflow";
  severity: "warning";
  slotId: string;
  message: string;
  cvPath?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function getByPath(input: CvDocument, dotPath: string): unknown {
  return dotPath.split(".").reduce<unknown>((cursor, segment) => {
    const record = asRecord(cursor);
    if (!record) {
      return undefined;
    }
    return record[segment];
  }, input);
}

function isPresent(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return true;
}

async function readYamlFile<T>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, "utf-8");
  return parse(content) as T;
}

async function resolveMappingPath(cvId: string, templateId: string): Promise<string> {
  const exact = repoPath(
    "data",
    "template_mappings",
    `${cvId}__${templateId}.yaml`,
  );
  try {
    await fs.access(exact);
    return exact;
  } catch {
    const parsed = parseCvVariantId(cvId);
    if (!parsed) {
      throw new Error(`Mapping file missing for cvId=${cvId} templateId=${templateId}.`);
    }

    const fallbackBg = buildCvVariantId({
      language: "bg",
      iteration: parsed.iteration,
      target: parsed.target,
    });
    const fallback = repoPath(
      "data",
      "template_mappings",
      `${fallbackBg}__${templateId}.yaml`,
    );
    await fs.access(fallback);
    return fallback;
  }
}

export async function analyzeCvCompatibility(
  cvId: string,
  cv: CvDocument,
  templateId = "europass-v1",
): Promise<CvCompatibilityWarning[]> {
  const mappingPath = await resolveMappingPath(cvId, templateId);
  const templatePath = repoPath("templates", templateId, "template.yaml");

  const [mapping, template] = await Promise.all([
    readYamlFile<MappingDocument>(mappingPath),
    readYamlFile<TemplateDocument>(templatePath),
  ]);

  const warnings: CvCompatibilityWarning[] = [];
  const templateSlots = new Set(
    (template.slots ?? [])
      .map((slot) => slot.id)
      .filter((slotId): slotId is string => Boolean(slotId)),
  );

  for (const binding of mapping.bindings ?? []) {
    const slotId = binding.slot_id;
    const cvPath = binding.cv_path;
    if (!slotId || !cvPath || !templateSlots.has(slotId)) {
      continue;
    }
    const value = getByPath(cv, cvPath);
    if (!isPresent(value)) {
      warnings.push({
        code: "missing_required_slot",
        severity: "warning",
        slotId,
        cvPath,
        message: `Missing value for required slot ${slotId} from ${cvPath}.`,
      });
    }
  }

  const experienceRaw = cv.experience;
  const experience = Array.isArray(experienceRaw) ? experienceRaw : [];
  const bulletLimit = template.rules?.bullet_limit_per_experience_item;
  if (typeof bulletLimit === "number" && bulletLimit > 0) {
    experience.forEach((item, index) => {
      const record = asRecord(item);
      const responsibilities = Array.isArray(record?.responsibilities)
        ? record.responsibilities
        : [];
      if (responsibilities.length > bulletLimit) {
        warnings.push({
          code: "slot_overflow",
          severity: "warning",
          slotId: "experience.items",
          cvPath: `experience.${index}.responsibilities`,
          message: `Experience item ${index + 1} has ${responsibilities.length} bullets; limit is ${bulletLimit}.`,
        });
      }
    });
  }

  return warnings;
}
