# Companies API Integration Matrix (Epics 2, 3, 4)

Date: 2026-03-08

## Purpose

This document maps external data integrations to MuhFweeCeeVee's planned backend endpoints for:

- Epic 2: Company evaluation
- Epic 3: CV suitability scoring and per-job disposable CV copies
- Epic 4: Position-specific cover letter drafts

## Decision Matrix

| Provider/API                | Epic Fit | Cost/Access            | Legal Risk | Decision  | Notes                                                        |
| --------------------------- | -------- | ---------------------- | ---------- | --------- | ------------------------------------------------------------ |
| Greenhouse Job Board API    | 3, 4     | Free public read       | Low        | Must-have | Reliable source for live job posting text/metadata.          |
| Lever Postings API          | 3, 4     | Free public read       | Low        | Must-have | Complements Greenhouse for job-description coverage.         |
| O\*NET Web Services         | 3        | Free with registration | Low        | Must-have | Canonical occupation/skills normalization for scoring.       |
| Lightcast Skills/Titles API | 3        | Free tier available    | Low        | Must-have | Useful for modern title/skill taxonomy expansion.            |
| GDELT                       | 2        | Free/open              | Low        | Must-have | News/event trend signal for company/industry health context. |

## Obtaining API Keys

Some integrations require API keys or registration:

- **Lightcast Skills/Titles API** – sign up at <https://lightcast.io/open-skills/access>. Registration requires a company email address; generic providers such as Gmail or ProtonMail are not accepted.
- **O\*NET Web Services** – request a free API key by registering on the O\*NET website.
- **Greenhouse & Lever** – public read access typically does not require an API key but consult each provider's developer docs for rate limits.

(Other providers in the matrix may not need keys or have explicit instructions in their documentation.)
| World Bank Indicators API | 2 | Free/open | Low | Nice-to-have | Macroeconomic context for industry trend overlays. |
| FRED API | 2 | Free key | Low | Nice-to-have | US labor/sector indicators for health scoring. |
| BLS API | 2, 3 | Free key | Low | Nice-to-have | Industry/job-family labor trend signals. |
| SEC EDGAR APIs | 2 | Free/open | Low | Nice-to-have | Public-company filing signals and risk context. |
| OpenCorporates API | 2 | Free/open tiers | Low | Nice-to-have | Company identity/registry enrichment. |
| Trustpilot Data Solutions API | 2 | Commercial access varies | Medium | Nice-to-have | Structured review sentiment when legally licensed. |
| Glassdoor APIs | 2 | Partner-gated | Medium-High | Blocked/Legal-risk | No free/self-serve general API path for this use case. |
| LinkedIn APIs | 2, 3 | Restricted scopes/programs | Medium-High | Blocked/Legal-risk | Limited approved products; not a free public company/job data feed. |
| NewsAPI (free tier) | 2 | Dev/non-commercial limits | Medium | Nice-to-have | Accept only if usage/license model fits deployment. |
| GNews (free tier) | 2 | Dev/non-commercial limits | Medium | Nice-to-have | Same licensing caution as NewsAPI. |

## API Keys Needed Before Implementation

### Minimum keys for MVP delivery

You can start implementation with **2 required keys**:

- `LIGHTCAST_API_KEY` (or equivalent credentials for Lightcast free APIs)
- `FRED_API_KEY` (if you want baseline macro trend context in scoring/evaluation)

And **0-key connectors** that can run immediately:

- Greenhouse Job Board API (public)
- Lever Postings API (public)
- O\*NET Web Services (registration-based, may require account credentials depending on setup)
- GDELT (open)
- World Bank Indicators (open)
- SEC EDGAR APIs (open)

### Recommended keys for full v1.1-quality enrichment

Prepare **up to 6 keys/credentials** if you enable optional enrichments:

- `LIGHTCAST_API_KEY` (recommended)
- `FRED_API_KEY` (recommended)
- `BLS_API_KEY` (optional but useful)
- `NEWSAPI_KEY` (optional, check commercial/license fit)
- `GNEWS_API_KEY` (optional, check commercial/license fit)
- `TRUSTPILOT_API_KEY` or partner credentials (optional/commercial)

### Not expected for this roadmap

Do **not** plan implementation around these credentials:

- Glassdoor partner credentials (blocked/legal-risk for current scope)
- LinkedIn restricted partner programs (blocked/legal-risk for current scope)

## Minor On-Demand Scraping Policy (Fallback Only)

Scraping is fallback-only when an official API is not available and must follow all rules below:

- User-provided URL only (no broad crawling).
- Respect `robots.txt` and target-site terms.
- No login-gated pages or anti-bot bypass behavior.
- Explicitly deny scraping for LinkedIn and Glassdoor.
- Hard rate limit and short retention (default: 7 days).
- Persist source URL, retrieval timestamp, and extraction method for auditability.

## Endpoint Mapping

### Epic 2: Company Evaluation (Companies tab)

- `POST /api/companies/evaluate`
  - Inputs:
    - `companyName`, optional `companyDomain`
    - `jobId` (optional link)
    - `cvId`
  - Upstream sources:
    - Must-have: GDELT
    - Nice-to-have: OpenCorporates, SEC, BLS, FRED, World Bank, Trustpilot (licensed)
  - Output:
    - `companySummary`
    - `workplaceSimilarity` (vs CV history)
    - `industrySwitchAssessment`
    - `industryHealth`
    - `fantasyOpinion` (explicitly labeled synthetic narrative)
    - `evidence[]` with `source`, `url`, `capturedAt`, `freshness`

### Epic 3: Suitability + Application Copy Lifecycle (Companies tab)

- `POST /api/jobs`
  - Create/store posting from URL + pasted JD text.
- `POST /api/jobs/:id/suitability`
  - Inputs: `cvId`, `jobId`
  - Upstream sources:
    - Must-have: Greenhouse/Lever posting payload, O\*NET, Lightcast
    - Nice-to-have: BLS/FRED trend overlays
  - Output:
    - `overallScore`
    - weighted dimension scores (`keywords`, `experience`, `seniority`, `industryFit`)
    - `tweakSuggestions[]`
- `POST /api/jobs/:id/application-copy`
  - Create disposable CV copy linked to job posting.
- `DELETE /api/jobs/:id/application-copy`
  - Manual cleanup without touching canonical CV.
- `POST /api/retention/run`
  - Auto-delete expired application copies.

### Epic 4: Cover Letters (Cover Letters tab)

- `POST /api/cover-letters/generate`
  - Inputs: `jobId`, `cvId`, optional tone (`formal`, `direct`, `concise`)
  - Uses outputs from Epics 2 and 3 as context.
  - Output: draft variants + structured rationale.
- `PUT /api/cover-letters/:id`
  - Save edited draft.
- `GET /api/jobs/:id`
  - Hydrate all job-linked artifacts including cover letter drafts and disposable CV copy status.

## Recommended Implementation Order

1. Must-have API connectors: Greenhouse, Lever, O\*NET, Lightcast, GDELT.
2. Epic 2 baseline evaluator + evidence metadata output.
3. Epic 3 scoring + disposable CV copy lifecycle.
4. Epic 4 generation/edit flow in `Cover Letters` tab.
5. Optional enrichment connectors (OpenCorporates, BLS/FRED/World Bank, SEC, Trustpilot).
