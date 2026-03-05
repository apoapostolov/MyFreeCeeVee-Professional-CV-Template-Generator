import fs from "node:fs/promises";

import { parse } from "yaml";

import type { CvDocument } from "./cvStore";
import { readCv } from "./cvStore";
import { repoPath } from "./repoPaths";
import { buildCvVariantId, parseCvVariantId } from "./cvVariants";

type TemplateFile = {
  meta?: {
    template_id?: string;
    name?: string;
  };
  page?: {
    margins_mm?: {
      top?: number;
      right?: number;
      bottom?: number;
      left?: number;
    };
  };
  labels?: {
    bg?: Record<string, unknown>;
    en?: Record<string, unknown>;
  };
  tokens?: {
    colors?: Record<string, string>;
  };
  date_display?: {
    experience?: "exact" | "month-year" | "year";
    education?: "exact" | "month-year" | "year";
  };
  text_layout?: {
    profile_summary?: "single_paragraph" | "multi_paragraph";
  };
};

type MappingFile = {
  bindings?: Array<{ cv_path?: string; slot_id?: string }>;
};

type RenderInput = {
  cvId: string;
  templateId: string;
};

type RenderResult = {
  html: string;
  cvId: string;
  templateId: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getByPath(input: unknown, dotPath: string): unknown {
  return dotPath.split(".").reduce<unknown>((cursor, segment) => {
    if (cursor === null || cursor === undefined) {
      return undefined;
    }
    if (Array.isArray(cursor)) {
      const index = Number(segment);
      if (!Number.isInteger(index)) {
        return undefined;
      }
      return cursor[index];
    }
    const record = asRecord(cursor);
    if (!record) {
      return undefined;
    }
    return record[segment];
  }, input);
}

function textList(value: unknown): string[] {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter((item) => item.trim().length > 0);
  }
  return [String(value)];
}

function resolveMargins(template: TemplateFile): { top: number; right: number; bottom: number; left: number } {
  const src = template.page?.margins_mm;
  return {
    top: src?.top ?? 12,
    right: src?.right ?? 12,
    bottom: src?.bottom ?? 12,
    left: src?.left ?? 12,
  };
}

function resolveRenderLanguage(cv: CvDocument, cvId: string): "bg" | "en" {
  const metadata = asRecord(cv.metadata);
  const langMeta = metadata?.language;
  if (langMeta === "bg" || langMeta === "en") {
    return langMeta;
  }
  const parsed = parseCvVariantId(cvId);
  if (parsed?.language === "bg" || parsed?.language === "en") {
    return parsed.language;
  }
  return "en";
}

function label(labels: Record<string, unknown>, key: string, fallback: string): string {
  const value = getByPath(labels, key);
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function languageDotCount(value: unknown): number {
  const input = String(value ?? "").toUpperCase();
  if (input === "NATIVE" || input === "C2") return 5;
  if (input === "C1") return 4;
  if (input === "B2") return 3;
  if (input === "B1") return 2;
  if (input === "A2" || input === "A1") return 1;
  return 3;
}

function skillDotCount(index: number): number {
  if (index <= 0) return 5;
  if (index === 1) return 4;
  if (index === 2) return 3;
  if (index === 3) return 2;
  return 3;
}

function splitName(fullName: string): { top: string; bottom: string } {
  const parts = fullName
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length <= 1) return { top: fullName, bottom: "" };
  if (parts.length === 2) return { top: parts[0], bottom: parts[1] };
  return { top: `${parts[0]} ${parts[1]}`, bottom: parts.slice(2).join(" ") };
}

function nameSizeMm(value: string, max: number, min: number): number {
  const length = value.trim().length;
  if (length <= 10) return max;
  if (length >= 24) return min;
  const ratio = (length - 10) / 14;
  return Number((max - (max - min) * ratio).toFixed(2));
}

function formatDateValue(value: unknown, mode: "exact" | "month-year" | "year"): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const match = raw.match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/);
  if (!match) return raw;
  const [, year, month, day] = match;
  if (mode === "year") return year;
  if (mode === "month-year") {
    if (month) return `${month}.${year}`;
    return year;
  }
  if (day && month) return `${day}.${month}.${year}`;
  if (month) return `${month}.${year}`;
  return year;
}

function formatRange(
  startDate: unknown,
  endDate: unknown,
  isCurrent: unknown,
  mode: "exact" | "month-year" | "year",
  presentLabel: string,
): string {
  const start = formatDateValue(startDate, mode);
  const present = Boolean(isCurrent) || !String(endDate ?? "").trim();
  const end = present ? presentLabel : formatDateValue(endDate, mode);
  if (!start && !end) return "";
  if (!start) return end;
  if (!end) return start;
  return `${start} - ${end}`;
}

function renderParagraphs(
  value: unknown,
  mode: "single_paragraph" | "multi_paragraph",
  className = "",
): string {
  const lines = textList(value);
  if (!lines.length) return "";
  if (mode === "single_paragraph") {
    return `<p class=\"${className}\">${escapeHtml(lines.join(" "))}</p>`;
  }
  return lines.map((line) => `<p class=\"${className}\">${escapeHtml(line)}</p>`).join("");
}

function renderSimpleList(title: string, value: unknown): string {
  const items = textList(value)
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
  if (!items) return "";
  return `<section class=\"subsection\"><h3>${escapeHtml(title)}</h3><ul>${items}</ul></section>`;
}

function renderContact(title: string, value: unknown): string {
  const record = asRecord(value);
  if (!record) return "";
  const order = ["email", "phone_e164", "phone_local", "linkedin", "github", "website"];
  const lines = order
    .map((key) => record[key])
    .filter(Boolean)
    .map((item) => `<div class=\"line\">${escapeHtml(item)}</div>`)
    .join("");
  return `<section><h3>${escapeHtml(title)}</h3>${lines}</section>`;
}

function renderLanguages(title: string, value: unknown): string {
  const list = Array.isArray(value) ? value : [];
  const rows = list
    .map((entry) => {
      const record = asRecord(entry);
      if (!record) return "";
      return `<li>${escapeHtml(record.language ?? "")}<span>${escapeHtml(record.proficiency_cefr ?? "")}</span></li>`;
    })
    .join("");
  if (!rows) return "";
  return `<section><h3>${escapeHtml(title)}</h3><ul class=\"languages\">${rows}</ul></section>`;
}

