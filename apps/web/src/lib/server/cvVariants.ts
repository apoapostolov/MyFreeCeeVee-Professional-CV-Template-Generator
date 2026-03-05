export type CvLanguage = "bg" | "en";

export type CvVariantParts = {
  language: CvLanguage;
  iteration: string;
  target: string;
};

const CV_ID_PATTERN = /^cv_(bg|en)_(\d{3,4})_([a-z0-9][a-z0-9_-]{1,79})$/i;

export function isSupportedLanguage(value: string): value is CvLanguage {
  return value === "bg" || value === "en";
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
  return `cv_${parts.language}_${parts.iteration}_${parts.target}`;
}

export function siblingLanguage(language: CvLanguage): CvLanguage {
  return language === "bg" ? "en" : "bg";
}
