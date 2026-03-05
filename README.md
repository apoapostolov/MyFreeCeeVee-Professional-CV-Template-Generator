# MyFreeCeeVee

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
  - Launch/stop service controls
  - Runtime service status cards
  - CV workspace lane with left-pane selectors and live PDF preview
  - BG/EN language pill switch for CV variants
  - Template-localized BG/EN labels driven by selected CV variant language
  - Template-controlled date display per section (`exact`, `month-year`, `year`)
    from exact YAML dates
  - Print-friendly section transition policy (`break-inside: avoid`) for cleaner page splits
  - Edinburgh profile summary supports single merged paragraph rendering
    from multi-item CV source fields
  - Edinburgh includes extended CV coverage (targeting, transition, role applicability,
    core strengths, social skills, and optional sections)
  - Europass includes the top-left Europass title + EU flag treatment and
    expanded rows for richer job/education/competency/additional-information fields
    from the enriched YAML source
  - CV/template selectors labeled by internal name + version
  - Print/save PDF action from rendered preview
  - Footer page counter in generated PDFs
  - Template gallery lane with first-page previews per implemented template,
    rendered from the most recently updated CV variant
  - Gallery previews are image renders (PNG), avoiding embedded PDF frame controls
