# DEVELOPMENT_LOG

## 2026-03-05 - Subproject bootstrap

Context/root cause:

- Needed a dedicated workspace for free CV keyword weighting analysis and planning.

Files touched:

- `README.md`
- `AGENTS.md`
- `DEVELOPMENT_PLAN.md`
- `CHANGELOG.md`
- `TODO.md`
- `DEVELOPMENT_LOG.md`

Validation commands and results:

- Directory scaffold created successfully.
- Documentation files created successfully.

## 2026-03-05 - Started JD scraper for role-relevant positions

Context/root cause:

- Needed to start collection of job descriptions relevant to target roles:
  Video Game Producer, Game Producer, Game Designer, Data Analyst,
  Game Data Designer, Tracking Data / analytics roles.

Files touched:

- `jd_scraper.py`
- `config/relevance_keywords.json`
- `sources/seed_urls.txt`
- `outputs/.gitkeep`
- `README.md`
- `CHANGELOG.md`
- `TODO.md`
- `DEVELOPMENT_LOG.md`

Validation commands and results:

- `/usr/bin/python3 -m py_compile jd_scraper.py` -> pass

## 2026-03-05 - Added optional Firecrawl provider for JD scraping

Context/root cause:

- Requested consideration of Firecrawl-style tooling for JD scraping quality.

Files touched:

- `jd_scraper.py`
- `README.md`
- `CHANGELOG.md`
- `TODO.md`
- `DEVELOPMENT_LOG.md`

Validation commands and results:

- `/usr/bin/python3 -m py_compile jd_scraper.py` -> pass

## 2026-03-05 - Resume-safe crawler cache (start/resume)

Context/root cause:

- Needed crawler stop/resume support with hard dedupe guarantees to avoid
  reprocessing the same job pages/information.

Files touched:

- `jd_scraper.py`
- `README.md`
- `TODO.md`
- `CHANGELOG.md`
- `DEVELOPMENT_LOG.md`

Validation commands and results:

- `/usr/bin/python3 -m py_compile jd_scraper.py` -> pass

## 2026-03-05 - Expanded native seed/query discovery and reran without Firecrawl


Context/root cause:

- Firecrawl quota was exhausted; native crawler needed broader discovery to continue growing corpus.
- Existing native crawl used too few static seed URLs and saturated quickly.

Files touched:

- `jd_scraper.py`
- `config/relevance_keywords.json`
- `README.md`
- `CHANGELOG.md`
- `TODO.md`
- `DEVELOPMENT_LOG.md`

Validation commands and results:

- `/usr/bin/python3 -m py_compile jd_scraper.py` -> pass
- `/usr/bin/python3 jd_scraper.py --provider native --mode resume --max-pages 400 --max-depth 1 --max-results 10000 --min-score 8 --timeout 4 --sleep-ms 0` -> pass
- Output: `outputs/jd_relevant_20260305T170300Z.json`
- Cache totals: `pages_total=330`, `pages_relevant=235`, `native_pages=229`
