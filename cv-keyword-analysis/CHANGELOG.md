# Changelog

All notable changes to this subproject will be documented in this file.

The format is based on Keep a Changelog and this project follows Semantic Versioning intent.

## [Unreleased]

### Added

- Initial `cv-keyword-analysis` subproject scaffold.
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
