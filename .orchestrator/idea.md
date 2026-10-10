# Alltag: learn a language from the room you are in

Working name: **Alltag** (German for "everyday life"). Rename freely.

One line: point your phone at anything around you, and a native-sounding tutor
teaches you to talk about it, with it, and through it. No courses. No owl.

Hackathon: 2026-10-10, submit by 19:00. Team max 5. Min 2 partner technologies.
Grading: 50 % technical, 30 % wow and innovation, 20 % real problem.

---

## 1. The problem

Apps teach a language as a syllabus: unit 3, food, 20 words, tap the tiles.
The learner then stands in a Migros, or a Swiss train, or a Zurich café, and
cannot say anything, because none of it was about *their* life.

What research says works (and what Duolingo-style apps skip):

| Principle | Source | What it means for us |
|---|---|---|
| Comprehensible input, 90 to 98 % known words | Krashen, Nation | Tutor speaks at your level plus a little. Never a wall of unknowns. |
| Meaning-focused output | Nation's four strands (25 % input, 25 % output, 25 % fluency, 25 % form) | You *say* things to get something done, not to fill a blank. |
| Spaced repetition on recall, not recognition | Leitner, SM-2 | Review by producing the word out loud, scheduled by forgetting curve. |
| Correction after the turn, not mid-sentence | Fluency research, and what Langua and Praktika do | Tutor stays in character, corrections appear after. |
| Context-bound memory | Encoding specificity | A word learned on *your* fridge sticks better than on a cartoon fridge. |

Common criticism of Duolingo, collected from teachers and the SuperMemo wiki:
heavy translation instead of thinking in the language, gamification over
outcomes, almost no real-world transfer, spaced repetition weakened in 2018.
Our app is the opposite on every line.

## 2. What exists today (research, 2026-10-10)

### Camera and object apps
| App | Mechanic | Gap |
|---|---|---|
| Vocam | Point camera, get the noun in 40+ languages | Nouns only. No sentences, no conversation, no memory. |
| Vocabloot | Camera, noun, pronunciation, one example sentence | Flashcard with a camera. No dialogue. |
| LingoLens | Live labels on objects | Same. Label, not language. |
| WordCam | Labels every object in a photo in both languages, scene description | Closest on vision. No speaking, no roleplay, no SRS. |
| CapWords (Apple Design Award 2025) | Snap *text* (menus, signs), AI definitions, personal vocab | Text OCR, not objects. No speaking. |
| Wocap | Object recognition plus IPA pronunciation feedback | Pronunciation drill per word. No scenes, no conversation. |

### Conversation apps
| App | Mechanic | Gap |
|---|---|---|
| Speak | Curriculum first, AI roleplay embedded | Still a course. Scenarios are generic ("at a restaurant"). |
| Praktika | Animated avatar tutors, 1000+ scripted scenarios | No spaced repetition, no long-term vocab tracking. No camera. |
| Langua | Open conversation, corrections after each line | Best conversation engine. No camera, no grounding in your world. |
| Loora | Voice tutor for English | English only. |
| Duolingo Max | Video call with Lily, roleplay | Tied to course units. |
| Gemini Live | Raw model, no learning layer | No corrections, no memory, no pedagogy. |

### The gap, in one sentence
Camera apps give you nouns. Conversation apps give you generic scenes.
**Nobody combines "what the camera sees" with "a conversation you must get
through" with "a memory of what you got wrong".** That is Alltag.

## 3. Core loop

```
  1. LOOK      camera frame  ->  Gemini  ->  scene JSON
                                  { place: "kitchen", objects: [...], likely_tasks: [...] }
  2. LISTEN    tutor names 3 to 5 things, at your level, spoken by Gradium TTS
  3. DO        tutor becomes a person in that scene ("I'm your flatmate, ask me
               where the coffee is"). You talk. Gradium STT. Gemini replies.
  4. FIX       after the exchange: structured corrections, per error type
  5. KEEP      every fumble goes into the review queue, scheduled by SM-2,
               reviewed by *speaking*, triggered when the camera sees it again
```

