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
