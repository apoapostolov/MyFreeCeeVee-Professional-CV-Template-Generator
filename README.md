# MyFreeCeeVee

MyFreeCeeVee is a self-hosted CV authoring and export platform with:
- template-based rendering (`europass-v1`, `edinburgh-v1`)
- form + YAML editor workflows
- AI scoring and keyword analysis surfaces
- PDF export pipeline for print-ready output

## 1.0 Release Scope

Version `1.0.0` is the first public release with a stable user-facing workflow:
- Print Room (preview + export)
- Editor (Form/YAML)
- Keywords workspace (gap analysis and prioritization)
- Theme support (light/dark/system + template themes)
- Public fictional sample profile (`John Doe`)

## Repository Layout

- `apps/web/`: Next.js web application
- `services/parser/`: FastAPI parser service scaffold
- `packages/schemas/`: shared schema/constants
- `packages/render-core/`: shared rendering primitives
- `data/`: sample CV and template mapping data
- `templates/`: template definitions and assets
- `deploy/systemd/`, `deploy/nginx/`: Linux deployment references

## Prerequisites

- Node.js `>= 22`
- npm `>= 10`
- Python `3.12.x` (for parser service)

## Quick Start (Local)

```bash
npm run bootstrap
npm run dev
```

Optional parser service (second terminal):

```bash
npm run dev:parser
```

Quality checks:

```bash
npm run lint
npm run typecheck
```

## Production Build

```bash
npm run bootstrap
npm run build
npm run start
```

Default web runtime port is `3000` unless overridden by environment.

## Hosting Guide

### Windows 11

Recommended stack:
- app process: Node.js (`npm run build && npm run start`)
- optional parser process: Python `uvicorn`
- reverse proxy / TLS: Caddy (recommended) or IIS reverse proxy

Steps:
1. Install Node.js 22+ and Python 3.12.
2. Clone repo and run `npm run bootstrap`.
3. Build web: `npm run build`.
4. Run web as background service using NSSM or Windows Task Scheduler:
   - program: `npm`
   - args: `run start`
   - working dir: repo root
5. (Optional) run parser service with its own NSSM entry:
   - `cd services/parser`
   - `python -m venv .venv`
   - `.venv\Scripts\pip install -r requirements.txt`
   - `.venv\Scripts\uvicorn main:app --host 127.0.0.1 --port 8001`
6. Configure Caddy/IIS to proxy HTTPS traffic to `127.0.0.1:3000`.

### Linux (Ubuntu/Debian/RHEL)

Recommended stack:
- app process: systemd service for Next.js
- optional parser process: systemd service for FastAPI
- reverse proxy / TLS: nginx or Caddy

Steps:
1. Install Node.js 22+, npm 10+, Python 3.12.
2. Clone repo and run `npm run bootstrap`.
3. Build web: `npm run build`.
4. Create systemd unit for web process (`npm run start`).
5. (Optional) create parser venv and systemd unit for uvicorn on `127.0.0.1:8001`.
6. Configure nginx/Caddy reverse proxy and HTTPS certs.
7. Enable auto-start:
   - `sudo systemctl enable --now <web-service>`
   - `sudo systemctl enable --now <parser-service>` (if used)

### macOS

Recommended stack:
- app process: Node.js (`npm run build && npm run start`)
- optional parser process: Python `uvicorn`
- service manager: `launchd` (LaunchAgent/LaunchDaemon)
- reverse proxy / TLS: Caddy or nginx

Steps:
1. Install Node.js 22+ and Python 3.12 (Homebrew recommended).
2. Clone repo and run `npm run bootstrap`.
3. Build web: `npm run build`.
4. Create `launchd` plist for `npm run start` in repo root.
5. (Optional) create parser `launchd` plist for uvicorn on `127.0.0.1:8001`.
6. Configure Caddy/nginx to expose HTTPS and proxy to `127.0.0.1:3000`.

## Runtime Data and Privacy

- Public repo includes only fictional sample CV data.
- Personal/local CV history and planning artifacts are intentionally untracked.
- Keep real CV content in local/private files outside version control.

## Release and Changelog

- Changelog is the source of truth for release notes:
  - [`CHANGELOG.md`](CHANGELOG.md)

## License

Repository-level licensing should be set according to your distribution policy.
Template-specific license metadata lives under each template folder.
