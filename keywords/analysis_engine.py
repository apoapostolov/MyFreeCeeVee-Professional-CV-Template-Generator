#!/usr/bin/env python3
"""Deterministic CV keyword analysis engine for JD corpora."""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DEFAULT_SECTION_WEIGHTS: dict[str, float] = {
  "experience": 2.4,
  "skills": 1.7,
  "summary": 1.5,
  "projects": 1.3,
  "education": 1.1,
  "certifications": 1.0,
  "other": 1.0,
}

DEFAULT_CATEGORY_MULTIPLIERS: dict[str, float] = {
  "hard_skill": 1.18,
  "soft_skill": 1.05,
  "seniority": 1.22,
  "action_verb": 1.12,
  "domain_term": 1.14,
  "unknown": 1.0,
}

DEFAULT_COVERAGE_THRESHOLDS: dict[str, dict[str, float]] = {
  "default": {"critical": 0.05, "high": 0.25, "medium": 0.55, "low": 0.8, "critical_weight": 0.7},
  "hard_skill": {"critical": 0.08, "high": 0.28, "medium": 0.58, "low": 0.82, "critical_weight": 0.65},
  "soft_skill": {"critical": 0.02, "high": 0.18, "medium": 0.5, "low": 0.78, "critical_weight": 0.75},
  "seniority": {"critical": 0.08, "high": 0.3, "medium": 0.6, "low": 0.84, "critical_weight": 0.6},
  "action_verb": {"critical": 0.04, "high": 0.22, "medium": 0.52, "low": 0.8, "critical_weight": 0.7},
  "domain_term": {"critical": 0.06, "high": 0.24, "medium": 0.56, "low": 0.8, "critical_weight": 0.68},
}

STOPWORDS = {
  "a", "an", "and", "as", "at", "be", "by", "for", "from", "in", "is", "it", "of", "on", "or", "that", "the", "to", "with",
}

NEGATION_TOKENS = {"no", "not", "without", "never", "none", "lack", "lacking", "non"}
NUMBER_HINT_RE = re.compile(r"(\d+[%kmbx]?|\$[\d,.]+|percent|increase|reduction|improved|grew|growth)", re.IGNORECASE)
TOKEN_RE = re.compile(r"[a-z0-9][a-z0-9+#\-/]*")
SPACE_RE = re.compile(r"\s+")
NON_ALNUM_SPACE_RE = re.compile(r"[^a-z0-9+\-./\s]")
SENIORITY_SIGNAL_RE = re.compile(r"\b(senior|lead|principal|director|head|manager|executive|staff|vp|chief|ownership|strategic)\b", re.IGNORECASE)
TEAM_OWNERSHIP_RE = re.compile(r"\b(team\s+of\s+\d+|manage\s+\d+|managing\s+\d+|people\s+management|hiring)\b", re.IGNORECASE)
ACTION_VERB_HINT_RE = re.compile(r"\b(achieved|developed|managed|analyzed|optimized|directed|mentored|supervised|executed|spearheaded|accelerated|streamlined|delivered)\b", re.IGNORECASE)


@dataclass(frozen=True)
class KeywordScore:
  keyword: str
  normalized_keyword: str
  category: str
  category_confidence: float
  jd_doc_freq: int
  jd_term_freq: int
  tfidf_weight: float
  role_prior: float
  final_weight: float
  cv_hits_total: int
  cv_negated_hits: int
  cv_section_hits: dict[str, int]
  cv_weighted_hits: float
  evidence_hits: int
  evidence_multiplier: float
  coverage: float
  confidence: float
  gap_severity: str


def utc_now_iso() -> str:
  return datetime.now(timezone.utc).isoformat()


def normalize_space(value: str) -> str:
  return SPACE_RE.sub(" ", value).strip()


def normalize_text(value: str) -> str:
  lowered = value.lower()
  cleaned = NON_ALNUM_SPACE_RE.sub(" ", lowered)
  return normalize_space(cleaned)


