export type JsonSchema = {
  [key: string]: unknown;
};

export type CvValidationIssue = {
  path: string;
  message: string;
};

export type CvValidationResult = {
  valid: boolean;
  issues: CvValidationIssue[];
};

export const CV_V1_JSON_SCHEMA: JsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "cv.v1",
  type: "object",
  required: [
    "schema",
    "person",
    "positioning",
    "experience",
    "education",
    "skills",
    "metadata",
  ],
  properties: {
    schema: {
      type: "object",
      required: ["id", "version", "profile_type", "locale"],
      properties: {
        id: { type: "string" },
        version: { type: "string" },
        profile_type: { type: "string" },
        locale: { type: "string" },
      },
      additionalProperties: true,
    },
    person: {
      type: "object",
      required: ["full_name", "contact"],
      properties: {
        full_name: { type: "string", minLength: 1 },
        contact: {
          type: "object",
          required: ["email"],
          properties: {
            email: { type: "string", minLength: 3 },
          },
          additionalProperties: true,
        },
      },
      additionalProperties: true,
    },
    positioning: {
      type: "object",
      required: ["headline", "profile_summary"],
      properties: {
        headline: { type: "string", minLength: 1 },
        profile_summary: { type: "array" },
      },
      additionalProperties: true,
    },
    experience: {
      type: "array",
    },
    education: {
      type: "array",
    },
    skills: {
      type: "object",
      required: ["technical", "social", "languages"],
      additionalProperties: true,
    },
    metadata: {
      type: "object",
      required: ["status", "updated_at", "language"],
      properties: {
        language: { type: "string", enum: ["bg", "en"] },
      },
      additionalProperties: true,
    },
  },
  additionalProperties: true,
};

const REQUIRED_PATHS: ReadonlyArray<ReadonlyArray<string>> = [
  ["schema", "version"],
  ["person", "full_name"],
  ["person", "contact", "email"],
  ["positioning", "headline"],
  ["positioning", "profile_summary"],
  ["experience"],
  ["education"],
  ["skills", "technical"],
  ["skills", "social"],
  ["skills", "languages"],
  ["metadata", "language"],
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getPathValue(
  input: Record<string, unknown>,
  path: ReadonlyArray<string>,
): unknown {
  let cursor: unknown = input;
  for (const segment of path) {
    if (!isRecord(cursor) || !(segment in cursor)) {
      return undefined;
    }
    cursor = cursor[segment];
  }
  return cursor;
}

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === "string") {
    return value.trim().length === 0;
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  return false;
}

export function validateCvV1(input: unknown): CvValidationResult {
  const issues: CvValidationIssue[] = [];

  if (!isRecord(input)) {
    return {
      valid: false,
      issues: [{ path: "$", message: "CV payload must be an object." }],
    };
  }

  for (const path of REQUIRED_PATHS) {
    const value = getPathValue(input, path);
    if (isEmptyValue(value)) {
      issues.push({
        path: path.join("."),
        message: "Required field is missing or empty.",
      });
    }
  }

  const schemaVersion = getPathValue(input, ["schema", "version"]);
  if (typeof schemaVersion !== "string") {
    issues.push({
      path: "schema.version",
      message: "schema.version must be a string.",
    });
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
