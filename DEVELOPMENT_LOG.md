# DEVELOPMENT_LOG

## 2026-02-27 - Bootstrap governance and stack init

Initialized repository bootstrap for MyFreeCeeVee architecture and
added operating docs.

- Added plan document: `DEVELOPMENT_PLAN.md`.
- Bootstrapped workspace structure:
  `apps/`, `services/`, `packages/`, `deploy/`, `data/`.
- Created Next.js web scaffold in `apps/web`.
- Added parser scaffold in `services/parser/main.py` and dependency file.
- Added systemd and nginx baseline config files under `deploy/`.
- Added project governance docs:
  `AGENTS.md`, `TODO.md`, `CHANGELOG.md`, `DEVELOPMENT_LOG.md`.

Validation run:

- `npm run lint` -> pass
- `npm run typecheck` -> pass
- Parser import check -> pass
- Parser `/health` smoke test -> pass

## 2026-02-27 - CV YAML + scoring rules import and bootstrap templating

Imported the CV YAML rules, seed CV YAML (`cv_bg_001_alianz`), and CV scoring
rules into the project as initial templating + documentation assets.

- Added `data/cvs/cv_bg_001_alianz.yaml` as first canonical test CV.
- Added template catalog and bootstrap template:
  `templates/catalog.yaml`, `templates/professional-v1/*`.
- Added seed mapping file:
  `data/template_mappings/cv_bg_001_alianz__professional-v1.yaml`.
- Added documentation:
  `docs/cv/CV_YAML_STANDARD.md`,
  `docs/cv/CV_SCORING_STANDARD.md`,
  `docs/cv/INITIAL_TEMPLATING_BOOTSTRAP.md`.
- Added machine-readable scoring constants:
  `packages/schemas/src/cvScoring.ts` and schema exports update.
- Updated `README.md`, `TODO.md`, and `CHANGELOG.md` for doc-sync compliance.

Validation run:

- `markdownlint-cli2` on changed markdown files -> pass

## 2026-02-27 - Markdownlint rule parity with lifestyle repo

Aligned markdown lint rules with `/home/apoapostolov/git/lifestyle` by
adding root `.markdownlint.json` with the same disabled rule set.

Validation run:

- `npx -y markdownlint-cli2 README.md` -> pass with project config

## 2026-03-05 - Start implementation for P0/P1/P2 execution tracks

Context/root cause:

- The repo still had scaffold-level web UX and parser-facing TODO tracks with
  no CV CRUD API, no persistent edit flow, no compatibility warnings, and no
  revision history support.
- P0/P1/P2 execution needed a concrete first vertical slice across priority
  lanes instead of only planning artifacts.

Files touched:

- `package.json`
- `packages/schemas/src/cvSchema.ts`
- `packages/schemas/src/index.ts`
- `apps/web/tsconfig.json`
- `apps/web/src/lib/server/repoPaths.ts`
- `apps/web/src/lib/server/cvStore.ts`
- `apps/web/src/lib/server/cvCompatibility.ts`
- `apps/web/src/app/api/cvs/route.ts`
- `apps/web/src/app/api/cvs/[cvId]/route.ts`
- `apps/web/src/app/api/cvs/[cvId]/history/route.ts`
- `apps/web/src/app/ComposerClient.tsx`
- `apps/web/src/app/page.tsx`
- `apps/web/src/app/layout.tsx`
- `README.md`
- `CHANGELOG.md`
- `TODO.md`

Validation commands and results:

- `npm run lint` -> pass
- `npm run typecheck` -> initially failed (`@myfreeceevee/schemas` path not
  resolved in web workspace)
- Added `apps/web/tsconfig.json` path alias for
  `@myfreeceevee/schemas` -> `../../packages/schemas/src/index.ts`
- `npm run typecheck` -> pass
- `npm run lint` -> pass

## 2026-03-05 - Bilingual variants + versioned CV IDs with git visibility

Context/root cause:

- Parallel translation produced an English CV variant and the platform needed
  explicit bilingual variant handling (`bg`/`en`) with versioned naming and
  automated missing-language variant creation.
- Seed CV iteration naming needed rebasing from `0004` to `0001` as the
  canonical first usable iteration.

Files touched:

