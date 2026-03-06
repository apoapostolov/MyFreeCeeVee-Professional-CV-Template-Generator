# MuhFweeCeeVee

Self-hosted CV templating system.

## Stack

- Next.js 15 (web)
- FastAPI (parser)
- YAML-first data model
- Chromium PDF export pipeline (Playwright)

## Initial Data and Templating Assets

- Seed CV YAML variants:
  - `data/cvs/cv_bg_001_alianz.yaml`
  - `data/cvs/cv_en_001_alianz.yaml`
- Example source PDF used for enrichment/reconstruction:
  - `examples/cv_bg_004_alianz.pdf`
- Template catalog:
  - `templates/catalog.yaml`
- Bootstrap template:
  - `templates/edinburgh-v1/template.yaml`
  - `templates/edinburgh-v1/layout.yaml`
  - `templates/edinburgh-v1/license.yaml`
  - `templates/europass-v1/template.yaml`
  - `templates/europass-v1/layout.yaml`
  - `templates/europass-v1/license.yaml`
  - `templates/europass-v1/source/original.pdf`
- Seed CV-to-template mapping:
  - `data/template_mappings/cv_bg_001_alianz__edinburgh-v1.yaml`
  - `data/template_mappings/cv_en_001_alianz__edinburgh-v1.yaml`
  - `data/template_mappings/cv_bg_001_alianz__europass-v1.yaml`
  - `data/template_mappings/cv_en_001_alianz__europass-v1.yaml`
- Shared scoring constants:
  - `packages/schemas/src/cvScoring.ts`

## Documentation

- CV YAML baseline:
  - `docs/cv/CV_YAML_STANDARD.md`
- CV scoring standard:
  - `docs/cv/CV_SCORING_STANDARD.md`
- Initial templating bootstrap notes:
  - `docs/cv/INITIAL_TEMPLATING_BOOTSTRAP.md`

## Run (dev)

```bash
npm run bootstrap
npm run dev
```

Parser service:

```bash
npm run dev:parser
```

## Monorepo Scripts

- `npm run bootstrap`: install workspace dependencies.
- `npm run dev` / `npm run dev:web`: run Next.js app.
- `npm run dev:parser`: create parser venv, install parser deps, and run FastAPI.
- `npm run lint` / `npm run typecheck`: web workspace checks.
- `npm run check`: lint + typecheck.

## CV API (web)

- `GET /api/cvs`: list CV variants (`language`, `iteration`, `target`) with git metadata.
- `POST /api/cvs`: create CV from `{ cvId, cv }` or `{ language, iteration, target, cv }`.
- `GET /api/cvs/:cvId`: read CV and compatibility warnings.
  Optional query:
  `?language=bg|en&autoTranslate=true` to auto-create missing language variant.
- `PUT /api/cvs/:cvId`: update CV with automatic revision snapshot.
- `DELETE /api/cvs/:cvId`: delete CV file.
- `GET /api/cvs/:cvId/history`: list local snapshots + git version metadata.
- `GET /api/templates`: list available templates from `templates/catalog.yaml`.
- `GET /api/preview/html?cvId=...&templateId=...`: render HTML preview payload.
- `GET /api/export/pdf?cvId=...&templateId=...`: generate and stream real PDF.
- `GET /api/settings/openrouter`: read OpenRouter UI settings (`hasApiKey`, model, base URL).
- `GET /api/settings/openrouter` also returns cached OpenRouter model catalog for model dropdown population.
- `GET /api/settings/openrouter/credit`: read OpenRouter remaining-credit status (derived from OpenRouter `/api/v1/key` with `/api/v1/credits` fallback).
- `PUT /api/settings/openrouter`: update OpenRouter API key/model/base URL from UI.
- `POST /api/analysis/cv`: run AI scoring analysis (section-level or full CV) via OpenRouter.
- `POST /api/cvs/sync`: sync missing fields from selected language variant to sibling language variant and translate via OpenRouter.
  Response includes detailed per-field diff metadata (`path`, source value,
  previous target value, next translated value, and direction `BG > EN` / `BG < EN`).
