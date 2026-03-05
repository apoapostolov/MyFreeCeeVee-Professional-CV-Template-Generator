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
cd cv-keyword-analysis
/usr/bin/python3 jd_scraper.py --provider native --max-pages 3000 --max-depth 3
```

### Firecrawl mode (recommended if available)

```bash
cd cv-keyword-analysis
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

Bootstrap + first JD scraping pipeline with resume cache implemented.