function renderEdinburghContact(
  value: unknown,
  residence: string,
  fullName: string,
  accent: string,
  labels: Record<string, unknown>,
): string {
  const record = asRecord(value);
  if (!record) return "";

  const rowsData: Array<{ label: string; icon: string; value: string }> = [
    { label: label(labels, "contact_labels.name", "Name"), icon: "fa-user", value: fullName },
    { label: label(labels, "contact_labels.address", "Address"), icon: "fa-house", value: residence },
    {
      label: label(labels, "contact_labels.phone", "Phone"),
      icon: "fa-phone",
      value: String(record.phone_e164 ?? record.phone_local ?? ""),
    },
    { label: label(labels, "contact_labels.email", "Email"), icon: "fa-envelope", value: String(record.email ?? "") },
    {
      label: label(labels, "contact_labels.driving_license", "Driving license"),
      icon: "fa-id-card",
      value: String(record.driving_license ?? ""),
    },
    { label: label(labels, "contact_labels.linkedin", "LinkedIn"), icon: "fa-link", value: String(record.linkedin ?? "") },
  ].filter((item) => item.value.trim().length > 0);

  if (!rowsData.length) return "";

  const rows = rowsData
    .map(
      (item) => `<li>
        <span class=\"icon\" style=\"color:${accent}\"><i class=\"fa-solid ${item.icon}\"></i></span>
        <span class=\"kv\"><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.value)}</span></span>
      </li>`,
    )
    .join("");

  return `<section><h3>${escapeHtml(label(labels, "sections.personal_details", "Personal details"))}</h3><ul class=\"contact-list\">${rows}</ul></section>`;
}

function renderEdinburghInterests(value: unknown, accent: string, labels: Record<string, unknown>): string {
  const rows = textList(value)
    .map((item) => `<li><span class=\"sq\" style=\"background:${accent}\"></span><span>${escapeHtml(item)}</span></li>`)
    .join("");
  if (!rows) return "";
  return `<section><h3>${escapeHtml(label(labels, "sections.interests", "Interests"))}</h3><ul class=\"square-bullets\">${rows}</ul></section>`;
}

function renderEdinburghLanguages(value: unknown, accent: string, labels: Record<string, unknown>): string {
  const list = Array.isArray(value) ? value : [];
  const rows = list
    .map((entry) => {
      const record = asRecord(entry);
      if (!record) return "";
      const language = escapeHtml(record.language ?? "");
      const score = languageDotCount(record.proficiency_cefr);
      const dots = Array.from({ length: 5 })
        .map(
          (_, index) => `<span class=\"dot ${index < score ? "on" : ""}\" style=\"${index < score ? `background:${accent};` : ""}\"></span>`,
        )
        .join("");
      return `<li><span class=\"label\">${language}</span><span class=\"dots\">${dots}</span></li>`;
    })
    .join("");
  if (!rows) return "";
  return `<section><h3>${escapeHtml(label(labels, "sections.languages", "Languages"))}</h3><ul class=\"edinburgh-languages\">${rows}</ul></section>`;
}

function renderEdinburghSkills(value: unknown, accent: string, labels: Record<string, unknown>): string {
  const list = textList(value);
  if (!list.length) return "";
  const rows = list
    .map((item, index) => {
      const score = skillDotCount(index);
      const dots = Array.from({ length: 5 })
        .map(
          (_, dotIndex) => `<span class=\"dot ${dotIndex < score ? "on" : ""}\" style=\"${dotIndex < score ? `background:${accent};` : ""}\"></span>`,
        )
        .join("");
      return `<li><span class=\"label\">${escapeHtml(item)}</span><span class=\"dots\">${dots}</span></li>`;
    })
    .join("");
  return `<section><h3>${escapeHtml(label(labels, "sections.skills", "Skills"))}</h3><ul class=\"edinburgh-skills\">${rows}</ul></section>`;
}

