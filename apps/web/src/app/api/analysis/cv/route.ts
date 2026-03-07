import { NextResponse } from "next/server";

import { readCv } from "@/lib/server/cvStore";
import { readOpenRouterSettings } from "@/lib/server/openRouterSettings";

export const runtime = "nodejs";

type ScoreRequest = {
  cvId?: unknown;
  templateId?: unknown;
  scope?: unknown;
  sectionKey?: unknown;
};

type TargetCompanyContext = {
  company_name: string;
  priority?: number;
  company_details?: Record<string, unknown>;
  target_roles?: unknown[];
  target_functions?: unknown[];
  target_seniority?: string;
  tailoring_priorities?: unknown[];
  value_proposition?: string;
  motivation?: string;
  keywords_to_echo?: unknown[];
  application_context?: string;
  interview_context?: string;
};

function asRecord(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return null;
  }
  return input as Record<string, unknown>;
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

function extractFirstJsonBlock(input: string): unknown {
  const trimmed = input.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // no-op
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      // no-op
    }
  }
  return {
    raw: input,
    parse_error: "Could not parse JSON from model response.",
  };
}

function getTargetCompanyContext(cv: Record<string, unknown>): {
  enabled: boolean;
  companies: TargetCompanyContext[];
  summary: string;
} {
  const targeting = asRecord(cv.targeting);
  const rawCompanies = Array.isArray(targeting?.target_companies)
    ? targeting.target_companies
    : [];

  const companies: TargetCompanyContext[] = [];
  for (const rawEntry of rawCompanies) {
    const entry = asRecord(rawEntry);
    if (!entry) {
      continue;
    }
    const name = typeof entry.company_name === "string" ? entry.company_name.trim() : "";
    if (!name) {
      continue;
    }
    companies.push({
        company_name: name,
        priority: typeof entry.priority === "number" ? entry.priority : undefined,
        company_details: asRecord(entry.company_details) ?? undefined,
        target_roles: Array.isArray(entry.target_roles) ? entry.target_roles : undefined,
        target_functions: Array.isArray(entry.target_functions) ? entry.target_functions : undefined,
        target_seniority:
          typeof entry.target_seniority === "string" && entry.target_seniority.trim().length > 0
            ? entry.target_seniority.trim()
            : undefined,
        tailoring_priorities: Array.isArray(entry.tailoring_priorities) ? entry.tailoring_priorities : undefined,
        value_proposition:
          typeof entry.value_proposition === "string" && entry.value_proposition.trim().length > 0
            ? entry.value_proposition.trim()
            : undefined,
        motivation:
          typeof entry.motivation === "string" && entry.motivation.trim().length > 0
            ? entry.motivation.trim()
            : undefined,
        keywords_to_echo: Array.isArray(entry.keywords_to_echo) ? entry.keywords_to_echo : undefined,
        application_context:
          typeof entry.application_context === "string" && entry.application_context.trim().length > 0
            ? entry.application_context.trim()
            : undefined,
        interview_context:
          typeof entry.interview_context === "string" && entry.interview_context.trim().length > 0
            ? entry.interview_context.trim()
            : undefined,
      });
  }

  if (companies.length === 0) {
    return {
      enabled: false,
      companies: [],
      summary:
        "Targeting context is unavailable because targeting.target_companies does not contain at least one valid company entry. Ignore targeting and provide generic CV analysis.",
    };
  }

  return {
    enabled: true,
    companies,
    summary:
      "Use targeting context to judge relevance and rewrite advice against the listed target companies. When feedback conflicts across companies, prefer actions that strengthen the highest-priority company without hurting the others.",
  };
}

