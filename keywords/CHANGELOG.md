# Changelog

All notable changes to this subproject will be documented in this file.

The format is based on Keep a Changelog and this project follows Semantic Versioning intent.

## [Unreleased]

### Added

- Priority implementation tranche for new PX backlog:
  - taxonomy config file `config/keyword_taxonomy.json` with aliases, category lexicons, and role-cluster priors
  - category classification in analysis output (`hard_skill`, `soft_skill`, `seniority`, `action_verb`, `domain_term`)
  - seniority-intent detection summary in report output
  - category analytics block for weighted coverage and missing distribution
  - negation-aware CV hit counting (`cv_negated_hits`)
  - source-quality + recency + near-duplicate weighting signals in JD scoring
  - schema updates for new input/output fields and extended tests/fixtures.
- Expanded TODO roadmap with new execution backlog for:
  - hard-skill / soft-skill / seniority / action-verb taxonomy extraction
  - category-aware weighting and deduplication quality improvements
  - optimization and feedback-loop ideas for broader keyword coverage.
- Initial `keywords` subproject scaffold.
- Governance and execution docs: `AGENTS.md`, `DEVELOPMENT_PLAN.md`, `DEVELOPMENT_LOG.md`, `TODO.md`.
- Project overview and scope in `README.md`.
- First JD scraper implementation:
  - `jd_scraper.py` crawl + relevance scoring CLI
  - role keyword config file: `config/relevance_keywords.json`
  - editable crawl seeds: `sources/seed_urls.txt`
  - JSON output artifacts under `outputs/`
- Optional Firecrawl search provider in `jd_scraper.py`:
  - `--provider firecrawl`
  - uses `FIRECRAWL_API_KEY` and configurable `--firecrawl-api-base`
  - supports per-query result limit tuning.
- Native provider query expansion:
  - auto-generates role-based native search seeds from configured query suffixes
    and search URL templates
  - improves resume-mode corpus growth without paid providers.
- Resume-safe crawl persistence:
  - SQLite cache DB (`outputs/jd_scrape_cache.sqlite`)
  - URL/content-hash dedupe
  - per-page persisted keyword/score records
  - stop/resume without reprocessing the same information.
- CV analysis engine CLI (`analysis_engine.py`) with:
  - deterministic input validation for CV sections + JD corpus
  - normalization pipeline (lowercase, lemmatization, dedupe-ready tokenization)
  - TF-IDF keyword weighting over JD corpus
  - section-aware CV keyword weighting
  - quantified evidence multiplier
  - confidence and gap-severity scoring
  - actionable rewrite suggestions.
- Formal JSON schemas:
  - `schemas/analysis_input.schema.json`
  - `schemas/analysis_output.schema.json`
- Optional markdown summary report output (`--markdown-output`).
- Editor integration hook payload output (`--editor-hook-output`, `editor-panel.v1`).
- Deterministic regression fixtures and unit tests under `tests/`.