def lemmatize_word(token: str) -> str:
  if len(token) <= 3:
    return token
  if token.endswith("ies") and len(token) > 4:
    return token[:-3] + "y"
  if token.endswith("ing") and len(token) > 5:
    stem = token[:-3]
    if len(stem) >= 3 and stem[-1] == stem[-2]:
      stem = stem[:-1]
    return stem
  if token.endswith("ed") and len(token) > 4:
    stem = token[:-2]
    if len(stem) >= 3 and stem[-1] == stem[-2]:
      stem = stem[:-1]
    return stem
  if token.endswith("es") and len(token) > 4:
    if token.endswith(("ses", "xes", "zes", "ches", "shes")):
      return token[:-2]
    return token[:-1]
  if token.endswith("s") and len(token) > 4:
    return token[:-1]
  return token


def normalize_phrase(value: str) -> str:
  tokens = [lemmatize_word(match.group(0)) for match in TOKEN_RE.finditer(normalize_text(value))]
  return " ".join(tokens)


def tokenize(text: str) -> list[str]:
  tokens = [lemmatize_word(match.group(0)) for match in TOKEN_RE.finditer(normalize_text(text))]
  return [token for token in tokens if token and token not in STOPWORDS]


def extract_terms(text: str, max_ngram: int = 4) -> list[str]:
  tokens = tokenize(text)
  terms: list[str] = []
  terms.extend(tokens)
  for n in range(2, max_ngram + 1):
    if len(tokens) < n:
      continue
    for idx in range(0, len(tokens) - n + 1):
      gram_tokens = tokens[idx : idx + n]
      if any(token in STOPWORDS for token in gram_tokens):
        continue
      terms.append(" ".join(gram_tokens))
  return terms


def parse_input(path: Path) -> dict[str, Any]:
  data = json.loads(path.read_text(encoding="utf-8"))
  if not isinstance(data, dict):
    raise ValueError("Input payload must be a JSON object.")
  return data


def parse_iso(value: str) -> datetime | None:
  if not value:
    return None
  try:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))
  except Exception:
    return None


def jaccard_similarity(a: set[str], b: set[str]) -> float:
  if not a and not b:
    return 1.0
  if not a or not b:
    return 0.0
  return len(a.intersection(b)) / max(1, len(a.union(b)))


def load_taxonomy(config: dict[str, Any], root: Path) -> dict[str, Any]:
  taxonomy_file = str(config.get("taxonomy_file") or "config/keyword_taxonomy.json").strip()
  path = (root / taxonomy_file).resolve()
  if not path.exists():
    return {
      "aliases": {},
      "categories": {
        "hard_skill": [],
        "soft_skill": [],
        "seniority": [],
        "action_verb": [],
        "domain_term": [],
      },
      "role_cluster_profiles": {},
    }
  raw = json.loads(path.read_text(encoding="utf-8"))
  aliases = {normalize_phrase(str(k)): normalize_phrase(str(v)) for k, v in (raw.get("aliases") or {}).items()}
  categories_raw = raw.get("categories") or {}
  categories: dict[str, set[str]] = {}
  for name in ["hard_skill", "soft_skill", "seniority", "action_verb", "domain_term"]:
    values = categories_raw.get(name) or []
    categories[name] = {normalize_phrase(str(v)) for v in values if normalize_phrase(str(v))}
  return {
    "aliases": aliases,
    "categories": categories,
    "role_cluster_profiles": raw.get("role_cluster_profiles") or {},
  }


def apply_aliases(text: str, aliases: dict[str, str]) -> str:
  if not aliases:
    return text
  out = f" {normalize_phrase(text)} "
  for source, target in sorted(aliases.items(), key=lambda item: len(item[0]), reverse=True):
    if not source or not target:
      continue
    out = out.replace(f" {source} ", f" {target} ")
  return normalize_space(out)