function buildPrompt(
  scope: "full" | "section",
  templateId: string,
  cv: Record<string, unknown>,
  sectionKey: string,
  sectionValue: unknown,
): string {
  const targetingContext = getTargetCompanyContext(cv);
  const rubric = [
    "Use this weighted rubric (total 100):",
    "- timeline_integrity_consistency: 25",
    "- relevance_to_target_role_or_sector: 20",
    "- evidence_and_quantified_outcomes: 15",
    "- readability_and_screening_structure: 15",
    "- credibility_and_coherence_signals: 10",
    "- transition_logic_and_motivation: 10",
    "- language_quality_and_professional_tone: 5",
    "Scoring rules:",
    "- Penalize overlaps/date conflicts unless clearly labeled as parallel roles.",
    "- Penalize duty-only bullets without measurable impact.",
    "- Reward concrete impact (scope, scale, %, time/cost, throughput, quality).",
    "- Reward ATS-safe structure (clear headings, consistent chronology, parse-friendly bullets).",
    "- Penalize invented claims: if evidence is missing, state uncertainty explicitly.",
    "- Keep recommendations interview-safe and realistic (no fabricated metrics).",
    targetingContext.enabled
      ? "- Relevance scoring and rewrite advice must account for the listed target companies in targeting.target_companies."
      : "- Ignore targeting because targeting.target_companies has no valid company entries.",
  ].join("\n");

  if (scope === "section") {
    return [
      "You are a senior CV reviewer and recruiter-screening analyst.",
      "Analyze only the requested CV section while considering full CV context.",
      targetingContext.summary,
      rubric,
      "Output schema:",
      "{",
      '  "scope": "section",',
      '  "section": "<section-key>",',
      '  "score": 0-100,',
      '  "summary": "2-4 sentence summary with concrete reasons",',
      '  "confidence": "High|Medium|Low",',
      '  "field_feedback": [',
      '    {',
      '      "field": "dot.path",',
      '      "score": 0-100,',
      '      "analysis": "specific issue/evidence in 1-3 sentences",',
      '      "proposal": "improved text that stays truthful and ATS-friendly"',
      "    }",
      "  ],",
      '  "findings": [',
      '    { "severity": "Critical|Major|Moderate|Minor", "issue": "short title", "impact": "why it matters", "fix": "what to change" }',
      "  ],",
      '  "top_actions": ["action 1", "action 2", "action 3"],',
      '  "expected_score_gain_if_applied": "e.g. +8 to +12"',
      "}",
      "Return STRICT JSON only. No markdown. No prose outside JSON.",
      `Template: ${templateId}`,
      `Section key: ${sectionKey}`,
      `Target companies JSON:\n${JSON.stringify(targetingContext.companies, null, 2)}`,
      `Section payload JSON:\n${JSON.stringify(sectionValue ?? {}, null, 2)}`,
      `Full CV context JSON:\n${JSON.stringify(cv, null, 2)}`,
    ].join("\n");
  }

  return [
    "You are a senior CV reviewer and recruiter-screening analyst.",
    "Analyze the whole CV and return strict JSON with weighted scoring and prioritized fixes.",
    targetingContext.summary,
    rubric,
    "Output schema:",
    "{",
    '  "scope": "full",',
    '  "overall_score": 0-100,',
    '  "summary": "3-6 sentence executive screening summary",',
    '  "confidence": "High|Medium|Low",',
    '  "weighted_breakdown": {',
    '    "timeline_integrity_consistency": 0-25,',
    '    "relevance_to_target_role_or_sector": 0-20,',
    '    "evidence_and_quantified_outcomes": 0-15,',
    '    "readability_and_screening_structure": 0-15,',
    '    "credibility_and_coherence_signals": 0-10,',
    '    "transition_logic_and_motivation": 0-10,',
    '    "language_quality_and_professional_tone": 0-5',
    "  },",
    '  "section_scores": [',
    '    {',
    '      "section": "name",',
    '      "score": 0-100,',
    '      "strengths": ["..."],',
    '      "issues": ["..."],',
    '      "improvements": ["..."]',
    "    }",
    "  ],",
    '  "findings": [',
    '    { "severity": "Critical|Major|Moderate|Minor", "issue": "short title", "impact": "why it matters", "fix": "what to change" }',
    "  ],",
    '  "top_actions": ["action 1", "action 2", "action 3", "action 4", "action 5"],',
    '  "expected_score_gain_if_top_actions_applied": "e.g. +10 to +16"',
    "}",
    "Return STRICT JSON only. No markdown. No prose outside JSON.",
    `Template: ${templateId}`,
    `Target companies JSON:\n${JSON.stringify(targetingContext.companies, null, 2)}`,
    `CV JSON:\n${JSON.stringify(cv, null, 2)}`,
  ].join("\n");
}

export async function POST(request: Request): Promise<NextResponse> {
  const payload = (await request.json()) as ScoreRequest;

  const cvId = typeof payload.cvId === "string" ? payload.cvId.trim() : "";
  const templateId =
    typeof payload.templateId === "string" && payload.templateId.trim().length > 0
      ? payload.templateId.trim()
      : "europass-v1";
  const scope = payload.scope === "section" ? "section" : "full";
  const sectionKey =
    typeof payload.sectionKey === "string" && payload.sectionKey.trim().length > 0
      ? payload.sectionKey.trim()
      : "positioning";

  if (!cvId) {
    return NextResponse.json({ error: "cvId is required." }, { status: 400 });
  }

  const cv = await readCv(cvId);
  if (!cv) {
    return NextResponse.json({ error: "CV not found." }, { status: 404 });
  }

  const settings = await readOpenRouterSettings();
  const apiKey = settings.apiKey || process.env.OPENROUTER_API_KEY || "";
  if (!apiKey) {
    return NextResponse.json(
      { error: "OpenRouter API key is not configured." },
      { status: 400 },
    );
  }

  const sectionValue = scope === "section" ? getByPath(cv, sectionKey) : null;
  const prompt = buildPrompt(
    scope,
    templateId,
    cv as Record<string, unknown>,
    sectionKey,
    sectionValue,
  );

  const response = await fetch(settings.baseUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model || "openai/gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a strict JSON generator." },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const raw = await response.text();
    return NextResponse.json(
      { error: "OpenRouter request failed.", status: response.status, raw },
      { status: 502 },
    );
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content ?? "";
  const parsed = extractFirstJsonBlock(content);
  return NextResponse.json({
    ok: true,
    scope,
    cvId,
    templateId,
    sectionKey: scope === "section" ? sectionKey : undefined,
    analysis: parsed,
    raw: content,
  });
}