- `POST /api/cvs/sync/status`: evaluate SYNC eligibility without mutating files
  (missing-field count + source/target last-edited timestamp difference + `canSync`).
- `GET /api/prototype`: get prototype runtime status.
- `POST /api/prototype`: set prototype runtime (`start`/`stop`).
- `POST /api/prototype/ingest`: mock AI prep for PDF/Image template ingestion.

## Parser API (placeholder prep)

- `POST /analyze-pdf`: PDF analysis scaffold.
- `POST /draft-template`: template draft scaffold.
- `POST /ingest-template/pdf`: placeholder pipeline for PDF -> template conversion.
- `POST /ingest-template/image`: placeholder pipeline for image -> template conversion.

## Current UI Slice

- `/` now hosts a prototype control room with:
  - Top navigation order: `Print Room` -> `Editor` -> `Keywords` -> `Templates`
  - CV workspace lane with left-pane selectors and live PDF preview
  - CV editor lane with sub-tabs for YAML section editing (`person`, `positioning`,
    `experience`, `education`, `skills`, `references`, `optional_sections`, `metadata`)
  - Editor section modes:
    `Form View` (default, recursive field forms) and `YAML View` (raw section YAML)
  - YAML View now uses a single syntax-styled editable surface
    (no split input/preview panes), with tab-friendly indentation editing
    (`Tab` inserts spaces)
  - YAML editor runs debounced linting 800ms after the last keystroke and shows
    an in-editor ticker for broken lines (supports multiple line errors)
  - YAML editor now fills available editor-frame height and keeps the lint ticker
    aligned at the bottom area; caret alignment matches rendered text columns
  - OpenRouter settings panel in UI (API key/model/base URL) for AI scoring
  - OpenRouter settings panel shows current remaining-credit status and refreshes it asynchronously every 60 seconds
  - OpenRouter model dropdown loaded from server-side cached model catalog
    (auto refresh on app load when cache is older than 72 hours; forced refresh on settings save)
  - OpenRouter model options display free status, average mixed price per
    1M input/output tokens, and estimated full-CV check cost using current
    CV size with a 20% token overhead
  - AI CV scoring actions for current section and whole CV, with structured feedback/proposals
  - AI analysis score and issue severity colors now adapt for dark mode readability
  - Keyword Studio profession focus selector (derived from JD analysis role hits)
  - Keyword Studio role-scoped keyword status buckets:
    `missing`, `underused`, and `used` with usage targets and rewrite guidance
  - Keyword Studio right-side Positioning section now uses the same framed card style as Professional Experience
  - Keyword Studio uses a single live `Core Database` dataset (`merged.json`)
    that is auto-refreshed from `jd_scrape_cache.sqlite`
  - Keyword Studio now augments JD-driven scoring with two additional keyword DB types:
    `Senior Leadership Universal` (activated on seniority signals) and
    `Game Industry Generic` (activated on game-industry signals)
  - Keyword Studio keyword tags now use source-aware colors:
    seniority keywords are indigo, game-generic keywords are cyan
  - Keyword Studio left column always shows a dedicated
    `Seniority Priority Keywords` block with full seniority keyword coverage
    (not sliced) to emphasize leadership language targets
  - Keyword Studio now also shows `Hard Skills Priority` and `Soft Skills Priority`
    sections below seniority, following the same weighted status-card pattern
  - `Seniority Priority Keywords` includes a show/hide toggle that controls
    whether seniority-tag highlights are rendered in the right content area
  - `Hard Skills Priority` and `Soft Skills Priority` also include `Hide/Show`
    toggles, and all three priority panels use dark-mode-compatible frames/buttons
  - Keyword tag hover in right content now uses a structured tooltip card
    (source/status/category badges + weight/importance/hits/usage + recommendation)
  - Hover-card source/status badges now switch to dark-compatible colors in dark mode
  - App-wide theme mode switch is available in top-right with subtle icon controls:
    light (sun), dark (moon), and system (computer)
  - Theme controls are fixed outside the main tool frame (upper-right browser area)
    and dark mode uses a dimmed palette tuned for better panel compatibility
  - YAML editor syntax colors now adapt per theme for keys, array markers,
    values, comments, and line numbers
  - Legacy snapshot JSON datasets (`jd_relevant_*.json`, `prototype_dataset_*.json`)
    are removed from the flow and automatically cleaned up
  - Keyword Studio weighted usage score and keyword-weight share metrics
  - Keyword Studio data-ops controls:
    run collection with rotating seed packs, cache dedupe, and live core-DB growth counters
  - Keyword Studio run modal with 2-second progress refresh (scrape + merge logs)
  - Editor-side `SYNC` action next to BG/EN pill to fill missing fields in sibling language variant using OpenRouter translation
  - SYNC opens a detailed diff-style modal report with per-field change list,
    direction arrows, source-of-truth value, and previous/new target values
  - Editor SYNC button stays disabled/gray until `canSync` is true
    (missing fields and/or last-edited timestamp difference between BG and EN)
  - Form editor supports nested arrays/objects with add/remove/custom-entry controls and date-picker inputs for ISO date fields
  - BG/EN language pill switch for CV variants
  - CV variant dropdown (one item per BG/EN pair) with language switching via pill
  - Template-localized BG/EN labels driven by selected CV variant language
  - Print Room theme selector under Template for Edinburgh visual variants
    (Default Purple, Ocean Teal, Forest Green, Ruby Red, Amber Gold)
  - Edinburgh themes keep a neutral grey left sidebar; theme color is applied
    to accents (header, links, bullets, dots)
  - Template-controlled date display per section (`exact`, `month-year`, `year`)
    from exact YAML dates
  - Print-friendly section transition policy (`break-inside: avoid`) for cleaner page splits
  - Europass job subsections now apply smarter page-flow hints to avoid leaving
    tiny (<4-line) subsection fragments at the bottom of a page
  - Edinburgh profile summary supports single merged paragraph rendering
    from multi-item CV source fields
  - Edinburgh education section renders expanded education details
    (field, subjects, level, faculty, location, completion)
  - Experience entries support `publication_links` (URL + optional title;
    title auto-derived from URL when omitted)
  - Edinburgh includes extended CV coverage (targeting, transition, role applicability,
    core strengths, social skills, and optional sections)
  - Europass includes the top-left Europass title + EU flag treatment and
    expanded rows for richer job/education/competency/additional-information fields
    from the enriched YAML source
  - CV/template selectors labeled by internal name + version
  - Print/save PDF action from rendered preview
  - Global pagination flow (template-local footer counters removed for Europass/Edinburgh)
  - Template gallery lane with first-page previews per implemented template,
    rendered from the most recently updated CV variant
  - Gallery previews are image renders (PNG), avoiding embedded PDF frame controls

## CV Keyword Subproject

- New subproject scaffold and first implementation:
  - `cv-keyword-analysis/jd_scraper.py` (seed crawl + relevance scoring)
  - `cv-keyword-analysis/config/relevance_keywords.json`
  - `cv-keyword-analysis/sources/seed_urls.txt`
  - resume-safe SQLite cache (`outputs/jd_scrape_cache.sqlite`) for stop/resume runs
  - optional Firecrawl provider mode (`--provider firecrawl`, `FIRECRAWL_API_KEY`)
  - taxonomy-aware CV analysis engine upgrades:
    category tagging (`hard_skill`, `soft_skill`, `seniority`, `action_verb`, `domain_term`),
    seniority intent detection, category-aware weighting, source-quality/recency/duplicate penalties,
    negation-aware CV hit logic, and per-category analytics output
  - Keyword UI polish:
    hide/show controls for seniority/hard/soft priority tag families and
    theme-aware structured hover cards that stay above panel bounds