- `apps/web/src/lib/server/cvVariants.ts`
- `apps/web/src/lib/server/cvStore.ts`
- `apps/web/src/lib/server/cvCompatibility.ts`
- `apps/web/src/app/api/cvs/route.ts`
- `apps/web/src/app/api/cvs/[cvId]/route.ts`
- `apps/web/src/app/api/cvs/[cvId]/history/route.ts`
- `packages/schemas/src/cvSchema.ts`
- `data/cvs/cv_bg_001_alianz.yaml`
- `data/cvs/cv_en_001_alianz.yaml`
- `data/template_mappings/cv_bg_001_alianz__professional-v1.yaml`
- `data/template_mappings/cv_en_001_alianz__professional-v1.yaml`
- `README.md`
- `CHANGELOG.md`
- `TODO.md`

Validation commands and results:

- `npm run typecheck` -> pass
- `npm run lint` -> pass
- `npm run check` -> pass

## 2026-03-05 - Prototype UX launch shell + Europass + AI ingestion prep

Context/root cause:

- Needed a launchable prototype-level interface so users can run the service
  and test UX flow before full backend completion.
- Needed a basic Europass template scaffold and explicit prep paths for
  PDF/Image to template conversion via AI-assisted pipelines.

Files touched:

- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/globals.css`
- `apps/web/src/app/ComposerClient.tsx`
- `apps/web/src/app/api/prototype/state.ts`
- `apps/web/src/app/api/prototype/route.ts`
- `apps/web/src/app/api/prototype/ingest/route.ts`
- `services/parser/main.py`
- `templates/catalog.yaml`
- `templates/europass-v1/template.yaml`
- `templates/europass-v1/layout.yaml`
- `templates/europass-v1/license.yaml`
- `data/template_mappings/cv_bg_001_alianz__europass-v1.yaml`
- `data/template_mappings/cv_en_001_alianz__europass-v1.yaml`
- `docs/cv/INITIAL_TEMPLATING_BOOTSTRAP.md`
- `README.md`
- `CHANGELOG.md`
- `TODO.md`

Validation commands and results:

- `npm run lint` -> pass
- `npm run typecheck` -> pass
- `npm run check` -> pass
- `/usr/bin/python3 -m py_compile services/parser/main.py` -> pass

## 2026-03-05 - Added first template from provided sample: Edinburgh

Context/root cause:

- User provided a concrete CV visual sample and requested the first production
  template line to be named "Edinburgh".
- Prototype UI needed to present Edinburgh as the primary template choice while
  retaining Europass as a secondary baseline.

Files touched:

- `templates/edinburgh-v1/template.yaml`
- `templates/edinburgh-v1/layout.yaml`
- `templates/edinburgh-v1/license.yaml`
- `templates/catalog.yaml`
- `data/template_mappings/cv_bg_001_alianz__edinburgh-v1.yaml`
- `data/template_mappings/cv_en_001_alianz__edinburgh-v1.yaml`
- `apps/web/src/app/ComposerClient.tsx`
- `README.md`
- `docs/cv/INITIAL_TEMPLATING_BOOTSTRAP.md`
- `CHANGELOG.md`
- `TODO.md`
- `DEVELOPMENT_LOG.md`

Validation commands and results:

- `npm run lint` -> pass
- `npm run typecheck` -> pass
- `npm run check` -> pass

## 2026-03-05 - Reality check runtime + variant parsing compatibility fix

Context/root cause:

- First live runtime smoke check showed `/api/cvs` returning null variant metadata
  because seed file names used `cv_*_001_*` while parser expected 4-digit
  iterations only.

Files touched:

- `apps/web/src/lib/server/cvVariants.ts`
- `CHANGELOG.md`
- `DEVELOPMENT_LOG.md`

Validation commands and results:

- `npm run typecheck` -> pass
- `curl -sS http://127.0.0.1:3001/api/cvs` -> pass with parsed language/iteration/target

## 2026-03-05 - Real PDF preview lane with CV/template selection and print export

Context/root cause:

- Needed the first functional operator flow: select CV + template, generate
  actual PDF, preview it in-app, and provide print/save action.

Files touched:

- `apps/web/src/lib/server/templateStore.ts`
- `apps/web/src/lib/server/renderCvTemplate.ts`
- `apps/web/src/app/api/templates/route.ts`
- `apps/web/src/app/api/preview/html/route.ts`
- `apps/web/src/app/api/export/pdf/route.ts`
- `apps/web/src/app/ComposerClient.tsx`
- `README.md`
- `CHANGELOG.md`
- `TODO.md`
- `DEVELOPMENT_LOG.md`

