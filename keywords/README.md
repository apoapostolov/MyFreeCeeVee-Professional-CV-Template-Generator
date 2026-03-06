# CV Keyword Analysis

Lightweight subproject for extracting, weighting, and scoring CV/job-description keywords without paid CV optimization platforms.

## Goals

- Build a free keyword-weighting pipeline for CVs and job descriptions.
- Produce explainable term weights (not black-box scoring only).
- Generate actionable optimization suggestions per CV section.

## Scope (initial)

- Ingest CV text (YAML/JSON/plain text) and one or more target job descriptions.
- Compute weighted keyword sets (frequency + corpus relevance).
- Rank CV coverage vs target role keywords.
- Provide section-aware and evidence-aware scoring.

## Planned Tech

- Python 3.12
- `scikit-learn` for TF-IDF
- `spaCy` for phrase extraction
- optional `rapidfuzz` for fuzzy normalization

## Project Structure

- `AGENTS.md` - operating rules
- `DEVELOPMENT_PLAN.md` - implementation milestones
- `DEVELOPMENT_LOG.md` - chronological engineering log
- `CHANGELOG.md` - user-visible changes
- `TODO.md` - actionable tasks by priority

## JD Scraper

Implemented:

- `jd_scraper.py` - crawls/searches for job pages and scores role relevance.
- `config/relevance_keywords.json` - weighted role/keyword configuration.
- `sources/seed_urls.txt` - editable native crawl entrypoints.
- Native mode auto-expands seeds from target roles using configurable
  search templates/suffixes in `config/relevance_keywords.json`.
- `outputs/` - exported scrape results and persistent cache DB.

### Resume-safe caching

The scraper persists progress in SQLite and can stop/resume without reprocessing:

- URL-level dedupe (`scraped_pages.url`)
- Content-hash dedupe (`scraped_pages.content_hash`)
- Per-page keyword/score storage after each successful scrape
- Incremental DB commits after every processed page

Default cache path:

- `outputs/jd_scrape_cache.sqlite`

### Native mode

```bash
cd keywords
/usr/bin/python3 jd_scraper.py --provider native --max-pages 3000 --max-depth 3
```

### Firecrawl mode (recommended if available)

```bash
cd keywords
export FIRECRAWL_API_KEY=...
/usr/bin/python3 jd_scraper.py --provider firecrawl --min-score 8 --max-results 6000
```

### Start vs Resume

Resume (default):

```bash
/usr/bin/python3 jd_scraper.py --mode resume
```

Start fresh (reset cache):

```bash
/usr/bin/python3 jd_scraper.py --mode start
# or
/usr/bin/python3 jd_scraper.py --reset-cache
```

## Status

JD scraping pipeline and CV keyword scoring engine are implemented.

## CV Analysis Engine

Implemented:

- `analysis_engine.py` - deterministic CV-vs-JD analysis pipeline.
- taxonomy-aware classification with categories:
  `hard_skill`, `soft_skill`, `seniority`, `action_verb`, `domain_term`.
- seniority-intent detection across JD corpus.
- category-aware weighting multipliers and role-cluster weighting profiles.
- source-quality + recency + near-duplicate penalties in JD weighting.
- contextual negation handling for CV hit counting (`no/not/without/...`).
- per-category analytics in JSON/markdown outputs.
- `schemas/analysis_input.schema.json` - input payload contract.
- `schemas/analysis_output.schema.json` - output report contract.
- `config/keyword_taxonomy.json` - taxonomy aliases, category term sets, and role-cluster profiles.
- `tests/fixtures/analysis_input.json` - deterministic fixture input.
- `tests/test_analysis_engine.py` - regression/unit checks.

### Input payload

Minimal required shape:

- `cv.sections` object with section name -> text.
- `jd_corpus[]` array with JD `text` (optional `score`).
- optional `config` for section weights, weighted keywords, top N.

### Analysis run

```bash
cd keywords
/usr/bin/python3 analysis_engine.py \
  --input tests/fixtures/analysis_input.json \
  --output outputs/analysis_report_fixture.json \
  --markdown-output outputs/analysis_report_fixture.md \
  --editor-hook-output outputs/editor_hook_fixture.json
```

### Output report

`analysis_engine.py` outputs:

- weighted keyword table (`weighted_keywords`)
- overall score (`scores.coverage_score`)
- confidence (`scores.confidence`)
- severity-ranked gaps (`gap_severity`)
- actionable suggestions (`actions`)
- seniority signal summary (`seniority_intent`)
- category performance breakdown (`category_analytics`)
- editor integration hook (`integration_hooks.editor_panel`)

### Validation

```bash
cd keywords
/usr/bin/python3 -m py_compile jd_scraper.py analysis_engine.py
/usr/bin/python3 -m unittest tests/test_analysis_engine.py
```
