# MuhFweeCeeVee Development Plan (V1)

## Summary

Изграждаме self-hosted web приложение за управление на CV данни в YAML,
прилагане на професионални template-и и export към PDF.
Проектът стартира от празно repo и ще е **single-user**,
**bare-metal systemd**, **form-first + live preview**,
с **curated template library** и правна/лицензна мета-информация
за всеки template.

## Chosen Technical Stack (decision complete)

- Frontend + Backend framework:
  **Next.js 15 (App Router) + React 19 + TypeScript**
- UI system (desktop-like feel):
  **Tailwind CSS + shadcn/ui + Radix UI + Framer Motion**
- State/data fetching: **TanStack Query + Zustand**
- YAML handling: **eemeli/yaml**
- PDF rendering: **HTML/CSS print via headless Chromium (Playwright)**
- PDF template reverse-engineering service: **Python FastAPI + PyMuPDF + pdfplumber**
- Validation: **JSON Schema + AJV**
- Local storage: filesystem-first (`data/*.yaml`, `templates/*.yaml`, `assets/`)
  - lightweight index cache (`SQLite`) за бързо listing/filter
- Process management: **systemd services** (`muhfweeceevee-web`,
  `muhfweeceevee-parser`, optional `muhfweeceevee-worker`)
- Reverse proxy: **Nginx** (localhost upstream, TLS optional if exposed)

## System Architecture

### 1) Web App (Next.js)

Отговаря за:

- CV CRUD (YAML-backed)
- Template browser/library
- Mapping editor (field -> slot)
- Live preview (HTML layout engine)
- PDF export trigger + download

### 2) Parser Service (FastAPI)

Отговаря за:

- PDF ingestion
- Layout decomposition (blocks, coordinates, fonts, spacing)
- Генериране на initial template draft (`template.layout.yaml`)
- Confidence scores за автоматично разпознаване

### 3) Storage Layout (filesystem authoritative)

```text
muhfweeceevee/
  data/
    cvs/
      <cv_id>.yaml
    template_mappings/
      <cv_id>__<template_id>.yaml
  templates/
    catalog.yaml
    <template_id>/
      template.yaml
      layout.yaml
      license.yaml
      preview.png
      source/
        original.pdf
  exports/
    <cv_id>__<template_id>__<timestamp>.pdf
  logs/
```

## Public Interfaces / APIs

### Web Routes

- `GET /` dashboard
- `GET /cvs`
- `GET /cvs/:id`
- `GET /templates`
- `GET /templates/:id`
- `GET /compose?cv=:id&template=:id`
- `GET /exports`

### Internal API (Next route handlers)

- `POST /api/cvs` create CV YAML
- `PUT /api/cvs/:id` update CV YAML
- `GET /api/cvs/:id` get CV YAML
- `POST /api/templates/import` upload PDF + metadata
- `POST /api/templates/:id/analyze` call parser service
- `PUT /api/templates/:id/layout` manual corrections
- `PUT /api/mappings/:cvId/:templateId` save field-slot mapping
- `POST /api/render/pdf` generate export
- `GET /api/exports/:file` download PDF

### Parser Service API

- `POST /analyze-pdf` -> normalized layout JSON
- `POST /draft-template` -> `layout.yaml` draft + confidence map
- `GET /health`

## Core Data Contracts

### CV YAML (`cv.v1`)

- `meta`: id, locale, updated_at
- `personal`: name, contact, location
- `summary`
- `experience[]` (role, company, start, end, bullets[])
- `education[]`
- `skills` (groups)
- `languages[]`
- `custom_sections[]`

### Template YAML (`template.v1`)

- `meta`: template_id, name, version, author
- `page`: size, margins, columns
- `tokens`: colors, fonts, spacing
- `slots[]`: semantic placeholders (`experience.items`, `skills.list`)
- `rules`: overflow behavior, max pages, widow/orphan rules

### Mapping YAML (`mapping.v1`)

- `cv_id`, `template_id`
- `bindings[]`: `cv.path -> template.slot`
- `transforms[]`: truncation, formatting, date style
- `fallbacks`: missing field strategy

## Template Acquisition + Legal Policy (Curated Library)

- Всеки template в curated library е валиден само ако има:
  - `license.yaml` с source URL, license type, redistribution rights
  - human review status (`pending|approved|rejected`)
- Забранено публикуване/redistribute на template без изрични права.
- Ingestion pipeline:
  1. Upload original PDF
  2. Attach legal metadata
  3. Analyze layout
  4. Manual review
  5. Approve to catalog

## Desktop-like UX Scope (V1)

- Multi-pane layout: left navigation, center form editor, right live preview
- Command bar (`Ctrl/Cmd+K`) за quick actions
- Draggable resizable panels (not free canvas)
- Revision snapshots per CV (savepoint list)
- “Apply Template” wizard with compatibility warnings

## Implementation Phases

### Phase 0: Foundation (repo bootstrap)

- Monorepo structure:
  - `apps/web`
  - `services/parser`
  - `packages/schemas`
  - `packages/render-core`
- Base CI, lint, test, typecheck
- systemd unit templates + env docs

### Phase 1: YAML CV Core

- CV schema + validation
- CV CRUD UI + file persistence
- Import/export CV YAML
- Basic list/search/filter

### Phase 2: Template Catalog + Ingestion

- Template metadata model + catalog
- PDF upload flow
- Parser integration (draft layout generation)
- Manual template editor (slot mapping, tokens)

### Phase 3: Composer + Live Preview

- Bind CV -> template slots
- Real-time preview rendering
- Overflow diagnostics and warnings
- Save/load mapping profiles

### Phase 4: PDF Export Pipeline

- HTML snapshot renderer
- Playwright print-to-PDF
- Font embedding and deterministic pagination controls
- Export history + download UI

### Phase 5: Hardening + Release

- systemd deployment scripts
- Recovery/logging strategy
- Performance passes
- Documentation and sample templates

## Testing Plan and Acceptance Scenarios

### Unit Tests

- YAML schema validation (valid/invalid cases)
- Slot-binding transformations
- Date formatting and fallback logic
- Overflow rule engine

### Integration Tests

- End-to-end: create CV -> apply template -> export PDF
- Ingestion: upload PDF -> analyze -> generate layout draft
- Mapping persistence reload consistency

### E2E/UI Tests (Playwright)

- CV CRUD happy path
- Template selection and apply flow
- Live preview updates after form edits
- Export download integrity

### Golden Tests (PDF)

- Snapshot-based structural checks (page count, text anchors, margins)
- Pixel-tolerance visual diff for selected templates

### Non-functional Checks

- Startup/restart under systemd
- Parser failure fallback behavior
- Large CV stress (3+ pages, long experience sections)

## Operational Plan (Self-host Bare Metal)

- `muhfweeceevee-web.service` (Next app)
- `muhfweeceevee-parser.service` (FastAPI)
- Optional `muhfweeceevee-worker.service` (async tasks)
- Nginx reverse proxy
- Backup strategy:
  - nightly tar of `data/`, `templates/`, `exports/`
  - 14-day rotation
- Logs via journald + optional file sink

## Explicit Assumptions and Defaults

- Single-user only in V1 (no auth/roles)
- Authoritative persistence is YAML files on disk
- Curated template library is maintained with explicit license metadata
- PDF export engine is Chromium-based (not LaTeX/Typst in V1)
- Editor UX is form-first with live preview; no freeform canvas in V1
- Internationalization starts with `bg` + `en`
- Initial target: reliable 1-2 page professional CV output, expandable later