Validation commands and results:

- `npm run check` -> pass
- `npm run build` -> pass
- `curl -sS http://127.0.0.1:3001/api/templates` -> pass
- `curl -sS -D - \"http://127.0.0.1:3001/api/export/pdf?cvId=cv_bg_001_alianz&templateId=edinburgh-v1\" -o /tmp/cv_preview.pdf` -> pass (`200`, `application/pdf`)
- `file /tmp/cv_preview.pdf` -> pass (`PDF document`)

## 2026-03-05 - UX refinement pass: language pill, readable selectors, and Edinburgh polish

Context/root cause:

- UX feedback required better operator ergonomics: fixed-height app panel,
  direct BG/EN switching, and friendly names/versions in selectors.
- Edinburgh preview needed closer visual parity for reality-check quality.

Files touched:

- `apps/web/src/app/ComposerClient.tsx`
- `apps/web/src/lib/server/cvStore.ts`
- `apps/web/src/lib/server/renderCvTemplate.ts`
- `data/cvs/cv_bg_001_alianz.yaml`
- `data/cvs/cv_en_001_alianz.yaml`
- `templates/catalog.yaml`
- `templates/edinburgh-v1/template.yaml`
- `templates/europass-v1/template.yaml`
- `templates/professional-v1/template.yaml`
- `README.md`
- `CHANGELOG.md`
- `DEVELOPMENT_LOG.md`

Validation commands and results:

- `npm run check` -> pass
- `npm run build` -> pass
- `curl -sS http://127.0.0.1:3001/api/cvs` -> pass with display name/version
- `curl -sS -D - \"http://127.0.0.1:3001/api/export/pdf?cvId=cv_bg_001_alianz&templateId=edinburgh-v1\" -o /tmp/cv_preview_ux.pdf` -> pass
- `file /tmp/cv_preview_ux.pdf` -> pass (`PDF document`)

## 2026-03-05 - Template print standards pass (margins, footer counter, Edinburgh fidelity)

Context/root cause:

- Required print-safe defaults across templates and closer visual parity with
  the provided Edinburgh sample (photo/arc, iconized sidebar, five-dot skills).

Files touched:

- `apps/web/src/lib/server/renderCvTemplate.ts`

## 2026-03-05 - Europass parity pass: EU header/flag + expanded YAML field coverage

Context/root cause:

- Europass preview was missing the expected top-left Europass branding treatment
  from the source sample PDF and omitted multiple fields present in expanded
  `cv_bg_001_alianz.yaml`.

Files touched:

- `apps/web/src/lib/server/renderCvTemplate.ts`
- `templates/europass-v1/template.yaml`
- `CHANGELOG.md`
- `DEVELOPMENT_LOG.md`
- `TODO.md`

Validation commands and results:

- `npm run check` -> pass
- `npm run build` -> pass

## 2026-03-05 - Europass typography and row split polish

Context/root cause:

- Requested closer Europass visual parity for text hierarchy and row density:
  specific font families by semantic role, more right-column room, and tighter bullet indentation.

Files touched:

- `apps/web/src/lib/server/renderCvTemplate.ts`
- `CHANGELOG.md`
- `DEVELOPMENT_LOG.md`

Validation commands and results:

- `npm run check` -> pass

## 2026-03-05 - Smart page transition scope fix (main sections can flow)

Context/root cause:

- Keep-together behavior was still applied to top-level section blocks in Europass,
  which could push long main sections (for example work experience) to a new page.
- Requirement is to keep smart transitions at subsection/item level only.

Files touched:

- `apps/web/src/lib/server/renderCvTemplate.ts`
- `CHANGELOG.md`
- `DEVELOPMENT_LOG.md`

Validation commands and results:

- `npm run check` -> pass

## 2026-03-05 - Europass fallback fonts + global bullet indentation consistency

Context/root cause:

- Requested typography policy did not render consistently on Linux due to font availability.
- Bullet indentation tightening had only been applied in job entries, while other Europass list rows remained deeply indented.

Files touched:

- `apps/web/src/lib/server/renderCvTemplate.ts`
- `CHANGELOG.md`
- `DEVELOPMENT_LOG.md`

Validation commands and results:

- `npm run check` -> pass

## 2026-03-05 - Europass subsection pagination scope + wider label/value gutter