def validate_input_payload(payload: dict[str, Any]) -> None:
  if "cv" not in payload or "jd_corpus" not in payload:
    raise ValueError("Input schema requires `cv` and `jd_corpus`.")
  cv = payload.get("cv")
  if not isinstance(cv, dict):
    raise ValueError("`cv` must be an object.")
  sections = cv.get("sections")
  if not isinstance(sections, dict) or not sections:
    raise ValueError("`cv.sections` must be a non-empty object.")
  for key, value in sections.items():
    if not isinstance(key, str) or not key.strip():
      raise ValueError("`cv.sections` keys must be non-empty strings.")
    if not isinstance(value, str):
      raise ValueError("`cv.sections` values must be strings.")
  corpus = payload.get("jd_corpus")
  if not isinstance(corpus, list) or not corpus:
    raise ValueError("`jd_corpus` must be a non-empty array.")
  for item in corpus:
    if not isinstance(item, dict):
      raise ValueError("Each `jd_corpus` item must be an object.")
    text = item.get("text")
    if not isinstance(text, str) or not text.strip():
      raise ValueError("Each `jd_corpus` item must include non-empty `text`.")
    if "score" in item and not isinstance(item.get("score"), (int, float)):
      raise ValueError("`jd_corpus[].score` must be numeric when provided.")


def infer_section_weight(section_name: str, custom_weights: dict[str, float]) -> float:
  lowered = section_name.lower()
  if lowered in custom_weights:
    return max(0.1, float(custom_weights[lowered]))
  for key, weight in custom_weights.items():
    if key in lowered:
      return max(0.1, float(weight))
  return max(0.1, float(custom_weights.get("other", DEFAULT_SECTION_WEIGHTS["other"])))


def split_sentences(text: str) -> list[str]:
  return [part.strip() for part in re.split(r"[.!?\n]+", text) if part.strip()]


def phrase_hits_with_negation(text: str, phrase: str) -> tuple[int, int]:
  tokens = tokenize(text)
  term_tokens = phrase.split(" ")
  if not tokens or not term_tokens:
    return 0, 0
  hits = 0
  negated = 0
  n = len(term_tokens)
  for idx in range(0, len(tokens) - n + 1):
    if tokens[idx : idx + n] != term_tokens:
      continue
    window = tokens[max(0, idx - 3) : idx]
    if any(token in NEGATION_TOKENS for token in window):
      negated += 1
      continue
    hits += 1
  return hits, negated


def evidence_hits_for_phrase(section_text: str, phrase: str) -> int:
  if not section_text or not phrase:
    return 0
  total = 0
  for sentence in split_sentences(section_text):
    sentence_norm = normalize_phrase(sentence)
    if phrase not in sentence_norm:
      continue
    if any(token in NEGATION_TOKENS for token in sentence_norm.split(" ")):
      continue
    if NUMBER_HINT_RE.search(sentence):
      total += 1
  return total


def calc_confidence(doc_count: int, keyword_count: int, avg_doc_length: float, duplicate_ratio: float) -> float:
  corpus_score = min(1.0, doc_count / 25.0)
  diversity_score = min(1.0, keyword_count / 120.0)
  length_score = min(1.0, avg_doc_length / 700.0)
  uniqueness_score = 1.0 - min(0.5, duplicate_ratio)
  return round((corpus_score * 0.35) + (diversity_score * 0.3) + (length_score * 0.15) + (uniqueness_score * 0.2), 4)


def classify_term(term: str, taxonomy: dict[str, Any]) -> tuple[str, float]:
  categories: dict[str, set[str]] = taxonomy.get("categories") or {}
  for cat in ["hard_skill", "soft_skill", "seniority", "action_verb", "domain_term"]:
    if term in (categories.get(cat) or set()):
      return cat, 0.95

  if SENIORITY_SIGNAL_RE.search(term):
    return "seniority", 0.75
  if ACTION_VERB_HINT_RE.search(term):
    return "action_verb", 0.7
  if re.search(r"\b(sql|python|looker|snowflake|bigquery|engine|testing|modeling|analytics|telemetry)\b", term):
    return "hard_skill", 0.72
  if re.search(r"\b(communication|collaboration|stakeholder|mentoring|feedback|listening)\b", term):
    return "soft_skill", 0.68
  if term.count(" ") >= 1:
    return "domain_term", 0.58
  return "unknown", 0.5


