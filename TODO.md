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
- [ ] Add import/export UI for YAML packages.
- [ ] Add template review status workflow (`pending/approved/rejected`).
- [ ] Add visual diff tests for selected PDF golden outputs.