Context/root cause:

- Requested page-flow behavior needed to avoid forcing whole job subsections
  to the next page in Europass.
- Also requested increased visual separation between left label column and
  right content column.

Files touched:

- `apps/web/src/lib/server/renderCvTemplate.ts`
- `CHANGELOG.md`
- `DEVELOPMENT_LOG.md`

Validation commands and results:

- `npm run check` -> pass

## 2026-03-05 - Europass conditional field visibility and bullet geometry polish

Context/root cause:

- Requested refined Europass styling for left-label emphasis and tighter list visual rhythm.
- Required removal of employment duration and conditional rendering of parallel-role information as occupation suffix only.

Files touched:

- `apps/web/src/lib/server/renderCvTemplate.ts`
- `templates/europass-v1/template.yaml`
- `CHANGELOG.md`
- `DEVELOPMENT_LOG.md`

Validation commands and results:

- `npm run check` -> pass

## 2026-03-05 - Composer UX simplification (single frame, no runtime controls)

Context/root cause:

- Requested streamlined operator UX with services assumed to start with the app,
  removing runtime controls/status from the top frame.
- Required merging title frame and content frame into one container.

Files touched:

- `apps/web/src/app/ComposerClient.tsx`
- `CHANGELOG.md`
- `DEVELOPMENT_LOG.md`

Validation commands and results:

- `npm run check` -> pass

## 2026-03-05 - Template gallery frame cleanup + strict A4 preview sizing

Context/root cause:

- Requested removal of the nested Template Gallery header subframe.
- Requested preview frames to match the exact A4 first-page proportion.

Files touched:

- `apps/web/src/app/ComposerClient.tsx`
- `CHANGELOG.md`
- `DEVELOPMENT_LOG.md`

Validation commands and results:

- `npm run check` -> pass

## 2026-03-05 - Workspace viewport containment for left controls and PDF preview

Context/root cause:

- Requested fix for left controls pane and right PDF frame spilling below viewport.
- Needed consistent `min-h-0`/`flex` containment and internal panel scrolling.

Files touched:

- `apps/web/src/app/ComposerClient.tsx`
- `CHANGELOG.md`
- `DEVELOPMENT_LOG.md`

Validation commands and results:

- `npm run check` -> pass

## 2026-03-05 - Template ordering and gallery first-page size parity

Context/root cause:

- Requested `europass-v1` precedence in template selection surfaces.
- Gallery previews used `object-cover`, which cropped differently across
  templates and made Edinburgh look longer than Europass in first-page cards.

Files touched:

- `apps/web/src/app/ComposerClient.tsx`
- `CHANGELOG.md`
- `DEVELOPMENT_LOG.md`

Validation commands and results:

- `npm run check` -> pass

## 2026-03-05 - Europass field-label and bullet consistency pass

Context/root cause:

- Requested Europass cleanup for hidden Employment Type, stronger left-column labels,
  and uniform bullet spacing behavior across all list-based sections.

Files touched:

- `apps/web/src/lib/server/renderCvTemplate.ts`
- `CHANGELOG.md`
- `DEVELOPMENT_LOG.md`

Validation commands and results:

- `npm run check` -> pass

## 2026-03-05 - Europass bullet vertical alignment adjustment

Context/root cause:

- Requested bullet marker to sit 3-4px lower for true visual center alignment with text.

Files touched:

- `apps/web/src/lib/server/renderCvTemplate.ts`
- `CHANGELOG.md`
- `DEVELOPMENT_LOG.md`

Validation commands and results:

- `npm run check` -> pass

## 2026-03-05 - Europass positioning row visibility + bullet offset refinement

Context/root cause:

- Requested removal of `Role Applicability` and `Transition Narrative` from Europass output.
- Requested bullet marker shift 2px higher for center alignment.

Files touched:

- `apps/web/src/lib/server/renderCvTemplate.ts`
- `CHANGELOG.md`
- `DEVELOPMENT_LOG.md`

Validation commands and results:

- `npm run check` -> pass

## 2026-03-05 - Europass hide quantified results (temporary)

Context/root cause:

- Requested temporary removal of `Key quantified results` from Europass while deciding final presentation style.

Files touched:

- `apps/web/src/lib/server/renderCvTemplate.ts`
- `CHANGELOG.md`
- `DEVELOPMENT_LOG.md`

Validation commands and results:

- `npm run check` -> pass
- `apps/web/src/app/api/export/pdf/route.ts`
- `templates/edinburgh-v1/template.yaml`
- `templates/europass-v1/template.yaml`
- `README.md`
- `CHANGELOG.md`
- `DEVELOPMENT_LOG.md`

Validation commands and results:

- `npm run check` -> pass
- `npm run build` -> pass
- `curl -sS \"http://127.0.0.1:3001/api/export/pdf?cvId=cv_bg_001_alianz&templateId=edinburgh-v1\" -o /tmp/edinburgh_latest.pdf` -> pass
- `pdftotext /tmp/edinburgh_latest.pdf - | rg \"[0-9]+/[0-9]+\"` -> pass (`1/2`, `2/2`)

## 2026-03-05 - Added English variant of seed CV YAML

Context/root cause:

- Needed an English version of the existing Bulgarian seed CV file
  `cv_bg_001_alianz.yaml` in the same `data/cvs/` directory.

Files touched:

- `data/cvs/cv_en_001_alianz.yaml` (new file)
- `CHANGELOG.md`
- `DEVELOPMENT_LOG.md`

Validation commands and results:

- `node -e "const fs=require('fs');const Y=require('yaml');for (const f of ['data/cvs/cv_bg_001_alianz.yaml','data/cvs/cv_en_001_alianz.yaml']) {Y.parse(fs.readFileSync(f,'utf8'));} console.log('YAML parse OK');"` -> pass (`YAML parse OK`)

## 2026-03-05 - Edinburgh fidelity pass + template language labels + viewport-safe workspace

Context/root cause:

- Needed UX parity fixes from feedback: BG/EN pill width, localized template
  labels in all templates, no panel overflow below viewport, and tighter
  visual fidelity for `edinburgh-v1` (name treatment, arc, photo border).
- Needed print consistency: footer page counter on every generated template.

Files touched:

- `apps/web/src/app/ComposerClient.tsx`
- `apps/web/src/lib/server/renderCvTemplate.ts`
- `templates/edinburgh-v1/template.yaml`
- `templates/europass-v1/template.yaml`
- `templates/professional-v1/template.yaml`
- `README.md`
- `CHANGELOG.md`
- `DEVELOPMENT_LOG.md`

Validation commands and results:

- `npm run lint` -> pass
- `npm run typecheck` -> pass
- `npm run build` -> pass
- `curl -sS "http://127.0.0.1:3001/api/preview/html?cvId=cv_bg_001_alianz&templateId=edinburgh-v1" | rg "Лични данни|Професионален опит|Страница"` -> pass
- `curl -sS "http://127.0.0.1:3001/api/preview/html?cvId=cv_en_001_alianz&templateId=edinburgh-v1" | rg "Personal details|Work experience|Page"` -> pass
- `curl -sS "http://127.0.0.1:3001/api/preview/html?cvId=cv_bg_001_alianz&templateId=europass-v1" | rg "Контакти|Професионален опит|Страница"` -> pass
- `curl -I -sS "http://127.0.0.1:3001/api/export/pdf?cvId=cv_bg_001_alianz&templateId=edinburgh-v1"` -> pass (`200`, `application/pdf`)

## 2026-03-05 - Date format controls + Edinburgh year-year ranges + A4 typography rebalance

Context/root cause:

- Needed template-driven control of rendered date granularity from exact YAML
  dates (`YYYY-MM-DD`) to support year-only or month-year outputs per template.
- Edinburgh specifically required `year - year` date rendering per position.
- Font scale needed balancing for A4 print readability (avoid oversized headings
  and cramped sidebar text).

Files touched:

- `apps/web/src/lib/server/renderCvTemplate.ts`
- `templates/edinburgh-v1/template.yaml`
- `templates/europass-v1/template.yaml`
- `templates/professional-v1/template.yaml`
- `README.md`
- `CHANGELOG.md`
- `DEVELOPMENT_LOG.md`

Validation commands and results:

- `npm run check` -> pass
- `npm run build` -> pass
- `curl -sS "http://127.0.0.1:3001/api/preview/html?cvId=cv_en_001_alianz&templateId=edinburgh-v1" | rg "2015 - 2026|2010 - 2015|2000 - 2005"` -> pass
- `curl -sS "http://127.0.0.1:3001/api/preview/html?cvId=cv_en_001_alianz&templateId=europass-v1" | rg "08\\.2015 - 01\\.2026|09\\.2000 - 12\\.2005"` -> pass