def calc_gap_severity(coverage: float, normalized_weight: float, category: str, thresholds: dict[str, dict[str, float]]) -> str:
  cfg = thresholds.get(category) or thresholds.get("default") or DEFAULT_COVERAGE_THRESHOLDS["default"]
  critical_weight = float(cfg.get("critical_weight", 0.7))
  if coverage < float(cfg.get("critical", 0.05)) and normalized_weight >= critical_weight:
    return "critical"
  if coverage < float(cfg.get("high", 0.25)):
    return "high"
  if coverage < float(cfg.get("medium", 0.55)):
    return "medium"
  if coverage < float(cfg.get("low", 0.8)):
    return "low"
  return "none"


def build_action(keyword: KeywordScore) -> str:
  if keyword.gap_severity == "critical":
    return f"Add `{keyword.keyword}` ({keyword.category}) in an experience bullet with quantified impact."
  if keyword.gap_severity == "high":
    return f"Introduce `{keyword.keyword}` in summary and one evidence-backed section."
  if keyword.gap_severity == "medium":
    return f"Increase `{keyword.keyword}` usage in skills/projects with role-relevant context."
  return f"Maintain `{keyword.keyword}` coverage and keep evidence specific."


def infer_seniority_intent(jd_items: list[dict[str, Any]]) -> dict[str, Any]:
  signal_hits = 0
  ownership_hits = 0
  for item in jd_items:
    text = f"{item.get('title', '')} {item.get('text', '')}"
    if SENIORITY_SIGNAL_RE.search(text):
      signal_hits += 1
    if TEAM_OWNERSHIP_RE.search(text):
      ownership_hits += 1
  docs = max(1, len(jd_items))
  score = min(1.0, (signal_hits / docs) * 0.7 + (ownership_hits / docs) * 0.3)
  return {
    "detected": score >= 0.2,
    "score": round(score, 4),
    "signal_docs": signal_hits,
    "ownership_docs": ownership_hits,
  }


