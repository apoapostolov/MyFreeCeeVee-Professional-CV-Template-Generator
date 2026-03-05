# CV Scoring Standard (Bootstrap)

This scoring system is imported from the `cv-ranking` skill and adapted as
an internal standard for MuhFweeCeeVee quality checks.

## Weighted Rubric (100 points)

- Timeline integrity and factual consistency: `25`
- Relevance to target role/company: `20`
- Evidence and quantified outcomes: `15`
- Clarity and structure for screening readability: `15`
- Credibility signals (naming, formatting, coherence): `10`
- Motivation narrative and transition logic: `10`
- Language quality and professionalism: `5`

## Interpretation

- `85-100`: strong, low-risk interview document
- `70-84`: viable with notable weaknesses
- `50-69`: risky, likely weak screening performance
- `0-49`: high risk, major rewrite required

## Severity classes

- `Critical`: trust-breaking issue (dates, contradictions, chronology mismatch)
- `Major`: strong candidacy weakness (poor targeting, missing outcomes)
- `Moderate`: quality weakness (verbosity, weak structure)
- `Minor`: polish issue

## Mandatory checks

1. Validate date math and durations.
2. Detect timeline overlaps and require explicit parallel-role flags.
3. Verify role/project chronology consistency.
4. Check job/sector targeting language.
5. Detect missing measurable outcomes.
6. Flag language issues reducing professional credibility.

## ATS and recruiter compatibility checks

- Prefer parser-safe structure and simple section hierarchy.
- Avoid decorative structure that harms text extraction.
- Align terminology with target role keywords.

## Output shape for future scoring endpoint

```yaml
score_total: 0
confidence: medium
category_scores:
  timeline_integrity: 0
  role_relevance: 0
  evidence_quantification: 0
  screening_clarity: 0
  credibility_signals: 0
  transition_narrative: 0
  language_professionalism: 0
findings:
  critical: []
  major: []
  moderate: []
  minor: []
recommended_fixes: []
```
