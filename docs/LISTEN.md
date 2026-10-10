# Listen mode

Hear a real conversation around you, see it live in French and English, keep what you want to learn.

## How it works

1. **Idle.** The listen tab shows a consent card and a "start listening" control. Languages are fixed to fr -> en for now.
2. **Live.** The phone streams mic audio (16 kHz PCM16, 100 ms chunks, same capture as roleplay) to Gemini Live in text mode (`src/voice/live.ts`, `mode: "listen"`).
   - `inputAudioTranscription` gives the French as `userText` events.
   - The model answers each utterance with only its English translation as text parts (`serverContent.modelTurn.parts[].text`), emitted as `tutorText`, final on `turnComplete`.
   - No tools, no speech config, no playback.
   - `src/listen/pairs.ts` turns the event stream into pairs `{id, fr, en, final, kept}`: French opens a pair, the translation closes it.
   - Each pair has a bookmark. "pause" closes the session and keeps the lines, "resume" opens a new one.
3. **Learn.** "stop and learn" closes the session and sends the final pairs once to `/api/extract` with the level from settings and the phrases already in the review store as known words. The result is split into "worth keeping" (pre-checked when bookmarked), "you already know" and "too advanced for now". Keeping adds cards to the review store (`errorType: "phrase"`) and saves the transcript to the diary. If extract fails, only the bookmarked lines are offered.

## Consent model

- Only listen where people know. The screen says so before the first start.
- Audio is never stored. It streams to Gemini Live (or Gradium in the fallback) and is dropped.
- The transcript stays on the phone in localStorage under `alltag.conversations` (`src/srs/conversations.ts`).
- The learn step sends the transcript text once to Gemini. Nothing else leaves the phone.

## Routes

| Route | Request | Response | Model env (default) |
|---|---|---|---|
| `POST /api/translate` | `{text, from: "fr", to: "en"}` | `{text}` | `GEMINI_MODEL_TRANSLATE` (gemini-3.5-flash-lite) |
| `POST /api/extract` | `{lines: [{fr, en}], level, knownWords}` | `{keep: [{fr, en, why, type, noun_fr?}], known, advanced: [{fr, en}]}` | `GEMINI_MODEL_EXTRACT` (gemini-3.8-flash) |

`translate` answers 400 on empty text. `extract` answers 400 on missing lines or level; it keeps at most 6 items at or one step above the level, prefers lines heard twice and drops known words. The client calls live in `src/lib/api-listen.ts`.

The Live token comes from `/api/live-token` unchanged (`gemini-3.8-live`).

## Fallback

When the Live token or connect fails, the screen shows "live translation unavailable, using fallback" and switches to:

- Gradium STT (`src/voice/stt.ts`, language fr) for the French. The socket stays open across turns; each final segment becomes a pair.
- `POST /api/translate` once per final segment fills in the English.
