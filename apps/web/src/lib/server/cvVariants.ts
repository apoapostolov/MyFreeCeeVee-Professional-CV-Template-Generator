export type CvLanguage = string;
export type SyncLanguage = "bg" | "en";

export type CvVariantParts = {
  language: CvLanguage;
  iteration: string;
  target: string;
};

export type CvVariantPartsLoose = {
  language: CvLanguage;
  iteration: string | null;
  target: string;
};

const CV_ID_PATTERN = /^cv_([a-z]{2,8})_(\d{3,4})_([a-z0-9][a-z0-9_-]{1,79})$/i;
const CV_ID_PATTERN_NO_ITERATION = /^cv_([a-z]{2,8})_([a-z0-9][a-z0-9_-]{1,79})$/i;
const SYNC_LANGUAGES = new Set<SyncLanguage>(["bg", "en"]);

export function isSupportedLanguage(value: string): value is CvLanguage {
  return /^[a-z]{2,8}$/i.test(value.trim());
}

export function isSyncLanguage(value: string): value is SyncLanguage {
  return SYNC_LANGUAGES.has(value as SyncLanguage);
}

export function parseCvVariantId(cvId: string): CvVariantParts | null {
  const match = CV_ID_PATTERN.exec(cvId.trim());
  if (!match) {
    return null;
  }

  const language = match[1].toLowerCase();
  if (!isSupportedLanguage(language)) {
    return null;
  }

  return {
    language,
    iteration: match[2],
    target: match[3].toLowerCase(),
  };
}

export function buildCvVariantId(parts: CvVariantParts): string {
  return `cv_${parts.language.toLowerCase()}_${parts.iteration}_${parts.target}`;
}

export function parseCvVariantIdLoose(cvId: string): CvVariantPartsLoose | null {
  const strict = parseCvVariantId(cvId);
  if (strict) {
    return {
      language: strict.language,
      iteration: strict.iteration,
      target: strict.target,
    };
  }

  const match = CV_ID_PATTERN_NO_ITERATION.exec(cvId.trim());
  if (!match) {
    return null;
  }

  const language = match[1].toLowerCase();
  if (!isSupportedLanguage(language)) {
    return null;
  }

  return {
    language,
    iteration: null,
    target: match[2].toLowerCase(),
  };
}

export function buildCvVariantIdLoose(parts: CvVariantPartsLoose): string {
  if (parts.iteration && parts.iteration.trim().length > 0) {
    return buildCvVariantId({
      language: parts.language,
      iteration: parts.iteration,
      target: parts.target,
    });
  }
  return `cv_${parts.language.toLowerCase()}_${parts.target}`;
}

export function siblingLanguage(language: SyncLanguage): SyncLanguage {
  return language === "bg" ? "en" : "bg";
}
