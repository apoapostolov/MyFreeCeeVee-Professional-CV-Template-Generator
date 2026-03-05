# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial monorepo bootstrap with Next.js web app and FastAPI parser scaffold.
- Initial deployment scaffolding for `systemd` and `nginx`.
- Initial project governance docs: `AGENTS.md`, `TODO.md`, and `DEVELOPMENT_LOG.md`.
- Imported baseline CV YAML standard and scoring documentation under `docs/cv/`.
- Added seed CV data file: `data/cvs/cv_bg_001_alianz.yaml`.
- Added English CV data file: `data/cvs/cv_en_001_alianz.yaml`.
- Added initial template catalog and bootstrap template assets under `templates/`.
- Added initial CV-to-template mapping in `data/template_mappings/`.
- Added shared scoring weight constants in `packages/schemas/src/cvScoring.ts`.
- Added `cv.v1` shared schema object and validator helpers in `packages/schemas`.
- Added CV CRUD API routes:
  `/api/cvs`, `/api/cvs/:cvId`, `/api/cvs/:cvId/history`.
- Added server-side filesystem persistence helpers for `data/cvs/*.yaml`.
- Added revision snapshot history per CV under `data/cvs/history/:cvId`.
- Added initial compatibility warning engine for missing mapped slots and
  bullet-limit overflow checks.
- Added first composer screen on `/` with form-first editing and live preview
  shell.
- Added root bootstrap/consistency scripts:
  `bootstrap`, `dev:web`, `dev:parser`, `lint:web`, `typecheck:web`, `check`.
- Added bilingual seed CV variants:
  `data/cvs/cv_bg_001_alianz.yaml` and `data/cvs/cv_en_001_alianz.yaml`.
- Added English seed mapping:
  `data/template_mappings/cv_en_001_alianz__professional-v1.yaml`.
- Added auto-create language variant support on CV read:
  `GET /api/cvs/:cvId?language=bg|en&autoTranslate=true`.
- Added git-backed version metadata in CV list/read/history API responses.
- Renamed seed iteration ID baseline from `0004` to `0001`.
- Added launchable prototype UI control room for interface testing with
  service status, CV workspace placeholder, ingestion placeholder, and Europass lane.
- Added prototype API stubs:
  `/api/prototype` and `/api/prototype/ingest`.
- Added parser placeholder ingestion endpoints:
  `/ingest-template/pdf` and `/ingest-template/image`.
- Added first external-inspired template scaffold:
  `templates/edinburgh-v1/*` (prototype, pending legal review).
- Added BG/EN seed mappings for `edinburgh-v1`.
- Added `europass-v1` template scaffold and catalog entry.
- Added BG/EN seed mappings for `europass-v1`.
- Added compatibility parsing for CV variant IDs with 3 or 4 digit iteration
  segments (for example `001` and `0001`) in CV listing APIs.
- Added template listing API: `/api/templates`.
- Added server HTML preview API: `/api/preview/html`.
- Added Playwright PDF export API: `/api/export/pdf`.
- Added workspace UX flow for selecting CV + template and rendering live PDF preview.
- Added print/save action wired to generated PDF output.
- Added viewport-contained workspace layout to avoid extending below screen height.
- Added BG/EN pill switch for variant language toggling in workspace controls.
- Updated CV and template selector labels to use human-readable internal name + version.
- Improved `edinburgh-v1` rendering parity with richer section rhythm and language-dot levels.
- Enforced A4-safe margins in renderer for all templates.
- Added footer page counter for all generated PDFs.
- Improved `edinburgh-v1` header/photo treatment with centered circular photo and arc crossing accent.
- Added Font Awesome Free icon support for Edinburgh sidebar contact and interest bullets.
- Added five-dot skill classification rendering for Edinburgh skills list.
- Added template-localized BG/EN section labels selected from the active CV language variant.
- Refined `edinburgh-v1` top-name sizing split, arc curvature, and thinner circular photo border.
- Added template-level date display controls (`exact`, `month-year`, `year`) for experience/education ranges.
- Set `edinburgh-v1` to render position dates as `year - year` from exact YAML dates.
- Rebalanced print typography scale for A4 readability across template renderers.
- Added placeholder interests in seed `001` BG/EN CV variants.
- Updated `edinburgh-v1` interests to render as square-bullet list in the left sidebar, placed below skills.
- Added template-driven profile summary layout mode with single-paragraph support for multi-item summaries.
- Extended `edinburgh-v1` rendering coverage with additional CV sections:
  targeting, transition narrative, role applicability, core strengths, social skills,
  and optional projects/awards/publications/volunteering/patents/portfolio links.