def analyze(payload: dict[str, Any], root: Path | None = None) -> dict[str, Any]:
  validate_input_payload(payload)
  base_root = root or Path(__file__).resolve().parent

  config = payload.get("config", {}) if isinstance(payload.get("config"), dict) else {}
  section_weights = {**DEFAULT_SECTION_WEIGHTS}
  for key, value in (config.get("section_weights", {}) or {}).items():
    if isinstance(key, str) and isinstance(value, (int, float)):
      section_weights[key.lower()] = float(value)

  weighted_keywords_raw = config.get("weighted_keywords", {})
  weighted_keywords: dict[str, float] = {}
  if isinstance(weighted_keywords_raw, dict):
    for key, value in weighted_keywords_raw.items():
      if not isinstance(key, str) or not key.strip() or not isinstance(value, (int, float)):
        continue
      normalized = normalize_phrase(key)
      if normalized:
        weighted_keywords[normalized] = max(0.0, float(value))

  taxonomy = load_taxonomy(config, base_root)
  aliases = taxonomy.get("aliases") or {}

  category_multipliers = {**DEFAULT_CATEGORY_MULTIPLIERS}
  for key, value in (config.get("category_multipliers", {}) or {}).items():
    if isinstance(key, str) and isinstance(value, (int, float)):
      category_multipliers[key] = float(value)

  role_cluster = str(config.get("role_cluster") or "producer").strip().lower()
  cluster_profiles = taxonomy.get("role_cluster_profiles") or {}
  cluster_profile = cluster_profiles.get(role_cluster) if isinstance(cluster_profiles, dict) else None
  if isinstance(cluster_profile, dict):
    for key, value in cluster_profile.items():
      if isinstance(key, str) and isinstance(value, (int, float)):
        category_multipliers[key] = category_multipliers.get(key, 1.0) * float(value)

  coverage_thresholds = {**DEFAULT_COVERAGE_THRESHOLDS}
  for cat, cfg in (config.get("coverage_thresholds", {}) or {}).items():
    if not isinstance(cat, str) or not isinstance(cfg, dict):
      continue
    merged = {**(coverage_thresholds.get(cat, coverage_thresholds["default"]))}
    for key, value in cfg.items():
      if isinstance(key, str) and isinstance(value, (int, float)):
        merged[key] = float(value)
    coverage_thresholds[cat] = merged

  jd_corpus = payload["jd_corpus"]
  cv_sections: dict[str, str] = payload["cv"]["sections"]

  docs_processed: list[dict[str, Any]] = []
  doc_term_sets: list[set[str]] = []
  duplicate_docs = 0
  for item in jd_corpus:
    raw_text = str(item.get("text") or "")
    title = str(item.get("title") or "")
    normalized_text = apply_aliases(raw_text, aliases)
    terms = extract_terms(normalized_text, max_ngram=4)
    if not terms:
      continue

    term_set = set(terms)
    near_duplicate_penalty = 1.0
    for seen in doc_term_sets:
      if jaccard_similarity(term_set, seen) >= 0.92:
        near_duplicate_penalty = 0.75
        duplicate_docs += 1
        break
    doc_term_sets.append(term_set)

    token_count = len(terms)
    completeness = min(1.0, token_count / 120.0)
    role_match_hits = sum(1 for kw in weighted_keywords if kw in normalize_phrase(f"{title} {normalized_text}"))
    role_match = min(1.0, role_match_hits / max(1, len(weighted_keywords))) if weighted_keywords else 0.6

    source_factor = 1.0
    source_value = str(item.get("source") or item.get("source_url") or "").lower()
    if "indeed" in source_value:
      source_factor = 1.05
    elif any(host in source_value for host in ["greenhouse", "lever", "linkedin"]):
      source_factor = 1.03

    freshness = 1.0
    published_at = parse_iso(str(item.get("published_at") or ""))
    if published_at is not None:
      now = datetime.now(timezone.utc)
      age_days = max(0.0, (now - published_at).total_seconds() / 86400.0)
      freshness = 0.6 + (0.4 * math.exp(-age_days / 180.0))

    base_quality = 0.45 + (0.25 * completeness) + (0.2 * role_match) + (0.1 * freshness)
    doc_quality = max(0.4, base_quality * source_factor * near_duplicate_penalty)

    docs_processed.append(
      {
        "item": item,
        "terms": Counter(terms),
        "term_set": term_set,
        "term_count": token_count,
        "quality": doc_quality,
        "freshness": freshness,
        "near_duplicate_penalty": near_duplicate_penalty,
      }
    )

  if not docs_processed:
    raise ValueError("No analyzable JD text terms were extracted from input corpus.")

  doc_count = len(docs_processed)
  avg_doc_len = sum(doc["term_count"] for doc in docs_processed) / max(1, doc_count)

  all_terms_counter: Counter[str] = Counter()
  for doc in docs_processed:
    all_terms_counter.update(doc["terms"])

  doc_freq: Counter[str] = Counter()
  for doc in docs_processed:
    doc_freq.update(doc["term_set"])

  candidate_terms = set()
  for term, freq in all_terms_counter.items():
    if len(term) < 3:
      continue
    ngram_words = term.count(" ") + 1
    if ngram_words == 1 and freq >= 1:
      candidate_terms.add(term)
      continue
    if ngram_words >= 2 and freq >= 2:
      candidate_terms.add(term)

  candidate_terms.update(weighted_keywords.keys())

  keyword_scores: list[KeywordScore] = []
  for term in sorted(candidate_terms):
    df = int(doc_freq.get(term, 0))
    if df <= 0:
      continue

    idf = math.log((1 + doc_count) / (1 + df)) + 1.0
    tfidf_sum = 0.0
    tf_sum = 0
    max_signal_bump = 0.0
    for doc in docs_processed:
      total_terms = sum(doc["terms"].values())
      if total_terms <= 0:
        continue
      count = doc["terms"].get(term, 0)
      tf_sum += count
      if count > 0:
        tfidf_sum += (count / total_terms) * idf * doc["quality"]
        score = float(doc["item"].get("score") or 0.0)
        max_signal_bump = max(max_signal_bump, min(0.65, (score / 100.0) * doc["quality"]))

    mean_tfidf = tfidf_sum / doc_count
    role_prior = weighted_keywords.get(term, 0.0)
    category, category_confidence = classify_term(term, taxonomy)
    category_multiplier = category_multipliers.get(category, category_multipliers.get("unknown", 1.0))

    final_weight = mean_tfidf * (1.0 + (role_prior / 10.0) + max_signal_bump) * max(0.1, category_multiplier)

    section_hits: dict[str, int] = {}
    weighted_hits = 0.0
    raw_hits_total = 0
    negated_hits_total = 0
    evidence_hits = 0
    for section_name, section_text in cv_sections.items():
      hits, negated_hits = phrase_hits_with_negation(section_text, term)
      section_hits[section_name] = hits
      raw_hits_total += hits
      negated_hits_total += negated_hits
      section_weight = infer_section_weight(section_name, section_weights)
      weighted_hits += hits * section_weight
      if hits > 0:
        evidence_hits += evidence_hits_for_phrase(section_text, term)

    evidence_multiplier = 1.0 + min(0.45, evidence_hits * 0.08)
    weighted_hits *= evidence_multiplier
    coverage = min(1.0, weighted_hits / max(1.0, float(df) * 2.0))

    keyword_scores.append(
      KeywordScore(
        keyword=term,
        normalized_keyword=term,
        category=category,
        category_confidence=round(category_confidence, 6),
        jd_doc_freq=df,
        jd_term_freq=tf_sum,
        tfidf_weight=round(mean_tfidf, 6),
        role_prior=round(role_prior, 6),
        final_weight=round(final_weight, 6),
        cv_hits_total=raw_hits_total,
        cv_negated_hits=negated_hits_total,
        cv_section_hits=section_hits,
        cv_weighted_hits=round(weighted_hits, 6),
        evidence_hits=evidence_hits,
        evidence_multiplier=round(evidence_multiplier, 6),
        coverage=round(coverage, 6),
        confidence=0.0,
        gap_severity="none",
      )
    )

  if not keyword_scores:
    raise ValueError("No keyword candidates could be scored from the JD corpus.")

  keyword_scores.sort(key=lambda item: item.final_weight, reverse=True)
  max_weight = max(item.final_weight for item in keyword_scores) or 1.0
  duplicate_ratio = duplicate_docs / max(1, len(doc_term_sets))
  confidence = calc_confidence(doc_count, len(keyword_scores), avg_doc_len, duplicate_ratio)

  scored_keywords: list[KeywordScore] = []
  for keyword in keyword_scores:
    normalized_weight = keyword.final_weight / max_weight if max_weight > 0 else 0.0
    severity = calc_gap_severity(keyword.coverage, normalized_weight, keyword.category, coverage_thresholds)
    scored_keywords.append(
      KeywordScore(
        keyword=keyword.keyword,
        normalized_keyword=keyword.normalized_keyword,
        category=keyword.category,
        category_confidence=keyword.category_confidence,
        jd_doc_freq=keyword.jd_doc_freq,
        jd_term_freq=keyword.jd_term_freq,
        tfidf_weight=keyword.tfidf_weight,
        role_prior=keyword.role_prior,
        final_weight=keyword.final_weight,
        cv_hits_total=keyword.cv_hits_total,
        cv_negated_hits=keyword.cv_negated_hits,
        cv_section_hits=keyword.cv_section_hits,
        cv_weighted_hits=keyword.cv_weighted_hits,
        evidence_hits=keyword.evidence_hits,
        evidence_multiplier=keyword.evidence_multiplier,
        coverage=keyword.coverage,
        confidence=confidence,
        gap_severity=severity,
      )
    )

  weighted_den = sum(item.final_weight for item in scored_keywords) or 1.0
  weighted_num = sum(item.final_weight * item.coverage for item in scored_keywords)
  coverage_score = round((weighted_num / weighted_den) * 100.0, 2)

  scored_keywords.sort(key=lambda item: item.final_weight, reverse=True)
  top_n = int(config.get("top_n_keywords", 60) or 60)
  top_keywords = scored_keywords[: max(1, top_n)]

  critical_gaps = [item for item in top_keywords if item.gap_severity in {"critical", "high"} and item.cv_hits_total == 0]
  medium_gaps = [item for item in top_keywords if item.gap_severity == "medium" and item.cv_hits_total == 0]
  gap_pool = critical_gaps + medium_gaps
  actions = [build_action(item) for item in gap_pool[:12]]

  per_category: dict[str, dict[str, Any]] = {}
  for item in top_keywords:
    bucket = per_category.get(item.category)
    if bucket is None:
      bucket = {
        "keyword_count": 0,
        "missing_count": 0,
        "total_weight": 0.0,
        "weighted_coverage_num": 0.0,
        "top_keywords": [],
      }
      per_category[item.category] = bucket
    bucket["keyword_count"] += 1
    if item.cv_hits_total == 0:
      bucket["missing_count"] += 1
    bucket["total_weight"] += item.final_weight
    bucket["weighted_coverage_num"] += item.final_weight * item.coverage
    bucket["top_keywords"].append(item)

  category_analytics: dict[str, Any] = {}
  for category, bucket in per_category.items():
    total_weight = bucket["total_weight"]
    coverage = (bucket["weighted_coverage_num"] / total_weight) if total_weight > 0 else 0.0
    top_items = sorted(bucket["top_keywords"], key=lambda i: i.final_weight, reverse=True)[:12]
    category_analytics[category] = {
      "keyword_count": bucket["keyword_count"],
      "missing_count": bucket["missing_count"],
      "weight_share": round(total_weight / weighted_den, 6),
      "coverage": round(coverage, 6),
      "top_keywords": [
        {
          "keyword": item.keyword,
          "weight": item.final_weight,
          "coverage": item.coverage,
          "gap_severity": item.gap_severity,
        }
        for item in top_items
      ],
    }

  seniority_intent = infer_seniority_intent([doc["item"] for doc in docs_processed])

  editor_hook = {
    "version": "editor-panel.v1",
    "coverage_score": coverage_score,
    "confidence": confidence,
    "top_keywords": [
      {
        "keyword": item.keyword,
        "category": item.category,
        "weight": round(item.final_weight, 6),
        "coverage": item.coverage,
        "gap_severity": item.gap_severity,
      }
      for item in top_keywords[:25]
    ],
    "gaps": [
      {
        "keyword": item.keyword,
        "category": item.category,
        "severity": item.gap_severity,
        "suggested_action": build_action(item),
      }
      for item in gap_pool[:15]
    ],
    "category_analytics": {
      key: {
        "coverage": value["coverage"],
        "missing_count": value["missing_count"],
      }
      for key, value in category_analytics.items()
    },
  }

  return {
    "generated_at": utc_now_iso(),
    "input_summary": {
      "jd_documents": doc_count,
      "avg_jd_term_count": round(avg_doc_len, 2),
      "cv_sections": list(cv_sections.keys()),
      "config_weighted_keywords": len(weighted_keywords),
      "duplicate_docs_detected": duplicate_docs,
      "role_cluster": role_cluster,
    },
    "scores": {
      "coverage_score": coverage_score,
      "confidence": confidence,
    },
    "weighted_keywords": [
      {
        "keyword": item.keyword,
        "normalized_keyword": item.normalized_keyword,
        "category": item.category,
        "category_confidence": item.category_confidence,
        "jd_doc_freq": item.jd_doc_freq,
        "jd_term_freq": item.jd_term_freq,
        "tfidf_weight": item.tfidf_weight,
        "role_prior": item.role_prior,
        "final_weight": item.final_weight,
        "cv_hits_total": item.cv_hits_total,
        "cv_negated_hits": item.cv_negated_hits,
        "cv_section_hits": item.cv_section_hits,
        "cv_weighted_hits": item.cv_weighted_hits,
        "evidence_hits": item.evidence_hits,
        "evidence_multiplier": item.evidence_multiplier,
        "coverage": item.coverage,
        "confidence": item.confidence,
        "gap_severity": item.gap_severity,
      }
      for item in top_keywords
    ],
    "seniority_intent": seniority_intent,
    "category_analytics": category_analytics,
    "actions": actions,
    "integration_hooks": {
      "editor_panel": editor_hook,
    },
    "scoring_model": {
      "category_multipliers": category_multipliers,
      "coverage_thresholds": coverage_thresholds,
    },
    "schemas": {
      "input": "schemas/analysis_input.schema.json",
      "output": "schemas/analysis_output.schema.json",
    },
  }