function renderExperience(
  title: string,
  value: unknown,
  mode: "exact" | "month-year" | "year",
  presentLabel: string,
  labels: Record<string, unknown>,
  options?: { includeProducts?: boolean },
): string {
  const includeProducts = Boolean(options?.includeProducts);
  const workedOnLabel = label(labels, "product_labels.worked_on", "Worked on:");
  const entries = Array.isArray(value) ? value : [];
  const blocks = entries
    .map((entry) => {
      const record = asRecord(entry);
      if (!record) return "";
      const range = formatRange(
        record.start_date,
        record.end_date,
        record.is_current,
        mode,
        presentLabel,
      );
      const bullets = textList(record.responsibilities)
        .map((item) => `<li>${escapeHtml(item)}</li>`)
        .join("");
      const productRows = (Array.isArray(record.products) ? record.products : [])
        .map((product) => {
          if (typeof product === "string") {
            const trimmed = product.trim();
            if (!trimmed) return "";
            const splitByDash = trimmed.split(/\s+-\s+/, 2);
            if (splitByDash.length === 2) {
              return `<li><span class=\"product-name\">${escapeHtml(splitByDash[0])}</span><span class=\"product-note-line\"><span class=\"product-note-tab\">&nbsp;&nbsp;</span><span class=\"product-note-text\">${escapeHtml(splitByDash[1])}</span></span></li>`;
            }
            const marker = ", вкл.";
            const markerIndex = trimmed.indexOf(marker);
            if (markerIndex > 0) {
              const name = trimmed.slice(0, markerIndex).trim();
              const note = `вкл. ${trimmed.slice(markerIndex + marker.length).trim()}`;
              return `<li><span class=\"product-name\">${escapeHtml(name)}</span><span class=\"product-note-line\"><span class=\"product-note-tab\">&nbsp;&nbsp;</span><span class=\"product-note-text\">${escapeHtml(note)}</span></span></li>`;
            }
            return `<li><span class=\"product-name\">${escapeHtml(trimmed)}</span></li>`;
          }
          const productRecord = asRecord(product);
          if (!productRecord) return "";
          const name = String(productRecord.name ?? "").trim();
          const note = String(productRecord.note ?? "").trim();
          if (!name) return "";
          return `<li><span class=\"product-name\">${escapeHtml(name)}</span>${note ? `<span class=\"product-note-line\"><span class=\"product-note-tab\">&nbsp;&nbsp;</span><span class=\"product-note-text\">${escapeHtml(note)}</span></span>` : ""}</li>`;
        })
        .join("");
      return `<article class=\"entry\">
        <div class=\"entry-head\">
          <h4>${escapeHtml(record.role ?? "")}</h4>
          <span>${escapeHtml(range)}</span>
        </div>
        <p class=\"org\">${escapeHtml(record.employer ?? "")}</p>
        ${bullets ? `<ul>${bullets}</ul>` : ""}
        ${includeProducts && productRows ? `<div class=\"product-subsection\"><p class=\"product-title\">${escapeHtml(workedOnLabel)}</p><ul class=\"product-list\">${productRows}</ul></div>` : ""}
      </article>`;
    })
    .join("");
  if (!blocks) return "";
  return `<section><h2>${escapeHtml(title)}</h2>${blocks}</section>`;
}

function renderEducation(
  title: string,
  value: unknown,
  mode: "exact" | "month-year" | "year",
  presentLabel: string,
): string {
  const entries = Array.isArray(value) ? value : [];
  const blocks = entries
    .map((entry) => {
      const record = asRecord(entry);
      if (!record) return "";
      const range = formatRange(record.start_date, record.end_date, false, mode, presentLabel);
      return `<article class=\"entry\">
        <div class=\"entry-head\">
          <h4>${escapeHtml(record.degree ?? "")}</h4>
          <span>${escapeHtml(range)}</span>
        </div>
        <p class=\"org\">${escapeHtml(record.institution ?? "")}</p>
      </article>`;
    })
    .join("");
  if (!blocks) return "";
  return `<section><h2>${escapeHtml(title)}</h2>${blocks}</section>`;
}

function renderReferences(title: string, value: unknown): string {
  const entries = Array.isArray(value) ? value : [];
  const rows = entries
    .map((entry) => {
      const record = asRecord(entry);
      if (!record) return "";
      return `<article class=\"ref\">
        <strong>${escapeHtml(record.name ?? "")}</strong>
        <div>${escapeHtml(record.role ?? "")}</div>
        <div>${escapeHtml(record.organization ?? "")}</div>
        <div>${escapeHtml(record.email ?? "")}</div>
      </article>`;
    })
    .join("");
  if (!rows) return "";
  return `<section><h2>${escapeHtml(title)}</h2>${rows}</section>`;
}

function renderEdinburghCompetenciesSection(labels: Record<string, unknown>, cv: CvDocument): string {
  const core = textList(getByPath(cv, "skills.core_strengths"));
  const social = textList(getByPath(cv, "skills.social"));
  const other = textList(getByPath(cv, "optional_sections.other_skills"));
  const publications = textList(getByPath(cv, "optional_sections.publications"));

  const blocks: string[] = [];
  if (core.length) {
    blocks.push(`<section class=\"subsection\"><h3>${escapeHtml(label(labels, "sections.core_strengths", "Core Strengths"))}</h3><ul>${core.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul></section>`);
  }
  if (social.length) {
    blocks.push(`<section class=\"subsection\"><h3>${escapeHtml(label(labels, "sections.social_skills", "Social Skills"))}</h3><ul>${social.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul></section>`);
  }
  if (other.length) {
    blocks.push(`<section class=\"subsection\"><h3>${escapeHtml(label(labels, "sections.other_skills", "Other Skills"))}</h3><ul>${other.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul></section>`);
  }
  if (publications.length) {
    blocks.push(`<section class=\"subsection\"><h3>${escapeHtml(label(labels, "sections.publications", "Publications"))}</h3><ul>${publications.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul></section>`);
  }
  if (!blocks.length) return "";
  return `<section><h2>${escapeHtml(label(labels, "sections.competencies", "Competencies"))}</h2>${blocks.join("")}</section>`;
}

function renderEuropassRow(labelText: string, valueHtml: string): string {
  if (!valueHtml.trim()) return "";
  return `<div class=\"erow\"><div class=\"elabel\">${escapeHtml(labelText)}</div><div class=\"evalue\">${valueHtml}</div></div>`;
}

function renderEuropassSimpleList(items: string[]): string {
  const rows = items
    .filter((item) => item.trim().length > 0)
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
  return rows ? `<ul>${rows}</ul>` : "";
}

function toProductLines(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .flatMap((item) => {
      if (typeof item === "string") {
        const trimmed = item.trim();
        return trimmed ? [trimmed] : [];
      }
      const record = asRecord(item);
      if (!record) {
        return [];
      }
      const name = String(record.name ?? "").trim();
      const note = String(record.note ?? "").trim();
      if (!name) {
        return [];
      }
      return note ? [`${name} - ${note}`] : [name];
    })
    .filter((item) => item.length > 0);
}

function renderEuropass(
  cv: CvDocument,
  template: TemplateFile,
  slots: Record<string, unknown>,
  labels: Record<string, unknown>,
): string {
  const margins = resolveMargins(template);
  const experienceDateMode = template.date_display?.experience ?? "exact";
  const educationDateMode = template.date_display?.education ?? "exact";
  const pageLabel = label(labels, "common.page", "Page");
  const presentLabel = label(labels, "common.present", "present");

  const person = asRecord(getByPath(cv, "person")) ?? {};
  const contact = asRecord(slots["contact.block"] ?? getByPath(cv, "person.contact")) ?? {};
  const residence = asRecord(getByPath(cv, "person.residence")) ?? {};
  const fullName = String(slots["person.full_name"] ?? getByPath(cv, "person.full_name") ?? "");
  const profileSummary = renderParagraphs(
    slots["positioning.profile_summary"] ?? getByPath(cv, "positioning.profile_summary"),
    "single_paragraph",
  );
  const experiences = Array.isArray(slots["experience.items"] ?? getByPath(cv, "experience"))
    ? (slots["experience.items"] ?? getByPath(cv, "experience"))
    : [];
  const education = Array.isArray(slots["education.items"] ?? getByPath(cv, "education"))
    ? (slots["education.items"] ?? getByPath(cv, "education"))
    : [];
  const languages = Array.isArray(slots["skills.languages"] ?? getByPath(cv, "skills.languages"))
    ? (slots["skills.languages"] ?? getByPath(cv, "skills.languages"))
    : [];
  const technical = textList(slots["skills.technical"] ?? getByPath(cv, "skills.technical"));
  const social = textList(slots["skills.social"] ?? getByPath(cv, "skills.social"));
  const core = textList(getByPath(cv, "skills.core_strengths"));
  const otherSkills = textList(getByPath(cv, "optional_sections.other_skills"));
  const publications = textList(getByPath(cv, "optional_sections.publications"));
  const certifications = textList(getByPath(cv, "optional_sections.certifications"));
  const projects = textList(getByPath(cv, "optional_sections.projects"));
  const awards = textList(getByPath(cv, "optional_sections.awards"));
  const volunteering = textList(getByPath(cv, "optional_sections.volunteering"));
  const patents = textList(getByPath(cv, "optional_sections.patents"));
  const portfolioLinks = textList(getByPath(cv, "optional_sections.portfolio_links"));
  const interests = textList(getByPath(cv, "optional_sections.interests"));
  const references = Array.isArray(getByPath(cv, "references")) ? (getByPath(cv, "references") as unknown[]) : [];
  const drivingLicense = String(contact.driving_license ?? "");
  const motherTongue = (languages as unknown[])
    .map((item) => asRecord(item))
    .find((record) => String(record?.proficiency_cefr ?? "").toLowerCase() === "native");
  const otherLanguages = (languages as unknown[])
    .map((item) => asRecord(item))
    .filter((record) => record && record !== motherTongue);

  const contactBlock = [
    renderEuropassRow(label(labels, "personal.name", "Name"), escapeHtml(fullName)),
    renderEuropassRow(
      label(labels, "personal.address", "Address"),
      escapeHtml(
        [residence.street, residence.postal_code, residence.city, residence.country]
          .filter(Boolean)
          .map((item) => String(item))
          .join(", "),
      ),
    ),
    renderEuropassRow(
      label(labels, "personal.phone", "Telephone"),
      escapeHtml(String(contact.phone_local ?? contact.phone_e164 ?? "")),
    ),
    renderEuropassRow(label(labels, "personal.email", "E-mail"), escapeHtml(String(contact.email ?? ""))),
    renderEuropassRow(label(labels, "personal.nationality", "Nationality"), escapeHtml(String(person.nationality ?? ""))),
    renderEuropassRow(
      label(labels, "personal.birth_date", "Date of birth"),
      escapeHtml(formatDateValue(person.birth_date, "exact")),
    ),
  ]
    .filter(Boolean)
    .join("");

  const experienceBlocks = (experiences as unknown[])
    .map((item) => {
      const record = asRecord(item);
      if (!record) return "";
      const range = formatRange(record.start_date, record.end_date, record.is_current, experienceDateMode, presentLabel);
      const location = asRecord(record.location);
      const employerLine = [record.employer, location?.address, location?.city]
        .filter(Boolean)
        .map((part) => String(part))
        .join(", ");
      const responsibilities = renderEuropassSimpleList(textList(record.responsibilities));
      const products = renderEuropassSimpleList(toProductLines(record.products));
      const tools = renderEuropassSimpleList(textList(record.tools));
      const roleBase = String(record.role ?? "").trim();
      const parallelRoleSuffix = label(labels, "experience_labels.parallel_role_suffix", "Parallel role");
      const roleWithSuffix =
        record.parallel_role && roleBase
          ? `${roleBase} (${parallelRoleSuffix})`
          : record.parallel_role
            ? parallelRoleSuffix
            : roleBase;
      return `<div class=\"entry\">
        ${renderEuropassRow(label(labels, "experience_labels.dates", "Dates"), escapeHtml(range))}
        ${renderEuropassRow(label(labels, "experience_labels.employer", "Employer and address"), escapeHtml(employerLine))}
        ${renderEuropassRow(label(labels, "experience_labels.industry", "Type of business"), escapeHtml(String(record.industry ?? "")))}
        ${renderEuropassRow(label(labels, "experience_labels.role", "Occupation or position held"), escapeHtml(roleWithSuffix))}
        ${renderEuropassRow(label(labels, "experience_labels.activities", "Main activities and responsibilities"), responsibilities)}
        ${renderEuropassRow(label(labels, "experience_labels.products", "Published titles / products"), products)}
        ${renderEuropassRow(label(labels, "experience_labels.tools", "Tools"), tools)}
      </div>`;
    })
    .join("");

  const educationBlocks = (education as unknown[])
    .map((item) => {
      const record = asRecord(item);
      if (!record) return "";
      const range = formatRange(record.start_date, record.end_date, false, educationDateMode, presentLabel);
      return `<div class=\"entry\">
        ${renderEuropassRow(label(labels, "education_labels.dates", "Dates"), escapeHtml(range))}
        ${renderEuropassRow(label(labels, "education_labels.subjects", "Main subjects"), escapeHtml(textList(record.subjects).join(", ")))}
        ${renderEuropassRow(label(labels, "education_labels.field", "Field of study"), escapeHtml(String(record.field_of_study ?? "")))}
        ${renderEuropassRow(label(labels, "education_labels.qualification", "Title of qualification awarded"), escapeHtml(String(record.degree ?? "")))}
        ${renderEuropassRow(label(labels, "education_labels.level", "Level"), escapeHtml(String(record.qualification_level ?? "")))}
        ${renderEuropassRow(label(labels, "education_labels.faculty", "Faculty"), escapeHtml(String(record.faculty ?? "")))}
        ${renderEuropassRow(label(labels, "education_labels.organization", "Name of organisation"), escapeHtml(String(record.institution ?? "")))}
        ${renderEuropassRow(label(labels, "education_labels.location", "Location"), escapeHtml([record.city, record.country].filter(Boolean).join(", ")))}
      </div>`;
    })
    .join("");

  const otherLanguageHtml = otherLanguages
    .map((item) => {
      const record = asRecord(item);
      if (!record) return "";
      return `<div class=\"lang-block\">
        <strong>${escapeHtml(String(record.language ?? ""))}</strong>
        <ul>
          <li>${escapeHtml(label(labels, "language_labels.reading", "Reading"))}: ${escapeHtml(String(record.reading ?? record.proficiency_cefr ?? ""))}</li>
          <li>${escapeHtml(label(labels, "language_labels.writing", "Writing"))}: ${escapeHtml(String(record.writing ?? record.proficiency_cefr ?? ""))}</li>
          <li>${escapeHtml(label(labels, "language_labels.speaking", "Speaking"))}: ${escapeHtml(String(record.speaking ?? record.proficiency_cefr ?? ""))}</li>
        </ul>
      </div>`;
    })
    .join("");

  const referencesHtml = references
    .map((item) => {
      const record = asRecord(item);
      if (!record) return "";
      return `<div class=\"ref-item\">
        <strong>${escapeHtml(String(record.name ?? ""))}</strong>
        <div>${escapeHtml(String(record.role ?? ""))} ${escapeHtml(String(record.organization ?? ""))}</div>
        <div>${escapeHtml(String(record.email ?? ""))}</div>
      </div>`;
    })
    .join("");

  return `<!doctype html>
<html>
<head>
  <meta charset=\"utf-8\" />
  <style>
    @page { size: A4; margin: ${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "Liberation Sans", "Nimbus Sans", Arial, Helvetica, sans-serif; color: #111; font-size: 11.4px; line-height: 1.35; }
    .page { width: 100%; min-height: calc(297mm - ${margins.top + margins.bottom}mm); padding: 8mm 7mm 8mm; }
    .title-wrap { margin-bottom: 8mm; width: 62mm; }
    .title { text-align: left; font-family: "Liberation Sans", "Nimbus Sans", Arial, Helvetica, sans-serif; font-weight: 700; letter-spacing: 0.02em; font-size: 13px; text-transform: uppercase; margin-bottom: 2mm; line-height: 1.2; }
    .eu-flag { width: 24mm; height: 16mm; }
    .section-title { font-family: "Liberation Sans", "Nimbus Sans", Arial, Helvetica, sans-serif; font-size: 17px; margin: 0 0 4mm; font-weight: 700; text-transform: uppercase; }
    .erow { display: grid; grid-template-columns: 26% 74%; gap: 4.2mm; margin: 0.9mm 0; break-inside: avoid; page-break-inside: avoid; }
    .elabel { text-align: right; color: #2b2b2b; font-family: "Liberation Sans", "Nimbus Sans", Arial, Helvetica, sans-serif; font-weight: 600; }
    .evalue { color: #111; font-family: "Liberation Sans Narrow", "Nimbus Sans Narrow", "Arial Narrow", "Liberation Sans", "Nimbus Sans", Arial, Helvetica, sans-serif; font-weight: 400; }
    .entry { margin-bottom: 5mm; }
    .block { margin-bottom: 6mm; }
    .block p { margin: 0; font-family: "Liberation Sans Narrow", "Nimbus Sans Narrow", "Arial Narrow", "Liberation Sans", "Nimbus Sans", Arial, Helvetica, sans-serif; }
    .evalue ul { margin: 0; padding-left: 12px; list-style: none; }
    .evalue li { position: relative; margin: 0.7mm 0; padding-left: 2.4px; }
    .evalue li::before {
      content: "•";
      position: absolute;
      left: -6px;
      top: 1px;
      font-weight: 600;
      line-height: 1;
    }
    .lang-block { margin-bottom: 2mm; }
    .ref-item { margin-bottom: 2mm; }
    .page-footer { position: fixed; right: 0; bottom: 0; left: 0; text-align: right; font-size: 10px; color: #5f6368; padding: 0 1mm 0 0; }
    .page-footer::after { content: \"${escapeHtml(pageLabel)} \" counter(page); }
  </style>
</head>
<body>
  <div class=\"page\">
    <div class=\"title-wrap\">
      <div class=\"title\">${escapeHtml(label(labels, "sections.cv_title", "European Curriculum Vitae"))}</div>
      <svg class=\"eu-flag\" viewBox=\"0 0 60 40\" xmlns=\"http://www.w3.org/2000/svg\" aria-label=\"EU flag\" role=\"img\">
        <rect width=\"60\" height=\"40\" fill=\"#003399\" />
        <g fill=\"#FFCC00\">
          <circle cx=\"30\" cy=\"7\" r=\"1.4\"/><circle cx=\"37\" cy=\"9\" r=\"1.4\"/><circle cx=\"42\" cy=\"14\" r=\"1.4\"/>
          <circle cx=\"44\" cy=\"20\" r=\"1.4\"/><circle cx=\"42\" cy=\"26\" r=\"1.4\"/><circle cx=\"37\" cy=\"31\" r=\"1.4\"/>
          <circle cx=\"30\" cy=\"33\" r=\"1.4\"/><circle cx=\"23\" cy=\"31\" r=\"1.4\"/><circle cx=\"18\" cy=\"26\" r=\"1.4\"/>
          <circle cx=\"16\" cy=\"20\" r=\"1.4\"/><circle cx=\"18\" cy=\"14\" r=\"1.4\"/><circle cx=\"23\" cy=\"9\" r=\"1.4\"/>
        </g>
      </svg>
    </div>
    <section class=\"block\">
      <h2 class=\"section-title\">${escapeHtml(label(labels, "sections.personal_info", "Personal Information"))}</h2>
      ${contactBlock}
    </section>
    <section class=\"block\">
      <h2 class=\"section-title\">${escapeHtml(label(labels, "sections.positioning", "Positioning"))}</h2>
      ${renderEuropassRow(label(labels, "sections.headline", "Headline"), escapeHtml(String(slots["positioning.headline"] ?? getByPath(cv, "positioning.headline") ?? "")))}
      ${renderEuropassRow(label(labels, "sections.profile", "Profile"), profileSummary)}
    </section>
    <section class=\"block\">
      <h2 class=\"section-title\">${escapeHtml(label(labels, "sections.work_experience", "Work Experience"))}</h2>
      ${experienceBlocks}
    </section>
    <section class=\"block\">
      <h2 class=\"section-title\">${escapeHtml(label(labels, "sections.education", "Education"))}</h2>
      ${educationBlocks}
    </section>
    <section class=\"block\">
      <h2 class=\"section-title\">${escapeHtml(label(labels, "sections.personal_competencies", "Personal Skills and Competences"))}</h2>
      ${renderEuropassRow(label(labels, "sections.mother_tongue", "Mother tongue"), escapeHtml(String(motherTongue?.language ?? "")))}
      ${renderEuropassRow(label(labels, "sections.other_languages", "Other languages"), otherLanguageHtml)}
      ${renderEuropassRow(label(labels, "sections.social_skills", "Social Skills"), renderEuropassSimpleList(social))}
      ${renderEuropassRow(label(labels, "sections.organizational_skills", "Organizational Skills"), renderEuropassSimpleList(core))}
      ${renderEuropassRow(label(labels, "sections.technical_skills", "Technical Skills"), renderEuropassSimpleList(technical))}
      ${renderEuropassRow(label(labels, "sections.artistic_skills", "Artistic Skills"), renderEuropassSimpleList(publications))}
      ${renderEuropassRow(label(labels, "sections.other_skills", "Other Skills"), renderEuropassSimpleList(otherSkills))}
      ${renderEuropassRow(label(labels, "sections.driving_license", "Driving licence"), escapeHtml(drivingLicense))}
      ${renderEuropassRow(label(labels, "sections.references", "References"), referencesHtml)}
    </section>
    <section class=\"block\">
      <h2 class=\"section-title\">${escapeHtml(label(labels, "sections.additional_information", "Additional Information"))}</h2>
      ${renderEuropassRow(label(labels, "sections.certifications", "Certifications"), renderEuropassSimpleList(certifications))}
      ${renderEuropassRow(label(labels, "sections.projects", "Projects"), renderEuropassSimpleList(projects))}
      ${renderEuropassRow(label(labels, "sections.awards", "Awards"), renderEuropassSimpleList(awards))}
      ${renderEuropassRow(label(labels, "sections.publications", "Publications"), renderEuropassSimpleList(publications))}
      ${renderEuropassRow(label(labels, "sections.volunteering", "Volunteering"), renderEuropassSimpleList(volunteering))}
      ${renderEuropassRow(label(labels, "sections.patents", "Patents"), renderEuropassSimpleList(patents))}
      ${renderEuropassRow(label(labels, "sections.portfolio_links", "Portfolio links"), renderEuropassSimpleList(portfolioLinks))}
      ${renderEuropassRow(label(labels, "sections.interests", "Interests"), renderEuropassSimpleList(interests))}
    </section>
  </div>
  <footer class=\"page-footer\"></footer>
</body>
</html>`;
}

function renderEdinburgh(
  cv: CvDocument,
  template: TemplateFile,
  slots: Record<string, unknown>,
  labels: Record<string, unknown>,
): string {
  const colors = template.tokens?.colors ?? {};
  const accent = colors.accent ?? "#4E557B";
  const sidebar = colors.sidebar_background ?? "#F2F3F5";
  const margins = resolveMargins(template);
  const experienceDateMode = template.date_display?.experience ?? "exact";
  const educationDateMode = template.date_display?.education ?? "exact";
  const profileSummaryMode = template.text_layout?.profile_summary ?? "multi_paragraph";

  const fullName = String(slots["person.full_name"] ?? getByPath(cv, "person.full_name") ?? "");
  const parts = splitName(fullName);
  const topNameSize = nameSizeMm(parts.top, 4.4, 2.95);
  const bottomNameSize = nameSizeMm(parts.bottom || parts.top, 4.75, 3.3);
  const residenceRaw = getByPath(cv, "person.residence");
  const residenceRecord = asRecord(residenceRaw);
  const residence = [residenceRecord?.city, residenceRecord?.country]
    .filter(Boolean)
    .map((value) => String(value))
    .join(", ");
  const summary = renderParagraphs(
    slots["positioning.profile_summary"] ?? getByPath(cv, "positioning.profile_summary"),
    profileSummaryMode,
    "summary-line",
  );
  const competenciesSection = renderEdinburghCompetenciesSection(labels, cv);
  const optionalCourses = renderSimpleList(
    label(labels, "sections.courses", "Courses"),
    slots["optional.courses"] ?? getByPath(cv, "optional_sections.certifications"),
  );
  const optionalProjects = renderSimpleList(
    label(labels, "sections.projects", "Projects"),
    getByPath(cv, "optional_sections.projects"),
  );
  const optionalAwards = renderSimpleList(
    label(labels, "sections.awards", "Awards"),
    getByPath(cv, "optional_sections.awards"),
  );
  const optionalPublications = "";
  const optionalVolunteering = renderSimpleList(
    label(labels, "sections.volunteering", "Volunteering"),
    getByPath(cv, "optional_sections.volunteering"),
  );
  const optionalPatents = renderSimpleList(
    label(labels, "sections.patents", "Patents"),
    getByPath(cv, "optional_sections.patents"),
  );
  const optionalPortfolio = renderSimpleList(
    label(labels, "sections.portfolio_links", "Portfolio Links"),
    getByPath(cv, "optional_sections.portfolio_links"),
  );
  const pageLabel = label(labels, "common.page", "Page");
  const presentLabel = label(labels, "common.present", "present");

  const photoValue = slots["profile.photo"];
  const photoUrl = typeof photoValue === "string" ? photoValue.trim() : "";

  return `<!doctype html>
<html>
<head>
  <meta charset=\"utf-8\" />
  <link rel=\"stylesheet\" href=\"https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css\" />
  <style>
    @page { size: A4; margin: ${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: \"IBM Plex Sans\", Arial, sans-serif; color: #202124; font-size: 11.4px; line-height: 1.35; }
    .page { width: 100%; display: grid; grid-template-columns: 34% 66%; min-height: calc(297mm - ${margins.top + margins.bottom}mm); }
    .left { background: ${sidebar}; position: relative; }
    .left-header {
      position: relative;
      background: ${accent};
      color: #fff;
      padding: 12mm 7mm 19mm;
      min-height: 58mm;
      text-align: center;
      overflow: visible;
      z-index: 2;
    }
    .left-header::before {
      content: none;
    }
    .left-header::after {
      content: \"\";
      position: absolute;
      left: 0;
      right: 0;
      bottom: -0.1mm;
      height: 24mm;
      background-image: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1000 240' preserveAspectRatio='none'%3E%3Cpath d='M0 54 Q500 174 1000 54 L1000 240 L0 240 Z' fill='%23f2f3f5'/%3E%3Cpath d='M0 54 Q500 174 1000 54' fill='none' stroke='%232c315b' stroke-width='14' stroke-linecap='round'/%3E%3C/svg%3E\");
      background-size: 100% 100%;
      background-repeat: no-repeat;
      z-index: 3;
    }
    .name-main {
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.11em;
      font-size: ${topNameSize}mm;
      font-weight: 600;
      line-height: 1.1;
      max-width: 90%;
      margin-left: auto;
      margin-right: auto;
      white-space: nowrap;
    }
    .name-last {
      margin: 1.2mm 0 0;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-size: ${bottomNameSize}mm;
      font-weight: 700;
      line-height: 1.05;
      max-width: 90%;
      margin-left: auto;
      margin-right: auto;
      white-space: nowrap;
    }
    .photo-wrap {
      position: absolute;
      left: 50%;
      bottom: -4.2mm;
      transform: translateX(-50%);
      width: 33mm;
      height: 33mm;
      overflow: visible;
      z-index: 7;
    }
    .photo-wrap::before {
      content: none;
    }
    .photo-frame {
      position: relative;
      z-index: 3;
      width: 100%;
      height: 100%;
      border-radius: 999px;
      border: 0.95mm solid #fff;
      background: #d1d5db;
      overflow: hidden;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    }
    .photo-frame img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .photo-fallback { width: 100%; height: 100%; display:flex; align-items:center; justify-content:center; color:#4b5563; font-size:10mm; }

    .left-body { padding: 10mm 7mm 6mm; font-size: 11.2px; position: relative; z-index: 1; }
    .left-body section { border-top: 1px solid #d7d9dd; padding-top: 11px; margin-bottom: 14px; }
    .left-body section:first-child { border-top: 0; padding-top: 0; }

    h3 { font-size: 13.2px; letter-spacing: 0.12em; text-transform: uppercase; margin: 0 0 8px; font-weight: 700; }
    h2 { font-size: 24px; margin: 0 0 9px; letter-spacing: 0.02em; font-weight: 700; }

    .contact-list { list-style: none; margin: 0; padding: 0; }
    .contact-list li { display: grid; grid-template-columns: 14px 1fr; gap: 7px; margin: 6px 0; }
    .contact-list .icon { font-size: 10px; padding-top: 2px; }
    .contact-list .kv { display: flex; flex-direction: column; gap: 1px; }
    .contact-list .kv strong { font-size: 10.8px; line-height: 1.1; }
    .contact-list .kv span { font-size: 10.8px; color: #3f4349; line-height: 1.2; }

    .square-bullets { list-style: none; margin: 0; padding: 0; }
    .square-bullets li { display: flex; align-items: center; gap: 8px; margin: 5px 0; }
    .square-bullets .sq { width: 6px; height: 6px; display: inline-block; }

    .edinburgh-languages,
    .edinburgh-skills { list-style: none; margin: 0; padding: 0; }
    .edinburgh-languages li,
    .edinburgh-skills li { display: flex; justify-content: space-between; gap: 8px; margin: 7px 0; align-items: center; }
    .edinburgh-languages .label,
    .edinburgh-skills .label { font-weight: 600; font-size: 11.4px; }
    .edinburgh-languages .dots,
    .edinburgh-skills .dots { display: inline-flex; gap: 4px; }
    .edinburgh-languages .dot,
    .edinburgh-skills .dot { width: 8px; height: 8px; border-radius: 999px; background: #c9ced8; display: inline-block; }

    .right { padding: 6mm 7mm 10mm; background: #fff; }
    .headline { margin: 0 0 8px; font-size: 15px; font-weight: 700; color: #202124; }
    .summary p { margin: 0 0 8px; line-height: 1.48; color: #3f4349; }
    .right > section { margin-bottom: 14px; padding-bottom: 2px; }
    .entry { border-top: 1px solid #ddd; padding-top: 10px; margin-top: 10px; }
    .entry-head { display: flex; justify-content: space-between; gap: 10px; }
    .entry-head h4 { margin: 0; font-size: 14.5px; font-weight: 700; text-transform: none; }
    .entry-head span { font-size: 11.6px; color: #40464f; white-space: nowrap; }
    .org { margin: 3px 0 7px; color: #5f6368; font-weight: 500; }
    .entry ul { margin: 5px 0 0 16px; padding: 0; }
    .entry li { margin: 2px 0; line-height: 1.33; }
    .product-subsection { margin-top: 6px; }
    .product-title { margin: 0 0 3px; font-weight: 700; font-size: 11.4px; color: #2f3640; }
    .product-list { list-style: none; margin: 0; padding: 0; }
    .product-list li { position: relative; padding-left: 14px; margin: 2px 0; }
    .product-list li::before { content: \"\"; position: absolute; left: 0; top: 6px; width: 6px; height: 6px; background: ${accent}; }
    .product-list .product-name { display: block; font-weight: 600; }
    .product-list .product-note-line { display: flex; align-items: flex-start; gap: 6px; margin-top: 1px; }
    .product-list .product-note-tab { color: #666; font-family: \"JetBrains Mono\", monospace; }
    .product-list .product-note-text { display: block; color: #555; font-size: 10.8px; line-height: 1.35; }
    .ref { margin-top: 8px; line-height: 1.35; }
    .right .entry,
    .right .ref,
    .right .subsection {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .page-footer {
      position: fixed;
      right: 0;
      bottom: 0;
      left: 0;
      text-align: right;
      font-size: 10px;
      color: #5f6368;
      padding: 0 1mm 0 0;
    }
    .page-footer::after { content: \"${escapeHtml(pageLabel)} \" counter(page); }
  </style>
</head>
<body>
  <div class=\"page\">
    <aside class=\"left\">
      <div class=\"left-header\">
        <p class=\"name-main\">${escapeHtml(parts.top)}</p>
        ${parts.bottom ? `<p class=\"name-last\">${escapeHtml(parts.bottom)}</p>` : ""}
        <div class=\"photo-wrap\">
          <div class=\"photo-frame\">
            ${
              photoUrl
                ? `<img src=\"${escapeHtml(photoUrl)}\" alt=\"Profile photo\" />`
                : `<div class=\"photo-fallback\"><i class=\"fa-solid fa-user\"></i></div>`
            }
          </div>
        </div>
      </div>
      <div class=\"left-body\">
        ${renderEdinburghContact(slots["contact.block"] ?? getByPath(cv, "person.contact"), residence, fullName, accent, labels)}
        ${renderEdinburghLanguages(slots["skills.languages"] ?? getByPath(cv, "skills.languages"), accent, labels)}
        ${renderEdinburghSkills(slots["skills.technical"] ?? getByPath(cv, "skills.technical"), accent, labels)}
        ${renderEdinburghInterests(slots["optional.interests"] ?? getByPath(cv, "optional_sections.interests"), accent, labels)}
      </div>
    </aside>
    <main class=\"right\">
      <section class=\"summary\">${summary}</section>
      ${renderExperience(
        label(labels, "sections.work_experience", "Work experience"),
        slots["experience.items"] ?? getByPath(cv, "experience"),
        experienceDateMode,
        presentLabel,
        labels,
        { includeProducts: true },
      )}
      ${renderEducation(
        label(labels, "sections.education", "Education and Qualifications"),
        slots["education.items"] ?? getByPath(cv, "education"),
        educationDateMode,
        presentLabel,
      )}
      ${optionalCourses}
      ${optionalProjects}
      ${optionalAwards}
      ${optionalPublications}
      ${optionalVolunteering}
      ${optionalPatents}
      ${optionalPortfolio}
      ${renderReferences(label(labels, "sections.references", "References"), slots["references.items"] ?? getByPath(cv, "references"))}
      ${competenciesSection}
    </main>
  </div>
  <footer class=\"page-footer\"></footer>
</body>
</html>`;
}

function renderGeneric(
  cv: CvDocument,
  template: TemplateFile,
  slots: Record<string, unknown>,
  labels: Record<string, unknown>,
): string {
  const margins = resolveMargins(template);
  const experienceDateMode = template.date_display?.experience ?? "exact";
  const educationDateMode = template.date_display?.education ?? "exact";
  const name = slots["person.full_name"] ?? getByPath(cv, "person.full_name") ?? "";
  const headline = slots["positioning.headline"] ?? getByPath(cv, "positioning.headline") ?? "";
  const pageLabel = label(labels, "common.page", "Page");
  const presentLabel = label(labels, "common.present", "present");

  return `<!doctype html>
<html>
<head>
  <meta charset=\"utf-8\" />
  <style>
    @page { size: A4; margin: ${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: \"IBM Plex Sans\", Arial, sans-serif; color: #202124; font-size: 12px; line-height: 1.35; }
    .page { width: 100%; min-height: calc(297mm - ${margins.top + margins.bottom}mm); display: grid; grid-template-columns: 250px 1fr; }
    .left { background: #f3f4f6; padding: 22px 18px; border-right: 1px solid #d1d5db; }
    .right { padding: 26px 30px; }
    h1 { margin: 0; font-size: 25px; }
    h2 { font-size: 21px; margin: 0 0 10px; }
    h3 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 8px; }
    h4 { margin: 0; font-size: 15px; }
    section { margin-bottom: 18px; }
    ul { margin: 8px 0 0 18px; padding: 0; }
    .entry { border-top: 1px solid #ddd; padding-top: 10px; margin-top: 10px; }
    .entry-head { display: flex; justify-content: space-between; gap: 10px; }
    .org { margin: 4px 0 8px; color: #5f6368; }
    .page-footer {
      position: fixed;
      right: 0;
      bottom: 0;
      left: 0;
      text-align: right;
      font-size: 10px;
      color: #5f6368;
      padding: 0 1mm 0 0;
    }
    .page-footer::after { content: \"${escapeHtml(pageLabel)} \" counter(page); }
  </style>
</head>
<body>
  <div class=\"page\">
    <aside class=\"left\">
      ${renderContact(label(labels, "sections.contact", "Contact"), slots["contact.block"] ?? getByPath(cv, "person.contact"))}
      ${renderLanguages(label(labels, "sections.languages", "Languages"), slots["skills.languages"] ?? getByPath(cv, "skills.languages"))}
      ${renderSimpleList(label(labels, "sections.technical_skills", "Technical Skills"), slots["skills.technical"] ?? getByPath(cv, "skills.technical"))}
      ${renderSimpleList(label(labels, "sections.social_skills", "Social Skills"), slots["skills.social"] ?? getByPath(cv, "skills.social"))}
    </aside>
    <main class=\"right\">
      <h1>${escapeHtml(name)}</h1>
      <p>${escapeHtml(headline)}</p>
      ${renderSimpleList(label(labels, "sections.profile", "Profile"), slots["positioning.profile_summary"] ?? getByPath(cv, "positioning.profile_summary"))}
      ${renderExperience(
        label(labels, "sections.work_experience", "Work Experience"),
        slots["experience.items"] ?? getByPath(cv, "experience"),
        experienceDateMode,
        presentLabel,
        labels,
      )}
      ${renderEducation(
        label(labels, "sections.education", "Education"),
        slots["education.items"] ?? getByPath(cv, "education"),
        educationDateMode,
        presentLabel,
      )}
      ${renderReferences(label(labels, "sections.references", "References"), slots["references.items"] ?? getByPath(cv, "references"))}
    </main>
  </div>
  <footer class=\"page-footer\"></footer>
</body>
</html>`;
}

async function readYamlFile<T>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, "utf-8");
  return parse(content) as T;
}

async function resolveMappingPath(cvId: string, templateId: string): Promise<string> {
  const exact = repoPath("data", "template_mappings", `${cvId}__${templateId}.yaml`);
  try {
    await fs.access(exact);
    return exact;
  } catch {
    const parsed = parseCvVariantId(cvId);
    if (!parsed) {
      throw new Error(`Missing mapping for cvId=${cvId} templateId=${templateId}.`);
    }
    const fallback = buildCvVariantId({
      language: "bg",
      iteration: parsed.iteration,
      target: parsed.target,
    });
    const fallbackPath = repoPath("data", "template_mappings", `${fallback}__${templateId}.yaml`);
    await fs.access(fallbackPath);
    return fallbackPath;
  }
}

function bindSlots(cv: CvDocument, mapping: MappingFile): Record<string, unknown> {
  const bound: Record<string, unknown> = {};
  for (const binding of mapping.bindings ?? []) {
    if (!binding.slot_id || !binding.cv_path) continue;
    bound[binding.slot_id] = getByPath(cv, binding.cv_path);
  }
  return bound;
}

export async function buildCvTemplateHtml(input: RenderInput): Promise<RenderResult> {
  const cv = await readCv(input.cvId);
  if (!cv) {
    throw new Error(`CV '${input.cvId}' was not found.`);
  }

  const templatePath = repoPath("templates", input.templateId, "template.yaml");
  const mappingPath = await resolveMappingPath(input.cvId, input.templateId);
  const [template, mapping] = await Promise.all([
    readYamlFile<TemplateFile>(templatePath),
    readYamlFile<MappingFile>(mappingPath),
  ]);

  const lang = resolveRenderLanguage(cv, input.cvId);
  const labels = template.labels?.[lang] ?? template.labels?.en ?? {};

  const slots = bindSlots(cv, mapping);
  const html =
    input.templateId === "edinburgh-v1"
      ? renderEdinburgh(cv, template, slots, labels)
      : input.templateId === "europass-v1"
        ? renderEuropass(cv, template, slots, labels)
      : renderGeneric(cv, template, slots, labels);

  return {
    html,
    cvId: input.cvId,
    templateId: input.templateId,
  };
}
