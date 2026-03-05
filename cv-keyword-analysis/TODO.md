# TODO

## P0 - Core analysis engine

- [ ] Define analysis input schema (CV text + JD corpus + config).
- [ ] Define output schema (weighted keywords, coverage score, actions).
- [x] Implement baseline JD crawling + relevance extraction pipeline.
- [x] Implement resume-safe cache (URL + content hash dedupe, incremental persistence).
- [ ] Implement normalization pipeline (lowercase, lemmatize, dedupe).

## P1 - Weighting and scoring quality

- [ ] Implement TF-IDF weighting over JD corpus.
- [ ] Implement section-aware weighting for CV fields.
- [ ] Implement evidence multiplier for quantified achievements.
- [ ] Add scoring confidence and gap severity.

## P2 - Tooling and integration

- [x] Add CLI command for local JD analysis runs.
- [x] Add JSON output report for scrape results.
- [x] Add optional Firecrawl provider backend for higher-quality JD discovery.
- [x] Expand native role-query seed generation for non-Firecrawl crawling.
- [ ] Add markdown summary report output.
- [ ] Create test fixtures and regression checks.
- [ ] Prepare integration hooks for main app Editor panel.
