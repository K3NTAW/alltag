# API

All routes live in `api/` and run as Vercel Node functions. Request and response types are in `src/lib/types.ts` (`CheckRequest`/`CheckResponse` in `src/lib/api.ts`). Errors are always `{ "error": "<code>" }`.

Common codes:

| Status | Code | When |
|---|---|---|
| 405 | `method_not_allowed` | Wrong HTTP method |
| 500 | `missing_key` | `GEMINI_API_KEY` or `GRADIUM_API_KEY` not set |
| 502 | see per route | Upstream call failed or returned unusable output |

## GET /api/health

Response 200:

```json
{ "ok": true }
```

No error cases.

## POST /api/scene

Gemini vision. Model: `GEMINI_MODEL_VISION`, then `GEMINI_MODEL`, default `gemini-3.8-flash`. A `data:image/jpeg;base64,` prefix on the image is stripped.

Request:

```json
{ "imageBase64": "data:image/jpeg;base64,/9j/4AAQ...", "level": "A1", "knownWords": ["la tasse"] }
```

Response 200 (`SceneResult`, 1 to 6 objects, `bbox` optional as 0..1 fractions `[x, y, w, h]`):

```json
{
  "place": "kitchen",
  "objects": [
    {
      "id": "cup-1", "fr": "tasse", "en": "cup", "article": "la", "gender": "f",
      "plural": "tasses", "level": "A1",
      "phrase_fr": "Je voudrais une tasse de café.", "phrase_en": "I would like a cup of coffee.",
      "bbox": [0.42, 0.55, 0.12, 0.15]
    }
  ],
  "task": { "fr": "Demande un café à Noé.", "en": "Ask Noé for a coffee.", "role": "barista" }
}
```

Errors: 400 `imageBase64 required`, 400 `level must be A1..B2`, 405, 500 `missing_key`, 502 `upstream_error` (Gemini threw), 502 `bad_scene` (output failed validation).

## POST /api/turn

Text roleplay, used when Gemini Live fails. Model: `GEMINI_MODEL_TURN`, then `GEMINI_MODEL`, default `gemini-3.8-flash`.

Request:

```json
{
  "scene": { "place": "kitchen", "objects": [], "task": { "fr": "...", "en": "...", "role": "barista" } },
  "history": [ { "role": "tutor", "text": "Bonjour ! Qu'est-ce que je vous sers ?" } ],
  "userText": "Un café, s'il vous plaît.",
  "level": "A1"
}
```

Response 200:

```json
{ "reply_fr": "Avec plaisir. Sur place ?", "reply_en": "With pleasure. For here?", "task_done": false }
```

Errors: 400 `missing scene, history, userText or level`, 405, 500 `missing_key`, 502 `generation_failed`, 502 `bad_output`.

## POST /api/correct

Grader, one call per learner line after the exchange. Model: `GEMINI_MODEL_GRADER`, then `GEMINI_MODEL`, default `gemini-3.1-pro-preview`. If the primary call takes over 8 s or throws, it is aborted and retried once on `gemini-3.8-flash`; `model_used` says which answered. Corrections with an unknown `type` are dropped.

Request:

```json
{ "scene": { "place": "kitchen", "objects": [], "task": { "fr": "...", "en": "...", "role": "barista" } }, "userText": "Je veux un café", "level": "A1" }
```

Response 200 (`type` is one of `article, gender, case, tense, word_order, vocab, register`):

```json
{
  "corrections": [
    { "said": "Je veux", "better": "Je voudrais", "type": "register", "why_en": "Use the conditional to order politely." }
  ],
  "kept_phrase_fr": "Je voudrais un café, s'il vous plaît.",
  "model_used": "gemini-3.1-pro-preview"
}
```

Errors: 400 `missing scene, userText or level`, 405, 500 `missing_key`, 502 `generation_failed` (fallback also failed), 502 `bad_output`.

## POST /api/check

Review grade for a spoken card. Model: `GEMINI_MODEL_CHECK`, then `GEMINI_MODEL`, default `gemini-3.5-flash-lite`. The Review screen falls back to a local similarity grade if this fails.

Request:

```json
{ "target_fr": "Je voudrais une tasse de café.", "transcript": "je voudrais une tasse de café", "level": "A1" }
```

Response 200 (`grade` is an integer 0..5, the SM-2 quality):

```json
{ "grade": 5, "correct": true, "note_en": "Perfect." }
```

Errors: 400 `missing target_fr, transcript or level`, 405, 500 `missing_key`, 502 `generation_failed`, 502 `bad_output`.

## GET or POST /api/gradium-token

Exchanges `GRADIUM_API_KEY` for a short-lived Gradium token. No request body. Sends `Cache-Control: no-store`. Rejects cross-site callers (`Sec-Fetch-Site` other than `same-origin`/`none`, or an `Origin` whose host differs from the request host).

Response 200 (`GradiumToken`):

```json
{ "token": "gr_tmp_...", "expires_at": "2026-10-10T14:05:00Z" }
```

Errors: 403 `forbidden`, 405 (with `Allow: GET, POST`), 500 `missing_key`, 502 `token_failed` (upstream non-2xx, malformed body or network error).

## POST /api/live-token

Mints a single-use Gemini Live ephemeral token constrained to `GEMINI_MODEL_LIVE` (default `gemini-3.8-live`): 30 min expiry, 60 s to open a session. No request body. Same `Cache-Control` and same-origin guard as `/api/gradium-token`.

Response 200:

```json
{ "token": "auth_tokens/abc123", "expires_at": "2026-10-10T14:30:00.000Z", "model": "gemini-3.8-live" }
```

Errors: 403 `forbidden`, 405 (with `Allow: POST`), 500 `missing_key`, 502 `token_failed` (create threw, returned no name, or the name contained the key).
