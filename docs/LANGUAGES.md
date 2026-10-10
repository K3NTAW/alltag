# Languages

What alltag teaches today, what the stack underneath could carry, and what adding a language takes. Researched 2026-10-10 from the Gradium docs, the Gemini Live guide and the Gemma 4 model card.

## Today

The app teaches French only. The target language is fixed in settings and in the prompts (Noé, review, Listen, the offline prompts); there is no picker.

## What the stack supports

Three tiers, from the full experience down to offline text.

### A. Full experience with Gradium voice

English (`en`), French (`fr`), German (`de`), Spanish (`es`), Portuguese (`pt`), plus the Swiss French (`fr-ch`) and Swiss German accents of the Gradium voice library.

Gradium voice persona, Gradium STT for review, `/api/translate` and Gemini on top. Gradium transcription accepts only these five languages (or `any`); more are announced.

### B. Gemini only: voice and transcription

Gemini Live native audio voice, input transcription, vision and grading, with no Gradium voice. The Live API and its input transcription cover the 99 languages below. Native audio output has 30 HD voices in 24 languages (no per-language list published), so expect the best voice quality in those.

| Language | Code |
|---|---|
| Afrikaans | `af` |
| Akan | `ak` |
| Albanian | `sq` |
| Amharic | `am` |
| Arabic | `ar` |
| Armenian | `hy` |
| Assamese | `as` |
| Azerbaijani | `az` |
| Basque | `eu` |
| Belarusian | `be` |
| Bengali | `bn` |
| Bosnian | `bs` |
| Bulgarian | `bg` |
| Burmese | `my` |
| Catalan | `ca` |
| Cebuano | `ceb` |
| Chinese (Simplified) | `zh-Hans` |
| Chinese (Traditional) | `zh-Hant` |
| Croatian | `hr` |
| Czech | `cs` |
| Danish | `da` |
| Dutch | `nl` |
| English | `en` |
| Estonian | `et` |
| Faroese | `fo` |
| Filipino | `fil` |
| Finnish | `fi` |
| French | `fr` |
| Galician | `gl` |
| Georgian | `ka` |
| German | `de` |
| Greek | `el` |
| Gujarati | `gu` |
| Hausa | `ha` |
| Hebrew | `he` |
| Hindi | `hi` |
| Hungarian | `hu` |
| Icelandic | `is` |
| Indonesian | `id` |
| Irish | `ga` |
| Italian | `it` |
| Japanese | `ja` |
| Kannada | `kn` |
| Kazakh | `kk` |
| Khmer | `km` |
| Kinyarwanda | `rw` |
| Korean | `ko` |
| Kurdish | `ku` |
| Kyrgyz | `ky` |
| Lao | `lo` |
| Latvian | `lv` |
| Lithuanian | `lt` |
| Macedonian | `mk` |
| Malay | `ms` |
| Malayalam | `ml` |
| Maltese | `mt` |
| Maori | `mi` |
| Marathi | `mr` |
| Mongolian | `mn` |
| Nepali | `ne` |
| Norwegian | `no/nb` |
| Odia | `or` |
| Oromo | `om` |
| Pashto | `ps` |
| Persian | `fa` |
| Polish | `pl` |
| Portuguese (Brazil) | `pt-BR` |
| Portuguese (Portugal) | `pt-PT` |
| Punjabi | `pa` |
| Quechua | `qu` |
| Romanian | `ro` |
| Romansh | `rm` |
| Russian | `ru` |
| Serbian | `sr` |
| Sindhi | `sd` |
| Sinhala | `si` |
| Slovak | `sk` |
| Slovenian | `sl` |
| Somali | `so` |
| Southern Sotho | `st` |
| Spanish | `es` |
| Swahili | `sw` |
| Swedish | `sv` |
| Tajik | `tg` |
| Tamil | `ta` |
| Telugu | `te` |
| Thai | `th` |
| Tswana | `tn` |
| Turkish | `tr` |
| Turkmen | `tk` |
| Ukrainian | `uk` |
| Urdu | `ur` |
| Uzbek | `uz` |
| Vietnamese | `vi` |
| Welsh | `cy` |
| Western Frisian | `fy` |
| Wolof | `wo` |
| Yoruba | `yo` |
| Zulu | `zu` |

### C. Offline: Gemma 4 E2B on device

Gemma 4 E2B (`src/offline/gemma.ts`, Apache 2.0) is pretrained on 140+ languages with out-of-the-box support for 35+. The model card has no per-language list. On the web it is text only and needs WebGPU: typed roleplay and corrections, no voice, no camera.

## What it takes to add a language

1. Settings: a target language field (stored with the other settings) instead of the fixed French.
2. Prompts: pass the language as a parameter to every prompt (Noé, corrections, review, Listen translate and extract, the offline prompts in `src/offline/prompts.ts`) instead of hard-coded French.
3. Tier A only: route Gradium voice and STT to that language and pick a voice or accent from the library.
4. Tier B: Gemini Live voice and Gemini TTS for that language, with the Gemini Live transcription language set to match; no Gradium.
5. Onboarding: a language picker on first run, limited to the languages wired up so far.