Everything in the app is this loop. There are no lessons.

## 4. Features

### MVP (must demo at 19:00)
1. **Scene capture.** Photo or live frame to Gemini. Output: place, object list
   with target-language names, articles, plural, one useful phrase each,
   CEFR level tag. Shown as tappable labels over the image.
2. **Voice intro.** Tutor speaks the 3 to 5 most useful words for the scene,
   Gradium TTS, native voice for the target language.
3. **Scene roleplay.** Tutor takes a role that fits the scene and starts a
   task ("you want to buy this, ask me the price"). Push-to-talk, Gradium
   STT over WebSocket with semantic VAD so turns end naturally. Gemini keeps
   the dialogue state and the scene object list in context. Reply spoken.
4. **Post-turn corrections.** Separate Gemini call returns
   `[{said, better, type: article|gender|tense|word_order|vocab|pron, why}]`.
   Shown as a card after each exchange, never interrupting.
5. **Mistake queue.** Each correction becomes a card keyed on error type and
   word. SM-2 intervals in localStorage. Review screen: the card is shown as
   the *photo crop* of the object, you say the phrase, STT checks it.
6. **One target language.** German or French (Gradium covers EN/FR/DE/ES/PT).
   Pick French for the demo if the team speaks it, it sounds better in a video.

### Stretch (hour 5 and 6 only if MVP is stable)
7. **Barge-in.** Interrupt the tutor mid-sentence, TTS stops, VAD hands the
   turn back. Small, hard, very visible in the video.
8. **Scene memory.** Camera recognises a scene you have seen before and
   says "last time you forgot *die Gabel*, show me you remember".
9. **Level estimate.** Rolling CEFR estimate from your output, drives the
   tutor's vocabulary ceiling (the 95 % known rule).
10. **Voice design.** Gradium voice design: tutor sounds like a Zurich
    barista, not a newsreader. Thirty minutes of work, large charm payoff.
11. **Speech-to-speech translate mode.** Gradium S2S endpoint: you speak your
    language, hear the target language, as a crutch button when stuck.

### Out of scope, say so in the README
Accounts, multiple languages per user, streaks, leaderboards, phoneme scoring.

## 5. Why this is different from everything in section 2

- **Vision apps stop at the noun. We start there.** The noun is the entry
  point to a situation.
- **Conversation apps roleplay a generic café. We roleplay *your* café**, with
  the actual objects on the actual counter in the prompt.
- **Nobody in the conversation space has SRS** (Praktika explicitly has none).
  Ours is keyed on error type and triggered by the camera, which no one does.
- **Correction after the turn, structured, typed.** Langua does this well in
  text. We do it by voice with the scene as context.

## 6. Architecture

```
Browser (Vite + React + TS + Tailwind, PWA, mobile first)
 ├─ Camera        getUserMedia -> canvas -> JPEG -> /api/scene
 ├─ Mic           AudioWorklet -> 24 kHz PCM -> Gradium STT WebSocket (direct from browser)
 ├─ Speaker       Gradium TTS WebSocket -> AudioContext (streamed, low latency)
 ├─ Dialogue      state machine: idle -> listening -> thinking -> speaking -> correcting
 └─ SRS           SM-2 in localStorage, cards = {objectCrop, phrase, errorType, due}

Server (Vercel serverless, thin, holds the keys)
 ├─ /api/scene        Gemini vision -> scene JSON (structured output)
 ├─ /api/turn         Gemini chat   -> tutor reply (streamed text -> TTS)
 ├─ /api/correct      Gemini        -> corrections JSON
 └─ /api/gradium-key  short-lived token so the browser can open the WebSockets

Dev process
 └─ Entire CLI records every agent session behind every commit
    (transcripts, prompts, tool calls) -> jury can audit how the thing was built
```