- Centered the BG/EN language pill in workspace controls.
- Hid `AI Template Ingestion` tab from the primary prototype navigation.
- Added template gallery cards with first-page live PDF previews per template,
  using the most recently updated available CV variant.
- Added print keep-together rules so sections move to the next page instead of splitting lines across pages when possible.
- Reduced Edinburgh photo-to-personal-details vertical gap by ~50%.
- Moved Edinburgh `headline + summary + targeting + transition/applicability/core/social` block to the end of the CV flow.
- Corrected Edinburgh right-column order/content:
  `positioning.profile_summary` is now a single paragraph at the top, with
  `positioning.headline`, `targeting`, `positioning.transition_narrative`,
  and `positioning.role_applicability` removed from output.
- Removed `professional-v1` template from active catalog and defaults.
- Rebuilt `europass-v1` renderer from the provided real sample PDF structure
  (`examples/cv_bg_004_alianz.pdf`) using Europass-style two-column labeled rows.
- Added immutable source artifact for Europass template:
  `templates/europass-v1/source/original.pdf`.
- Enriched `data/cvs/cv_bg_001_alianz.yaml` with additional details extracted
  from `examples/cv_bg_004_alianz.pdf` (expanded work responsibilities,
  employer/location context, products, education subjects/qualification, and
  optional publications/other skills).
- Added missing per-job detail lines from PDF into BG experience entries,
  including duration text and role-context statements for each period.
- Edinburgh now renders per-job `products` as square-bullet lists below responsibilities.
- Product notes are rendered in a separate subelement (`product-note`) when present.
- Edinburgh right-column spacing improved with healthier section padding.
- Added consolidated Edinburgh `Competencies` section grouping core strengths,
  social skills, other skills, and publications.
- Fixed template dropdown state handling so `europass-v1` remains selectable.
- Template Gallery now renders static first-page PNG previews (no embedded PDF frame controls).
- Improved `europass-v1` fidelity with top-left Europass header + EU flag mark.
- Expanded `europass-v1` content coverage from `cv_bg_001_alianz`:
  positioning headline, richer per-job metadata (industry/employment type/duration/parallel role/results),
  product/tool rendering, extended education fields, and additional-information sections
  (certifications, projects, awards, publications, volunteering, patents, portfolio links, interests).
- Added missing BG/EN Europass label keys for new sections and row labels.
- Updated `europass-v1` typography and layout polish:
  Arial regular for field labels, Arial bold for section/title headings,
  Arial Narrow for content values, left-shifted label/content separator, and
  reduced bullet indentation depth.
- Adjusted smart page-flow behavior so main sections can span pages; keep-together now applies at subsection/item level (e.g. rows/entries) instead of whole top-level sections.
- Further polished `europass-v1` Linux font fallbacks and spacing:
  added Arial-compatible fallback stacks (including narrow-face fallbacks),
  moved label/value split further left for wider content column, and applied
  minimal bullet indentation consistently across all Europass list rows.
- Refined `europass-v1` pagination scope and column spacing:
  keep-together no longer applies to whole job subsections (`.entry`), so long
  work-experience jobs can split across pages by row, and the label/value
  inter-column spacing was increased for clearer separation.
- Polished `europass-v1` fields and bullets:
  softened left-column field label weight, tuned custom bullet geometry
  (shallower indent/gap), removed employment duration row, and made
  parallel-role visibility conditional by appending it as a suffix to the
  occupation field only when applicable.
- Simplified composer UX chrome:
  removed runtime status field and service launch/stop/refresh controls, and
  merged title/header and workspace content into a single unified panel.
- Updated Template Gallery layout:
  removed the internal gallery header subframe and enforced A4 first-page
  aspect ratio (`210/297`) for each template preview frame.
