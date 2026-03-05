# TODO

## P0 - Foundation and operational readiness

- [x] Finalize monorepo script consistency and add root bootstrap script.
- [x] Wire Next.js API route for CV YAML CRUD (`/api/cvs`).
- [x] Add filesystem persistence helpers for `data/cvs/*.yaml`.
- [x] Define and validate `cv.v1` JSON schema in `packages/schemas`.
- [x] Build first composer screen: form-first editor + live preview shell.
- [x] Add launchable prototype UX shell for interface testing.
- [ ] Implement parser service real PDF block extraction (`/analyze-pdf`).
- [ ] Add template draft output (`layout.yaml`) from parser service.
- [x] Implement first HTML -> PDF export flow via Playwright.
- [x] Import seed CV YAML (`cv_bg_001_alianz`) for initial integration testing.
- [x] Add baseline CV YAML and scoring documentation under `docs/cv/`.

## P1 - Product quality and governance

- [x] Add template catalog model with legal metadata (`license.yaml`).
- [x] Add mapping model (`cv.path -> template.slot`) and transform pipeline.
- [x] Add compatibility warnings for overflow/missing required slots.
- [x] Add bilingual CV variant support (`bg`/`en`) with auto-create option.
- [x] Add first external-inspired template scaffold: `edinburgh-v1`.
- [x] Add basic Europass template package and seed mappings.
- [ ] Add integration tests for CV -> template -> export flow.
- [ ] Add systemd install/runbook and nginx enable instructions.
- [ ] Implement scoring endpoint using rubric in `packages/schemas/src/cvScoring.ts`.

## P2 - UX and scale improvements

- [x] Add revision snapshots/history per CV.
- [x] Add variant versioning metadata and git-backed version visibility.
- [x] Rebaseline seed iteration naming from `0004` to `0001`.
- [x] Add placeholder AI ingestion UX/API for PDF and image template conversion prep.
- [x] Expand Edinburgh sidebar/right-column field coverage and summary composition controls.
- [x] Add print keep-together section transition behavior for Edinburgh pages.
- [x] Rebuild `europass-v1` from real sample PDF and remove `professional-v1`.
- [x] Align `europass-v1` header and field coverage with source PDF + expanded `cv_bg_001`.
- [x] Enrich seed BG CV (`cv_bg_001_alianz`) with full details from sample PDF.
- [x] Add CV editor tab with section sub-tabs and OpenRouter-backed section/full CV scoring.
- [x] Keep OpenRouter settings credit label focused on remaining credit wording.
- [x] Remove OpenRouter credit `(limit unavailable)` fallback text from settings label.
- [x] Add OpenRouter `/api/v1/credits` fallback so remaining credit can be computed when key-level limit is null.
- [x] Add per-experience publication link support (`url` + optional auto-derived title) in CV YAML/rendering.
- [x] Extend `edinburgh-v1` education rendering with full detail fields from YAML.
- [x] Add Europass subsection pagination hints to avoid tiny (<4-line) carry-over fragments.
- [x] Start `cv-keyword-analysis` JD scraper with role relevance scoring and JSON export.
- [x] Add JD scraper start/resume cache with no-reprocessing guarantees and optional Firecrawl provider mode.
- [x] Expand native JD seed/query discovery so resume runs can grow corpus without Firecrawl.
- [x] Add `Keyword Studio` tab with English keyword heat-tag rendering and usage weighting from JD corpus.
- [x] Polish Keyword Studio rendering with labeled field rows and phrase-aware multi-word keyword tagging.
- [x] Add Keyword Studio dataset snapshot dropdown + merge-to-`prototype dataset 1.0` workflow.
- [ ] Add import/export UI for YAML packages.
- [ ] Add template review status workflow (`pending/approved/rejected`).
- [ ] Add visual diff tests for selected PDF golden outputs.

- [x] Remove Keyword Studio merge button and use prebuilt `merged.json` as selectable/default dataset.

- [x] Improve Keyword Studio section/subsection rendering with type-specific layouts for experience, education, skills, and optional blocks.