Two-call design for the tutor is deliberate: one call stays in character and
fast, the other grades. Document this, it is the kind of decision the
technical 50 % rewards.

### Latency budget (measure in hour 1, put the real numbers in the README)
| Hop | Target |
|---|---|
| STT end of turn (semantic VAD, `delay_in_frames` 10) | < 400 ms after you stop |
| Gemini first token | < 600 ms |
| TTS first audio chunk | < 300 ms |
| **Perceived turn** | **< 1.5 s** |

If the perceived turn is over 3 s the roleplay dies. Fallbacks: shorter tutor
replies, stream text to TTS sentence by sentence, show a "listening" pulse.

## 7. Partner technology use (need min 2, we use 3)

| Partner | Where | Why it is not decorative |
|---|---|---|
| **Gradium** | STT WebSocket with semantic VAD for turn-taking. TTS WebSocket streamed. Voice design for the tutor persona. Optional S2S translate button. | The whole product is a voice loop. Gradium's VAD and streaming are what make it feel like a conversation. |
| **Google DeepMind (Gemini)** | Vision scene parsing with structured output. Dialogue. Corrections. Level estimate. | Image plus language plus JSON in one model. Gemini Live is an alternative for the whole loop but we lose the correction layer, so we keep Gradium for audio. |
| **Entire** | `entire` CLI enabled on the repo from commit one. Every agent-assisted commit carries its session. | The submission demands "enough technical docs for thorough jury evaluation". Entire makes the build itself auditable. Link the checkpoint branch in the README. |

## 8. Learning design details

**Level control.** The scene JSON tags each object A1 to B2. The tutor prompt
gets `known_words` (from the SRS store) and a ceiling, and is told: 95 % of
your words must be in `known_words` or A1, introduce at most 2 new items per
turn. This is Nation's coverage rule, operationalised.

**Correction taxonomy.** `article, gender, case, tense, word_order, vocab,
register, pronunciation(transcript-level)`. The queue groups by type, so the
review screen can say "you keep dropping the article on feminine nouns" rather
than "here are 30 random cards".