- Fixed main workspace viewport fit:
  left controls sidebar and right PDF preview now stay within screen height
  with internal scrolling and healthier bottom padding.
- Ordered templates with `europass-v1` first in both workspace dropdown and gallery.
- Fixed gallery first-page sizing consistency by switching preview image fit to
  `object-contain` within strict A4 frames, preventing template-specific cropping
  that made Edinburgh appear longer than Europass.
- Europass refinements:
  removed `Employment Type` output row, increased left label emphasis to soft bold,
  and unified bullet rendering/spacing across sections with tighter pre/post-bullet spacing.
- Fine-tuned Europass bullet vertical alignment by lowering custom bullet markers
  to better center-align with text lines across all sections.
- Updated Europass positioning output to hide `Role Applicability` and
  `Transition Narrative` rows, and nudged bullet markers 2px higher for
  improved vertical centering.
- Temporarily hid Europass `Key quantified results` rows in experience output
  pending final presentation design.
- Updated CV selector UX: the `CV Variant` dropdown now shows one entry per
  BG/EN pair (same iteration+target), while language selection remains controlled
  via the BG/EN pill.
- Removed Europass template-local footer counter (`Page N`) to avoid duplicate
  pagination and suppress `Page 0` output.
- Synced `cv_en_001_alianz` with all newly expanded fields from BG `0001`
  and translated the added content to English (experience details, addresses,
  products, education subjects/level, and optional sections).
- Added OpenRouter settings API and persistence:
  `GET/PUT /api/settings/openrouter` backed by `data/settings/openrouter.yaml`.
- Added AI CV scoring endpoint `POST /api/analysis/cv` for section-level and
  full-CV analysis/proposals via OpenRouter.
- Added new `CV Editor` tab with section sub-tabs, JSON section editing, save-to-YAML flow,
  and AI scoring actions (section + whole CV).
- Removed Edinburgh template-local footer counter (`Page N`) to rely on global pagination.
- Refined templates gallery card sizing so each card wraps its A4 image content
  (no stretched card to panel bottom), with balanced top/bottom padding around preview image.
- Removed `Source CV: ...` helper line from Templates tab.
- Updated main header copy by removing `Prototype Control Room` and replacing
  the subtitle with product-purpose text.
- Renamed top navigation labels:
  `CV Workspace` -> `Print Room`, `CV Editor` -> `Editor`.
- Editor controls now remove template selector from edit flow and support dual section modes:
  `Form View` (default) + optional `YAML View`.
- Added recursive form editing with bilingual field metadata/copy, plus extensive
  nested array/object controls (add/remove/custom fields and custom entries) and
  date picker support for date fields.
- OpenRouter settings UX improved:
  compact masked API key display (no overflow) and persistence logic that no
  longer clears stored keys when saving model/base URL updates.
- Verified scoring path after key save no longer returns `API not configured`;
  failures now reflect provider/API response errors when key/provider are invalid.
- Refined Editor Form Generator controls:
  replaced text action buttons (`+ Custom Field`, `Remove Field`) with compact icon buttons,
  right-aligned them in header rows, and removed extra per-field wrapper nesting used only for action controls.
- Upgraded AI scoring panel rendering:
  structured section/full analysis JSON now displays as score cards with per-field/per-section scores,
  analysis text, proposals, and top actions (raw JSON fallback kept for non-structured responses).
- Added Editor `SYNC` button next to BG/EN pill:
  syncs missing fields from selected language to sibling language variant and
  translates content using configured OpenRouter model.
- Added backend endpoint `POST /api/cvs/sync` to perform missing-field detection,
  OpenRouter translation of missing fragments, and snapshot-backed target variant update.
- Moved `Form View | YAML View` toggle into the editor action row (left of scoring buttons)
  and removed it from the left-side controls section.
- OpenRouter settings now populate model selection from fetched model catalog
  (dropdown instead of free-text model field).
- Added 72-hour server-side OpenRouter model cache with automatic refresh on app load when stale
  and forced refresh after API key/settings save.
- Updated Editor terminology from `CV Pair` to `CV Variant` and enhanced
  OpenRouter model dropdown labels with model free status, average mixed
  $/1M token pricing, and estimated full-CV scoring cost based on current CV
  size plus 20% token overhead.
