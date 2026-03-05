# AGENTS.md - MuhFweeCeeVee Operating Rules

## Runtime and Stack Baseline

- Use `Node.js >= 22` and `npm >= 10` for workspace commands.
- Use system Python `3.12.x` for parser service (`/usr/bin/python3`).
- Do not use Python 3.14 for parser dependencies;
  `pydantic-core` build is incompatible in this environment.

## Repository Layout (Authoritative)

- `apps/web/`: Next.js web app (App Router, TypeScript, Tailwind).
- `services/parser/`: FastAPI parser for PDF decomposition and template drafting.
- `packages/schemas/`: shared schema/version constants.
- `packages/render-core/`: shared rendering primitives for PDF export.
- `deploy/systemd/`: service units.
- `deploy/nginx/`: reverse-proxy config.
- `data/`, `templates/`, `exports/`, `logs/`: runtime data and artifacts.

## Git Workflow Rules (Mandatory)

1. Use short-lived feature branches from `master` (or default branch).
2. Keep commits atomic and message format explicit:
   - `feat: ...`
   - `fix: ...`
   - `chore: ...`
   - `docs: ...`
   - `refactor: ...`
3. Never mix unrelated changes in one commit.
4. Before commit, run minimal checks relevant to changed areas.
5. Never force-push shared branches unless explicitly approved.

## Changelog Rules (Mandatory)

- Keep a root `CHANGELOG.md` using Keep a Changelog format.
- Record user-visible behavior changes under `## [Unreleased]`.
- Add entries under one of:
  - `### Added`
  - `### Changed`
  - `### Fixed`
  - `### Removed`
- Move `Unreleased` entries into a versioned section only during release tagging.

## Development Log Rules (Mandatory)

- Keep a root `DEVELOPMENT_LOG.md` as the engineering journal.
- For every code/behavior/docs change, append one dated entry:
  - `## YYYY-MM-DD - Short title`
  - Context/root cause
  - Files touched
  - Validation commands and results
- Prefer concise factual notes over narrative prose.

## TODO Management Rules (Mandatory)

- `TODO.md` is execution-oriented only:
  - actionable checkbox items (`- [ ]` / `- [x]`)
  - grouped by priority (P0, P1, P2)
- No long design specs in `TODO.md`; keep specs in dedicated docs.
- When all tasks in a section are done, remove or archive that section.
- Update `TODO.md` in the same change set when scope/status shifts.

## Documentation Sync Rules (Mandatory)

When changing behavior or dependencies, update all relevant docs in same turn:

1. `README.md` (run instructions/stack/deps)
2. `CHANGELOG.md` (user-visible delta)
3. `DEVELOPMENT_LOG.md` (what changed + validation)
4. `TODO.md` (task state)

## Startup and Validation Procedure (Default)

### Web

1. `npm install`
2. `npm run lint`
3. `npm run typecheck`
4. `npm run dev`

### Parser

1. `cd services/parser`
2. `/usr/bin/python3 -m venv .venv`
3. `.venv/bin/pip install -r requirements.txt`
4. `.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8001`
5. Verify with `curl http://127.0.0.1:8001/health`

## PDF and Template Safety Rules

- Keep original imported templates immutable under
  `templates/<id>/source/original.pdf`.
- Never remove source template artifacts without explicit request.
- Always store license metadata in `templates/<id>/license.yaml`
  before approving for curated use.

## Code Comment Standards

- Do not reference TODO priority labels (`P0`, `P1`, etc.) in source code comments.
- Comments must explain technical intent, not project-management state.

## Definition of Done (Per Change)

A task is complete only when all are true:

1. Relevant checks pass.
2. `CHANGELOG.md` updated (if user-visible).
3. `DEVELOPMENT_LOG.md` updated.
4. `TODO.md` updated.
5. No secrets or credentials introduced.