**Review by production.** A card is the photo crop plus the task ("ask for
this"). You speak. STT transcript compared to the target by Gemini with a
lenient rubric. SM-2 grade 0 to 5 derived from that.

**Camera-triggered recall.** When a new scene contains an object with a due
card, the tutor opens with it. This is the feature to show at the end of the
video: walk back to the first object, the tutor remembers.

**No streaks, no XP.** Progress is a list of real sentences you can now say,
each with the photo where you learned it. That is the "wow" for a
non-technical judge: a photo diary of your language.

## 9. Eight-hour plan

| Hour | Owner | Deliverable | Kill criterion |
|---|---|---|---|
| 1 | Voice | Gradium STT and TTS round trip in the browser, latency table | If > 3 s per turn, switch to turn-based with HTTP POST endpoints |
| 1 | Vision | `/api/scene` returning scene JSON from a photo, labels drawn on image | |
| 1 | Infra | Vite scaffold, Vercel project, Entire enabled, README skeleton | |
| 2 to 3 | Voice + Dialogue | Roleplay loop with one scene, text transcript visible, spoken reply | |
| 3 | Vision | Scene JSON feeds the tutor prompt. Level tags. | |
| 4 | Dialogue | `/api/correct`, correction cards after each turn | |
| 5 | SRS | Mistake queue, review screen with photo crops, SM-2 | Drop first if behind |
| 6 | All | Barge-in, voice design persona, UI polish, one language only | Drop barge-in if behind |
| 7 | Docs | README: setup, env vars, architecture diagram, API table, latency table, Entire link, what we did not build | Non-negotiable |
| 8 | Demo | Loom 2 min, submit by 18:30 | Non-negotiable |

Never drop the camera. It is the differentiator.

## 10. Demo script (2 minutes)

0:00 Phone camera on a real object at the venue, a coffee machine. Tap.
0:10 Labels appear in French. Tutor voice: "Voilà une machine à café. On dit
     *la* machine."
0:20 "Je suis le barista. Qu'est-ce que vous voulez ?" You answer, badly.
0:40 Tutor replies in character, you get through it.
0:55 Correction card slides up: "you said *le machine*, it's *la machine*,
     feminine. Type: gender."
1:10 Cut to review screen: the photo of the machine, "say it". You say it
     right. Card scheduled for tomorrow.
1:25 Walk to a different object, new scene, new roleplay, 15 seconds.
1:40 Back to the coffee machine. Tutor: "On a vu ça. C'est *la* ou *le*
     machine ?" You answer. Camera-triggered recall.
1:50 Architecture slide, one frame. Three partners named. Done.

## 11. README outline (half the grade reads this)

1. What it is, one paragraph, the loop diagram
2. Why: the research table from section 1, the competitor gap from section 2
3. Setup: `pnpm i`, env vars (`GEMINI_API_KEY`, `GRADIUM_API_KEY`), `pnpm dev`,
   `vercel deploy`
4. Architecture diagram and the two-call tutor design, with reasons
5. API table: every endpoint, request, response schema
6. Partner tech: exactly how each is used, with file paths
7. Latency measurements, real numbers from the venue wifi
8. Learning design: level control, correction taxonomy, SRS, recall trigger
9. Entire: link to the checkpoints branch, how to browse the build sessions
10. What we did not build and why
11. Team, licence

## 12. Risks

| Risk | Mitigation |
|---|---|
| Gradium browser WebSocket auth exposes the key | Short-lived token from a serverless route, or proxy the socket through Vercel. Decide in hour 1. |
| Turn latency kills the feel | Measure first. Stream TTS by sentence. Shorter replies. Visible listening state. |
| Gemini vision mislabels objects | Show labels as tappable, let the user correct, the correction itself becomes a learning moment. |
| Venue wifi | Pre-record a backup video clip of each step. Test on 4G. |
| Scope creep | The MVP list in section 4 is the contract. Stretch only after hour 5 checkpoint. |
| "Another language app" from the jury | Lead the video with the camera on a real object. Say "no courses" in the first sentence. |

## 13. Team split (5 people)

- **Voice**: Gradium STT/TTS, audio worklet, barge-in, voice design
- **Vision + prompts**: scene JSON, tutor prompt, correction prompt, level control
- **Frontend**: camera UI, labels overlay, dialogue state machine, review screen
- **Backend + infra**: Vercel routes, token issuing, Entire, deploy
- **Docs + demo**: README from hour 1, architecture diagram, latency table, Loom

If 3 people: merge Voice with Frontend, Vision with Backend, Docs floats.

## Sources

- Gradium docs: https://docs.gradium.ai/ (STT WebSocket guide, API index at /llms.txt)
- Entire: https://docs.entire.io/ and https://github.com/entireio/cli
- Gemini Live API overview: https://skillselion.com/skills/google-gemini/gemini-skills/gemini-live-api-dev
- Vocam: https://vocam.app/ · Vocabloot: https://play.google.com/store/apps/details?id=com.tntstudios.snaplingo
- LingoLens: https://apps.apple.com/us/app/lingolens-learn-languages/id6502578008 · WordCam: https://wordcam.net/
- CapWords: https://apps.apple.com/us/app/capwords-ai-language-tutor/id6738896465 · Wocap: https://peerpush.com/p/wocap
- Praktika review (no SRS): https://languatalk.com/blog/praktika-review/
- AI tutor comparison: https://www.upskillist.com/blog/best-ai-language-learning-apps/ and https://www.lingualive.ai/blog/best-ai-language-tutor-2026
- Duolingo criticism: https://spanismakessense.substack.com/p/the-biggest-problem-ive-noticed-with and https://supermemo.guru/wiki/Duolingo
- Learning science: https://gianfrancoconti.com/2025/02/ (Nation, Krashen coverage figures)