def to_markdown(report: dict[str, Any]) -> str:
  scores = report.get("scores", {})
  coverage = scores.get("coverage_score", 0)
  confidence = scores.get("confidence", 0)
  weighted_keywords = report.get("weighted_keywords", [])
  actions = report.get("actions", [])
  seniority_intent = report.get("seniority_intent", {})
  category_analytics = report.get("category_analytics", {})

  lines = [
    "# CV Keyword Analysis Summary",
    "",
    f"- Coverage score: **{coverage}%**",
    f"- Confidence: **{round(float(confidence) * 100, 1)}%**",
    f"- Ranked keywords: **{len(weighted_keywords)}**",
    f"- Seniority intent detected: **{seniority_intent.get('detected', False)}** (score {seniority_intent.get('score', 0)})",
    "",
    "## Top Weighted Keywords",
    "",
    "| Keyword | Category | Weight | Coverage | Severity |",
    "|---|---|---:|---:|---|",
  ]
  for item in weighted_keywords[:20]:
    lines.append(
      f"| {item['keyword']} | {item.get('category', 'unknown')} | {item['final_weight']:.4f} | {item['coverage']:.2f} | {item['gap_severity']} |"
    )

  lines.extend(["", "## Per-Category Analytics", ""])
  for category, bucket in category_analytics.items():
    lines.append(
      f"- **{category}**: coverage={bucket.get('coverage', 0):.2f}, missing={bucket.get('missing_count', 0)}, count={bucket.get('keyword_count', 0)}"
    )

  lines.extend(["", "## Recommended Actions", ""])
  if actions:
    for action in actions:
      lines.append(f"- {action}")
  else:
    lines.append("- No high-severity keyword gaps detected.")
  return "\n".join(lines) + "\n"


