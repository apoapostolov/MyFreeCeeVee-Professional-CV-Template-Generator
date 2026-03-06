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
- [x] Refocus Keyword Studio on profession-targeted keyword gaps with role dropdown and explicit missing/underused/used buckets.
- [x] Upgrade Keyword Studio with positioning-first layout, rich keyword hover diagnostics, weighted usage score, and data-ops controls.
- [x] Add Edinburgh template theme presets and Print Room theme dropdown support.
- [x] Replace Keyword Studio snapshot selector flow with single live `merged.json` core database and remove legacy snapshot JSON datasets.
- [x] Add real-time (2s) run-progress modal for Keyword Studio collection runs and remove prototype dataset fallbacks.
- [x] Keep Edinburgh left sidebar neutral grey across all theme variants.
- [x] Simplify Keyword Studio Data Ops to single Run action with automatic core DB merge and growth-focused counters.
- [x] Refresh core keyword database directly from SQLite cache after each run so profile totals/keywords always include latest collection output.
- [x] Align Keyword Studio Positioning block framing with Professional Experience card styling.
- [x] Expand Keyword Studio Professional Experience cards to include role-title fallback and missing high-value fields (tools/results/publication links/state flags).
- [x] Add supplemental keyword DB types for senior leadership and generic game-industry tags, merged into Keyword Studio scoring.
- [x] Add source-specific keyword colors (seniority/game-generic) and always-visible full seniority keyword list in Keyword Studio left column.
- [x] Add Seniority Priority toggle to show/hide seniority tag highlights and harden seniority list fallback rendering.
- [x] Upgrade Keyword Studio tag hover UI to structured tooltip cards and simplify/unconstrain Seniority Priority controls/list.
- [x] Rename top tab `Keyword Studio` to `Keywords` and move it between `Editor` and `Templates`.
- [x] Remove native tag tooltip overlap, darken structured hover cards, and add hard/soft skill priority sections under seniority.
- [x] Add global light/dark/system theme mode toggle with subtle icon controls in top-right header.
- [x] Continue `cv-keyword-analysis` PX backlog implementation with taxonomy-aware scoring, quality-weighting penalties, negation handling, and per-category analytics.
- [x] Improve Editor YAML View readability with syntax-colored preview and tab-friendly indentation behavior.
- [x] Move theme controls to fixed upper-right browser area and rework dark mode to a dimmed, panel-compatible scheme.
- [x] Add hard/soft priority hide-show controls and keep keyword hover cards theme-aware + unclipped in Keywords content view.
- [x] Align YAML Syntax Preview + Keywords priority frames/buttons with dark mode (no hardcoded light surfaces).
- [x] Consolidate YAML View into one editable syntax-styled field and add 800ms debounced multi-line lint ticker.
- [x] Make hover-card source/status badge tags theme-aware so dark mode avoids light-only badge styling.
- [x] Make YAML editor fill its frame bottom area and correct caret horizontal alignment with rendered syntax text.
- [x] Make Editor AI analysis score severity colors dark-mode aware (green/amber/red + issues text).