- OpenRouter settings panel now shows a clear configured-state message for
  saved API keys (with emphasized styling), uses a configured-aware API key
  input placeholder, and always displays `Settings saved.` in English.
- Fixed OpenRouter model price pipeline:
  robustly parses pricing values from API/cache, invalidates fresh-but-incomplete
  cached model lists with missing pricing, and normalizes dropdown price display
  to two decimals (`0.00`) with `N/A` fallback when pricing is unavailable.
- Moved `SYNC` action out of `Print Room` and into `Editor` language controls.
- Improved Editor form UX for long text fields by auto-switching to dynamic-height
  textareas sized to content length (including primitive array items).
- Print Room PDF preview now uses the full right-panel space directly (removed the
  nested inner preview frame) for a larger on-screen PDF view.
- Template display names now strip `(Rebuilt)` and `(Prototype)` suffixes in
  the Templates tab titles (and template selector labels).
- Expanded `cv-keyword-analysis` native JD discovery by generating role-based
  search seed URLs from configured templates/suffixes (no Firecrawl required),
  improving non-paid crawl coverage for resume runs.
- Fixed OpenRouter model pricing reliability when an invalid/expired API key is
  stored: model catalog fetching now retries the public models endpoint without
  auth before falling back to cache, so pricing metadata remains available and
  dropdown entries no longer degrade to `N/A` from stale incomplete cache.
- Renamed seed CV variant display metadata from `Initial Alianz 1.0` to
  `Initial March 2026 1.0`.
- Upgraded AI CV scoring prompt payload with stricter weighted rubric,
  confidence + severity findings, and interview-safe ATS-focused rewrite constraints.
- Added OpenRouter credit status endpoint `GET /api/settings/openrouter/credit`
  and UI polling every 60 seconds to show remaining credit/usage in the
  OpenRouter settings box.
- Implemented an Epic-level SYNC diff experience in Editor:
  sync now returns per-field change details and opens a comprehensive modal
  listing every modified field with direction (`BG > EN` / `BG < EN`), source-of-truth,
  previous target value, and new translated target value.
- Extended `edinburgh-v1` education rendering to include full education details
  from YAML (field of study, subjects, qualification level, faculty, location,
  and completion status).
- Added per-job publication link support in CV YAML and renderers via
  `experience[].publication_links[]` with:
  - `url` (required for rendering),
  - `title` (optional),
  - automatic title extraction from URL when title is not provided.
- Added publication link rendering in both Edinburgh and Europass experience
  sections, including localized labels.
- OpenRouter configured-key status text is now bold neutral body text
  (non-green), per UI preference.
- Templates gallery cards no longer show the technical template id string
  below the human-readable template title.
- Added SYNC status endpoint `POST /api/cvs/sync/status` and Editor gating:
  SYNC is now gray/disabled until a missing-field diff or BG/EN last-edited
  timestamp difference is confirmed.
- Added metadata timestamp support for edits:
  CV writes now set `metadata.last_edited_at` (ISO timestamp).
- Print Room / Europass:
  added subsection pagination hints for job-position blocks to reduce tiny
  (<4-line) carry-over fragments at page bottoms.
- Started `cv-keyword-analysis` implementation with first JD scraper CLI
  (`jd_scraper.py`), weighted relevance config, seed URL list, and JSON export flow.
- Upgraded `cv-keyword-analysis` scraper with start/resume support:
  persistent SQLite cache, URL/content-hash dedupe, per-page persisted keyword
  analysis, and incremental commits to avoid reprocessing on reruns.
- Added optional Firecrawl search provider mode for JD scraping
  (`--provider firecrawl`, `FIRECRAWL_API_KEY`).

### Changed

- OpenRouter credit status labels now consistently report remaining credit
  wording and no longer show usage phrasing in the settings panel.
- OpenRouter credit status no longer shows `(limit unavailable)` fallback text;
  it now stays on a neutral remaining-credit unavailable message when the API
  does not return a remaining value.
- OpenRouter credit status now falls back to OpenRouter `/api/v1/credits`
  (`total_credits - total_usage`) when `/api/v1/key` does not provide
  `limit_remaining`, so remaining credit still resolves to a numeric value.