def parse_args() -> argparse.Namespace:
  parser = argparse.ArgumentParser(description="Run CV keyword analysis against JD corpus.")
  parser.add_argument("--input", required=True, help="Path to analysis input JSON payload.")
  parser.add_argument("--output", default="", help="Path for JSON analysis output.")
  parser.add_argument("--markdown-output", default="", help="Optional markdown report path.")
  parser.add_argument("--editor-hook-output", default="", help="Optional editor hook JSON path.")
  return parser.parse_args()


def main() -> int:
  args = parse_args()
  root = Path(__file__).resolve().parent
  input_path = Path(args.input).resolve()
  if not input_path.exists():
    print(f"Input file missing: {input_path}", file=sys.stderr)
    return 2

  payload = parse_input(input_path)
  report = analyze(payload, root=root)

  now = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
  output_path = Path(args.output).resolve() if args.output else (root / "outputs" / f"analysis_report_{now}.json").resolve()
  output_path.parent.mkdir(parents=True, exist_ok=True)
  output_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

  if args.markdown_output:
    markdown_path = Path(args.markdown_output).resolve()
    markdown_path.parent.mkdir(parents=True, exist_ok=True)
    markdown_path.write_text(to_markdown(report), encoding="utf-8")

  if args.editor_hook_output:
    hook_path = Path(args.editor_hook_output).resolve()
    hook_path.parent.mkdir(parents=True, exist_ok=True)
    hook_payload = report.get("integration_hooks", {}).get("editor_panel", {})
    hook_path.write_text(json.dumps(hook_payload, ensure_ascii=False, indent=2), encoding="utf-8")

  print(f"Saved analysis report to {output_path}")
  print(
    "Analysis summary: "
    f"coverage={report['scores']['coverage_score']} "
    f"confidence={report['scores']['confidence']} "
    f"keywords={len(report['weighted_keywords'])}"
  )
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
