# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.2] - 2026-03-08

### Added

- New **Photo Booth** tab with drag-and-drop upload, per-image approval, and dedicated AI photo analysis actions.
- New multi-image AI comparison workflow in Photo Booth (2+ selected images) with ranked results and recommendation details.
- New `Settings` tab (right-aligned in the tab row) for OpenRouter setup and account credit visibility.
- New MCP wrapper package (`@muhfweeceevee/mcp-wrapper`) exposing key internal API operations as MCP tools.

### Changed

- Preview/export pipeline now applies approved Photo Booth image overrides without mutating CV YAML.
- Template preview cards now render using the currently selected Print Room CV and approved photo when available.
- CV targeting is now company-agnostic at CV level; target company metadata is managed in dedicated company metadata files.
- Editor AI targeting now supports metadata source selection and multi-company selection with inline metadata editing.
- OpenRouter configuration was moved from Editor to Settings with status icon states and compact remaining-credit display in the tab button.
- OpenRouter `Analysis Model` selection now separates pricing details from dropdown labels and shows approximate per-check cost estimates in a dedicated block.
- Settings now includes an image-generation model selector filtered to models with image-generation capability (future-ready; not yet wired to runtime generation flows).
- Editor Form View for nested structures now uses collapsible containers with collapsed-by-default nested sections and summary metadata headers.
- Experience entries in Form View now use semantic container naming (job title header, period/company subtitle) instead of generic numbered labels.
- Photo Booth UX was polished with compact gallery cards, overlay actions, clipboard paste support, and right-side analysis layout.
- Photo assets and analysis metadata now use filesystem-backed storage with safe migration from legacy browser-cached gallery data.
- Language-variant auto-resolution now accepts both CV id formats:
  `cv_<language>_<target>` and `cv_<language>_<iteration>_<target>`, removing the hard requirement for `iteration` in translation flows.

### Fixed

- Fixed Keywords analysis false-empty dataset behavior when sqlite binary resolution differs by runtime environment, preventing silent zero-item core rebuilds.

## [1.0.1] - 2026-03-07

### Added

- New modern templates in the gallery:
  - **Cambridge 1.0** with a full-width blue CV header, clean date-column timeline structure, dot-rated language/skills blocks, and formal UK-style layout balance
  - **Harvard 1.0** with a bold sidebar, timeline-style sections, and star-based language/skills scoring
  - **Stanford 1.0** with a clean sidebar, minimal content flow, and horizontal skill bars
- New Harvard theme options so you can quickly restyle the template: Default Slate, Blue, Pink, Red, and Amber Gold.
- New Stanford theme options: Default Slate, Blue, Pink, Red, and Amber Gold.
- New Cambridge theme options: Default Blue, Mustard Gold, Emerald Green, Steel Blue, and Rose Red.
- Harvard and Stanford now ship with broad data coverage on launch (projects, publication links, certifications/courses, awards, volunteering, patents, portfolio links, and competency groups).
- Stanford ships with refined visual details out of the box:
  - first-last header naming
  - white sidebar separators
  - dedicated divider under Work Experience heading
  - improved spacing/typography and skill-bar balance.
- Harvard ships with launch polish:
  - first-last header naming
  - improved photo/timeline marker alignment
  - driving-license row removed from sidebar personal details.
- Print Room now includes a `Photo` customization dropdown with:
  `Default`, `On - Circle`, `On - Square`, `On - Original Ratio`, and `Off`.
  The setting is applied to preview/export and is saved in browser state.
- In `On - Original Ratio` mode:
  - fallback now renders as a fixed 3:4 rectangle when no photo is available
  - photos are bottom-anchored to reduce overlap risk with nearby text.

### Changed

- Contact fields now support LinkedIn/GitHub values as full URL, short domain URL, or plain identifier (for example `in/name` or `username`), with compact display used across templates.
- Public sample CV id was simplified from numbered format to `cv_en_john_doe`, and all internal docs/references now point to the new id.
- Language management in Editor is much smoother:
  - add new language variants from a modal
  - optionally create an AI translation in one step
  - auto-switch into the new language right away
  - language pills update automatically (English stays first when available)
- SYNC is now more flexible:
  - choose any source and target language pair from a dedicated sync modal
  - preview last update timestamps before running sync
- OpenRouter setup is simpler:
  - saving your API key now updates local `.env` automatically
  - credit display now reflects prepaid balance behavior
- Editor is more comfortable for long editing sessions: AI Scoring Analysis can now be minimized into a side drawer with a quick handle toggle, giving Form/YAML more room when you just want to write.

### Fixed

- Fixed theme-toggle hydration warnings in the browser.
- Improved OpenRouter error feedback so invalid/unauthorized key issues are clearer.
- Removed driving-license row from sidebar personal details in Edinburgh for a cleaner layout.

## [1.0.0] - 2026-03-06

### Added

- Initial public release of the professional CV generator workspace.
- Print Room with live CV-to-template preview and export-ready output.
- Template gallery with implemented `europass-v1` and `edinburgh-v1` layouts.
- Theme support for Edinburgh template variants in preview/export.
- Editor with Form and YAML modes for section-level CV editing.
- AI scoring panel for section and full-CV feedback with actionable rewrite guidance.
- BG/EN variant workflow with sync and diff visibility between language variants.
- Keywords workspace for JD-driven keyword gap analysis:
  - role-focused keyword insights
  - missing / underused / used keyword buckets
  - weighted usage scoring
  - seniority, hard-skill, and soft-skill priority keyword surfaces
  - structured keyword hover diagnostics.
- Collection/data operations flow for keyword dataset refresh and growth tracking.
- Built-in sample CV content for public demonstration and local testing.