## 2026-03-05 - Edinburgh coverage expansion + summary merge + interests placeholders

Context/root cause:

- Needed stronger Edinburgh data coverage and requested layout behavior:
  interests as square bullets below skills, profile summary merged into a
  single paragraph, and rendering of currently omitted CV sections.
- Needed placeholder interests in both seed `001` CV variants for immediate UX parity.

Files touched:

- `apps/web/src/lib/server/renderCvTemplate.ts`
- `templates/edinburgh-v1/template.yaml`
- `data/cvs/cv_bg_001_alianz.yaml`
- `data/cvs/cv_en_001_alianz.yaml`
- `README.md`
- `CHANGELOG.md`
- `DEVELOPMENT_LOG.md`
- `TODO.md`

Validation commands and results:

- `npm run check` -> pass
- `curl -sS "http://127.0.0.1:3001/api/preview/html?cvId=cv_bg_001_alianz&templateId=edinburgh-v1&v=$(date +%s)" | rg "square-bullets|Интереси|<section class=\"summary\"><p|Таргетиране|Преход|Приложимост към ролята|Ключови силни страни|Социални умения"` -> pass

## 2026-03-05 - Workspace polish: centered language pill + template gallery previews

Context/root cause:

- Needed visual alignment fix for BG/EN selector pill.
- Requested temporary hiding of AI ingestion lane from tabs.
- Needed a concrete templates gallery with live first-page previews for each template
  using the most recently updated CV variant.

Files touched:

- `apps/web/src/app/ComposerClient.tsx`
- `README.md`
- `CHANGELOG.md`
- `DEVELOPMENT_LOG.md`

Validation commands and results:

- `npm run check` -> pass
- `npm run build` -> pass
- `rg -n "justify-center|w-[90%]|Template Gallery|Source CV|#page=1" apps/web/src/app/ComposerClient.tsx` -> pass

## 2026-03-05 - Edinburgh flow reorder + print section keep-together + tighter photo/details gap

Context/root cause:

- Requested smarter page transitions so sections avoid splitting between pages.
- Requested tighter spacing between profile photo and personal details.
- Requested moving the extended targeting/transition/applicability/core/social block
  to the end of the Edinburgh flow rather than the beginning.

Files touched:

- `apps/web/src/lib/server/renderCvTemplate.ts`
- `README.md`
- `CHANGELOG.md`
- `DEVELOPMENT_LOG.md`
- `TODO.md`

Validation commands and results:

- `npm run check` -> pass
- `curl -sS "http://127.0.0.1:3001/api/preview/html?cvId=cv_en_001_alianz&templateId=edinburgh-v1&v=$(date +%s)" | rg "padding: 10mm|break-inside: avoid|Work experience|References|Data analysis, coordination|Targeting|Transition Narrative|Role Applicability|Core Strengths|Social Skills"` -> pass

## 2026-03-05 - Edinburgh correction: positioning at top, remove targeting/transition/applicability

Context/root cause:

- Previous content reorder introduced unintended sections in front/back.
- Required exact Edinburgh behavior: top-of-right `profile_summary` only
  (single paragraph), without headline and without targeting/transition/applicability.

Files touched:

- `apps/web/src/lib/server/renderCvTemplate.ts`
- `CHANGELOG.md`
- `DEVELOPMENT_LOG.md`

Validation commands and results:

- `npm run check` -> pass
- `curl -sS "http://127.0.0.1:3001/api/preview/html?cvId=cv_en_001_alianz&templateId=edinburgh-v1&v=$(date +%s)" | rg "<main class=\"right\">|<section class=\"summary\">|Targeting|Transition Narrative|Role Applicability|Data analysis, coordination"` -> pass (summary present at top; removed sections absent)

## 2026-03-05 - Removed professional template and rebuilt Europass from real sample PDF

Context/root cause:

- Requested complete removal of `professional-v1`.
- Existing Europass implementation did not match actual Europass structure.
- Required reimplementation based on provided real file in `/examples`.

Files touched:

