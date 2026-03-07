# API Reference

This document summarizes the web API surface and highlights what was added/changed after `1.0.0`.

Base path: `/api`

## Since 1.0.0

## 1) Render + Export Overrides

- `GET /preview/html`
- `GET /export/pdf`
- `GET /export/image`

### Query params

- `cvId` (required)
- `templateId` (required)
- `theme` (optional; template theme id)
- `photo` (optional; `default|on-circle|on-square|on-original|off`)
- `photoId` (optional; approved Photo Booth image id in `/photos`)
- `download=1` (pdf only; force attachment)

### Notes

- These endpoints now support approved Photo Booth images without mutating CV YAML.

## 2) Photo Booth Storage API

- `GET /photos`
- `POST /photos` (`multipart/form-data`, key: `files`, supports multiple)
- `DELETE /photos?id=<photoId>`

### `GET /photos` response highlights

- `items[]` now includes:
  - `analysis` (latest)
  - `analysisHistory[]` (full stored history)
- Legacy uploads are auto-migrated into `/photos` during load.

## 3) Photo AI Analysis

- `POST /analysis/photo`

### Request body

```json
{
  "photoId": "optional-photo-file-id.jpg",
  "fileName": "optional-display-name.jpg",
  "imageDataUrl": "data:image/jpeg;base64,..."
}
```

### Response body (highlights)

```json
{
  "ok": true,
  "analysis": {
    "score": 84,
    "verdict": "good",
    "notes": ["..."],
    "clothingProposals": ["..."],
    "analyzedAt": "2026-03-07T12:00:00.000Z",
    "model": "openai/gpt-4o-mini"
  },
  "history": []
}
```

### Notes

- If `photoId` is provided, analysis is persisted to `/photos/metadata.json`.
- Individual analysis now includes clothing proposals (types + colors).

## 4) Multi-image AI Comparison

- `POST /analysis/photo/compare`

### Preferred request body (multi-image)

```json
{
  "images": [
    { "name": "img-1.jpg", "imageDataUrl": "data:image/jpeg;base64,..." },
    { "name": "img-2.jpg", "imageDataUrl": "data:image/jpeg;base64,..." },
    { "name": "img-3.jpg", "imageDataUrl": "data:image/jpeg;base64,..." }
  ]
}
```

Optional cache controls:

```json
{
  "imageIds": ["photo-id-1.jpg", "photo-id-2.jpg"],
  "lookupOnly": true,
  "forceNew": false
}
```

### Backward-compatible pair body (still accepted)

```json
{
  "leftName": "img-1.jpg",
  "leftImageDataUrl": "data:image/jpeg;base64,...",
  "rightName": "img-2.jpg",
  "rightImageDataUrl": "data:image/jpeg;base64,..."
}
```

### Response body (highlights)

```json
{
  "ok": true,
  "cached": false,
  "comparison": {
    "criteria": [
      { "name": "Lighting & sharpness", "summary": "..." }
    ],
    "ranked": [
      {
        "name": "img-2.jpg",
        "score": 91,
        "verdict": "excellent",
        "strengths": ["..."],
        "risks": ["..."],
        "improvements": ["..."]
      }
    ],
    "winnerName": "img-2.jpg",
    "recommendation": "...",
    "recommendationDetails": ["..."],
    "analyzedAt": "2026-03-07T12:00:00.000Z",
    "model": "openai/gpt-4o-mini"
  },
  "history": []
}
```

### Cache behavior

- Comparison results are persisted in `/photos/metadata.json` keyed by selected image id set.
- `lookupOnly: true` returns cached comparison (if available) without generating a new AI call.
- `forceNew: true` forces a new comparison and appends it to comparison history.

## 5) CV Variant + Language Operations

- `POST /cvs/variant`
  - creates/ensures a language variant from `sourceCvId`
  - supports `aiTranslate: true`
- `POST /cvs/sync/status`
  - returns available language siblings + `lastEditedAt` per language
- `POST /cvs/sync`
  - source-target sync using missing-field merge + AI translation of missing fragments

## 6) OpenRouter Settings + Credit

- `GET /settings/openrouter`
- `PUT /settings/openrouter`
  - saving API key writes local `.env` key `OPENROUTER_API_KEY`
- `GET /settings/openrouter/credit`
  - returns credit/prepaid status payload from OpenRouter

## 7) Keywords Data APIs

- `GET /analysis/keywords`
  - now returns role-aware weighted keywords and supplemental DB integration metadata
- `GET|POST /analysis/keywords/datasets`
  - core dataset lifecycle (`Core Database`)
- `GET|POST /analysis/keywords/manage`
  - management stats and collection-run lifecycle/progress

## 8) CV AI Analysis

- `POST /analysis/cv`

### Request body

```json
{
  "cvId": "cv_en_john_doe",
  "templateId": "cambridge-v1",
  "scope": "section",
  "sectionKey": "positioning"
}
```

### Notes

- Both section and full-CV analysis now consume `targeting.target_companies[]`
  when at least one valid company entry is present.
- If `targeting.target_companies[]` is missing or contains no valid company
  names, targeting is ignored and the analysis falls back to generic CV advice.

## Stability

- These APIs are internal app APIs used by the web UI.
- Shapes may evolve; keep client and server on same release tag.
