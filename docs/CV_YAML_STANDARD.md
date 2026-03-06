# CV YAML Standard (Imported Baseline)

This project uses a normalized YAML format for CV data inspired by the
existing standard from `git/lifestyle/job_cv/cv_versions/cv_yaml_standard.md`.

## Purpose

- Keep one canonical machine-readable source of CV facts.
- Support multiple rendering targets (`PDF`, `Europass`, `ATS-optimized`, role variants).
- Preserve chronology, evidence, and targeting metadata without loss.

## Top-Level Structure

```yaml
schema:
person:
positioning:
targeting:
experience:
education:
skills:
references:
compliance:
optional_sections:
metadata:
```

## Required Sections (Minimum for rendering)

- `schema.id`
- `schema.version`
- `person.full_name`
- `experience[]` (can be empty for draft state)
- `skills` (at least one of `technical`, `languages`, `core_strengths`)
- `metadata.created_at`
- `metadata.updated_at`
- `metadata.language` (`bg` or `en`)

## Validation Rules

- Dates are ISO: `YYYY-MM-DD`.
- `experience.start_date <= experience.end_date` when `end_date` exists.
- Overlapping roles require explicit `parallel_role: true`.
- Unknown fields are allowed for forward compatibility.
- Experience publication links are supported as:
  `experience[].publication_links[]` with object shape:
  - `url` (required for rendering link)
  - `title` (optional; auto-derived from URL when omitted)
  - any number of links per experience item

## Naming Convention

- CV files: `data/cvs/cv_<language>_<iteration>_<target>.yaml`
- Supported languages: `bg`, `en`
- Iteration format: 4 digits (`0001`, `0002`, ...)
- Example: `data/cvs/cv_en_0001_john_doe.yaml`

## Seed Example in this repo

- `data/cvs/cv_en_0001_john_doe.yaml`

## Notes for parser and renderer

- Renderer should treat missing optional sections as empty.
- Template engine must map via explicit mapping files, never by implicit key guessing.
- Sanitization should preserve UTF-8 Bulgarian text.