- `apps/web/src/lib/server/renderCvTemplate.ts`
- `apps/web/src/lib/server/cvCompatibility.ts`
- `apps/web/src/app/api/cvs/[cvId]/route.ts`
- `templates/catalog.yaml`
- `templates/europass-v1/template.yaml`
- `templates/europass-v1/layout.yaml`
- `templates/europass-v1/source/original.pdf`
- `templates/professional-v1/template.yaml` (deleted)
- `templates/professional-v1/layout.yaml` (deleted)
- `templates/professional-v1/license.yaml` (deleted)
- `data/template_mappings/cv_bg_001_alianz__professional-v1.yaml` (deleted)
- `data/template_mappings/cv_en_001_alianz__professional-v1.yaml` (deleted)
- `README.md`
- `docs/cv/INITIAL_TEMPLATING_BOOTSTRAP.md`
- `CHANGELOG.md`
- `DEVELOPMENT_LOG.md`
- `TODO.md`

Validation commands and results:

- `npm run check` -> pass
- `npm run build` -> pass
- `curl -sS http://127.0.0.1:3001/api/templates` -> pass (`professional-v1` removed; only `edinburgh-v1` and `europass-v1`)
- `curl -sS "http://127.0.0.1:3001/api/preview/html?cvId=cv_bg_001_alianz&templateId=europass-v1&v=$(date +%s)" | rg "Европейски формат на автобиография|Лична информация|Позициониране|Професионален опит|• Дати \\(от-до\\)|erow"` -> pass

## 2026-03-05 - Enriched BG seed CV from examples PDF

Context/root cause:

- Requested fuller data population of the BG seed CV from the provided
  `/examples/cv_bg_004_alianz.pdf` source.

Files touched:

- `data/cvs/cv_bg_001_alianz.yaml`
- `README.md`
- `CHANGELOG.md`
- `DEVELOPMENT_LOG.md`
- `TODO.md`

Validation commands and results:

- `node -e "const fs=require('fs');const y=require('yaml');const d=y.parse(fs.readFileSync('data/cvs/cv_bg_001_alianz.yaml','utf8')); console.log('YAML parse OK; exp=',d.experience.length);"` -> pass
- `npm run check` -> pass
- Direct `validateCvV1` node import attempt from TS source failed due local ESM path resolution in Node runtime, but lint/typecheck remained green.

Follow-up refinement:

- Added missing per-job extracted lines in `experience`:
  duration text and explicit role-context statements for Gameloft periods.
- Validation:
  - `node -e "const fs=require('fs');const y=require('yaml');const d=y.parse(fs.readFileSync('data/cvs/cv_bg_001_alianz.yaml','utf8')); console.log('exp entries', d.experience.length, 'durations', d.experience.map(e=>e.duration_text||'').filter(Boolean).length);"` -> pass

Additional renderer update:

- Edinburgh `experience` now renders `products` (when present) as square-bullet
  list directly below each job block.
- Product notes are split into a separate `product-note` subelement when
  product text contains a note marker (for example `, вкл.`).
- Validation:
  - `npm run check` -> pass
  - `curl -sS "http://127.0.0.1:3001/api/preview/html?cvId=cv_bg_001_alianz&templateId=edinburgh-v1&v=$(date +%s)" | rg "product-list|product-note|Order & Chaos Duels|Disney Speedstorm"` -> pass

Follow-up UI/layout pass:

- Added healthier right-column spacing in Edinburgh (`.right > section` margin/padding).
- Added consolidated `Competencies` section for Edinburgh containing:
  core strengths, social skills, other skills, and publications.
- Fixed template dropdown persistence logic in workspace data loading to avoid
  invalid/stale selected template state and keep Europass selectable.
- Validation:
  - `npm run check` -> pass
- `curl -sS "http://127.0.0.1:3001/api/preview/html?cvId=cv_bg_001_alianz&templateId=edinburgh-v1&v=$(date +%s)" | rg "right > section|Умения и компетенции|Други умения и компетенции"` -> pass
- `curl -sS http://127.0.0.1:3001/api/templates | jq -r '.items[].id'` -> pass (`edinburgh-v1`, `europass-v1`)

Template Gallery render mode update:

- Added image export endpoint `GET /api/export/image` for first-page PNG previews.
- Switched gallery cards from embedded PDF iframes to static image previews.
- Validation:
  - `npm run check` -> pass
  - `npm run build` -> pass
  - `curl -I -sS "http://127.0.0.1:3001/api/export/image?cvId=cv_bg_001_alianz&templateId=edinburgh-v1&v=$(date +%s)"` -> pass (`200`, `image/png`)
