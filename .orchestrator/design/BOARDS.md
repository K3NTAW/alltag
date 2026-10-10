# Alltag boards — what is on each screen

Demo scenario used across ALL boards (keep it consistent):
- Learner: English speaker, French A1, in Zurich. Tutor: Noé, café barista persona.
- Scene 1: a café counter at the hackathon venue. Objects: la machine à café, une tasse, le lait, un croissant, la carte (menu), la caisse.
- Task: "Order a coffee with milk and ask how much it is."
- Learner said: "Je veux le café avec le lait." → better: "Je voudrais un café au lait, s'il vous plaît." (register + article). Also said "le machine" → "la machine" (gender).
- Second scene for recall: same machine two days later.
- Review queue groups: "Feminine articles" (4 due), "Politeness: je voudrais" (2 due), "Food words" (3 due).
- Diary entries: "la machine à café" (café, today), "un billet, s'il vous plaît" (Hauptbahnhof, yesterday), "où est le lait ?" (kitchen, 3 days ago), "une table pour deux" (restaurant, last week).

Sheet boards are 1200 wide. Phone boards 390×844. Night = camera surface, Paper = learning surface.

## Foundations.dc.html (1200×1320, paper)
Title "Foundations". Four sections in a 12-col feel:
1. Color: swatch tiles for paper, card, line, ink, ink2, night, glass, moss, mossSoft, clay, claySoft, sun. Each tile: 96×72 block, name, hex, role line.
2. Type: live specimens of hero 44, h1 32, h2 24, title 18, body 16, small 14, micro 12, each with the French sample "la machine à café" in display and the English gloss in body.
3. Spacing and shape: 8px grid row of blocks (4, 8, 12, 16, 20, 24, 32, 48), radii samples (chip 10, button 16, card 20, sheet 28, pill 999).
4. Surfaces: two mini cards side by side, "Camera surfaces: night ground, glass pills, snow text, sun for memory" and "Learning surfaces: paper, cards, moss accent, clay for what you said". Rule list under it: no streaks, no XP, no mascots, no emoji, correction after the turn.

## Research.dc.html (1200×1320, paper)
Title "Research · what we took from Mobbin and why". A grid of 12 reference rows (3 columns × 4). Each: app name (display 18), what we took (body 14), link as `<a href>` to the mobbin_url, and a tag chip of which board uses it. Entries:
- CapWords camera: bracket corners, "Curious how to say this in French? Tap to snap", soft shutter. → CameraIdle. https://mobbin.com/screens/a56da769-84dd-4cc0-892c-027cf372698f
- Lifesum "Snap a meal": full-bleed photo, bottom dark sheet with eyebrow + headline + shutter. → CameraScanning. https://mobbin.com/screens/1aeee107-a9ef-4770-91a4-827bb3c62ffd
- Speak roleplay: task pill top, tutor line in glass bubble with replay/translate, "Tap to respond" mic. → RoleplayStart. https://mobbin.com/screens/55235d18-59b0-4708-b3dc-77d37a7fbea4
- Tolan: camera + chat + mic as one control row under a character. → control row. https://mobbin.com/screens/e3d06f86-9c1d-466e-aeb0-342a2e6ed946
- Claude voice: single wide pill with waveform, settings left, close right. → RoleplayListening. https://mobbin.com/screens/13cf4949-114a-4686-a9ef-9c80f694c801
- Pi "is listening": calm, text only state. → thinking state copy. https://mobbin.com/screens/7f86354d-c06a-4c2f-8396-616c1ac2995c
- Speak correction cards: orange "what you said" / green "better" / why / Retry. → Corrections. https://mobbin.com/screens/c7abdc8b-c155-424c-b22c-ac79535784e0
- Duolingo correction explanation: strike + replacement, examples list. → Corrections why. https://mobbin.com/screens/26c5c998-56b0-410b-9f81-326fdb66dcaa
- CapWords card review: photo card, IPA, "Hold to speak → master the word". → ReviewCard. https://mobbin.com/screens/00f79918-32d2-4aaa-822c-3bd63942c617
- Babbel "Did you remember it correctly? No / Yes". → ReviewResult self-grade fallback. https://mobbin.com/screens/2be4c469-11ee-4134-be4d-0e8a8d9b1cca
- Speak level picker: 5 levels with a line of what you can do. → Onb3Level. https://mobbin.com/screens/hfyffl (use flow link https://mobbin.com/flows/77b22c97-2cb0-450b-aa54-d31b96617ec5)
- 5 Minute Journal gallery: photo grid with date badges. → Diary. https://mobbin.com/screens/18b5e526-9721-4ba0-adf3-75d05a73c1e4
Footer line: what we did NOT take: Duolingo's streak/widget nag, Speak's "start a free trial" above the fold, avatars.

## Components.dc.html (1200×1320, paper, but with a night panel on the right third)
Title "Components". Left two thirds paper, right third night. Draw each component once, labelled with a micro caption:
Paper side: primary button, secondary button, chip (error type: GENDER / ARTICLE / TENSE / WORD ORDER / VOCAB / REGISTER), correction card (full), review card (full), review group header, diary tile, level meter, bottom nav (Look / Review / Diary), list row with chevron, toggle row.
Night side: viewfinder brackets on a photo placeholder, scene label pill (known dot, due dot variants), task pill, tutor bubble with 3 icon buttons, mic control in 4 states in a row (idle, listening, thinking, tutor speaking) each with its micro label, shutter button, top glass icon buttons (close, flash, flip).

## Onb1Welcome (paper)
Top 54 padding. Big display "Alltag" 44 at top-left. Then a 390-wide photo placeholder block (height 300, night gradient, café counter outline) with two scene label pills over it ("la machine à café", "une tasse"). Below: h1 "Learn French from the room you are in." body ink2 "Point your camera at anything. Talk your way through it. No courses." Primary button "Start" at bottom, secondary text link "How it works" under it. No sign-in.

## Onb2Language (paper)
Back arrow top-left. Eyebrow "I WANT TO LEARN". h1 "Which language?". List of 5 rows (card, 64 tall, radius 16): Français (selected: mossSoft bg, 1px moss, check icon right), Deutsch, Español, Português, English. Each row: display 18 word, small ink2 "French · voices by Gradium". Note under list in small ink2: "More languages as voices become available." Primary "Continue" bottom.

## Onb3Level (paper)
Back. Eyebrow "FRENCH". h1 "Where are you?". 5 rows: "I know a few words" (A1, selected), "I can order and ask simple things" (A2), "I can hold a short conversation" (B1), "I can talk about most things" (B2), "Not sure, let Noé find out" (dotted border row). Each row: display 18 title, small ink2 one line, CEFR chip right. Primary "Continue".

## Onb4Camera (paper)
Back. h1 "Camera and mic". body "Alltag works by looking and listening. Nothing is stored unless you keep a phrase." Two permission cards: camera icon + "Camera" + "To see what is around you" + status chip "Allow"; mic icon + "Microphone" + "To hear you talk" + "Allow". A small line under: "Processed by Gemini and Gradium. Photos stay on your phone unless you keep them in the diary." Primary "Open the camera".

## CameraIdle (night)
Full-bleed photo placeholder (café counter outline, night gradient) filling the screen. Top row: glass icon buttons left (close? no: settings gear) and right (flash, flip). Viewfinder brackets centered 300×300. Under brackets, centered snow body 15: "Point at anything." small gloss "Noé will tell you what it is called." Bottom control row: left glass circle "Review" icon (book) with micro label, center 76px shutter (snow ring, inner snow disc), right glass circle "Diary" (grid). Tiny top-center glass pill "Français · A1".

## CameraScanning (night)
Same photo, frozen (slightly brighter overlay rgba(13,15,18,0.35)). Brackets animate: draw them in sun color. Bottom sheet (glass, radius 28 top, height 180): eyebrow "LOOKING" in sun micro, display 22 snow "Un instant…" small gloss "Finding what is around you". Three small dots row. No shutter.

## SceneLabels (night)
Photo with 5 scene label pills anchored by leader dots: "la machine à café / coffee machine" (sun dot: due card), "une tasse / a cup" (moss dot: known), "le lait / milk", "un croissant / a croissant", "la carte / the menu". Top: glass pill "Café · 6 things". Bottom sheet (glass, 200 tall): eyebrow "NOÉ" micro; display 18 snow "Voilà la machine à café. On dit la machine." body gloss 14 "Here is the coffee machine. We say la." Row of 3 icon buttons (replay, translate, slower). Primary moss button full width "Talk to the barista" with mic icon. Secondary ghost "Just the words".

## ObjectSheet (paper sheet over dimmed night)
Top 40 % shows the dimmed photo with the one label highlighted ("la machine à café"). Paper sheet from 38 % with radius 28: drag handle; eyebrow "FEMININE · A1"; hero 44 display "la machine à café"; body ink2 "the coffee machine"; row of chips: "la · une", "pl. les machines"; a phrase card: display 18 "Est-ce que la machine marche ?" body ink2 "Does the machine work?" with play icon; a second phrase card "Un café, s'il vous plaît." / "A coffee, please."; row: secondary "Say it" (mic), primary "Keep" (bookmark). Small note "Kept phrases go to your diary and come back for review."

## VoiceIntro (night)
Photo dimmed 50 %. Centered: large tutor speaking indicator (glass circle 120 with moss ring and 5 snow bars). Below: display 20 snow (max 300 wide, centered): "Une tasse, le lait, un croissant." body gloss "A cup, milk, a croissant." Micro label "Noé is speaking · tap to interrupt". Bottom: progress of 3 dots (2 done moss, 1 line). Top: glass pill "Listen · 1 of 3". Right side vertical: small glass buttons "Slower", "Again".

## RoleplayStart (night)
Photo dimmed 30 %. Top center task pill: eyebrow "YOUR TASK" + body 15 "Order a coffee with milk and ask the price." Below it, left-aligned glass tutor bubble: eyebrow "NOÉ · BARISTA"; display 18 "Bonjour ! Qu'est-ce que je vous sers ?" body gloss "Hello! What can I get you?" 3 icon buttons. Bottom: mic control idle (card bg, moss mic) 72px centered, micro "Hold to talk". Left of mic a small glass "Hint" button (lightbulb), right a small glass "Translate" button. Very bottom: hairline + micro "Noé corrects you after, not during."

## RoleplayListening (night)
Same, mic control in listening state (moss bg, snow bars) and the whole bottom 160 px gets a moss glow (radial gradient rgba(15,110,86,0.35)). Live transcript line above the mic in glass pill: display 16 snow "Je veux le café avec le lait…" with a blinking caret block. Micro "Listening · release when done". Tutor bubble from before, dimmed to 60 %.

## RoleplayReply (night)
Transcript stack: user line right-aligned glass pill (display 16 snow "Je veux le café avec le lait."), then tutor bubble left: display 18 "Un café au lait, très bien. Ça fait quatre francs cinquante." body gloss "A coffee with milk, very good. That's 4.50." Mic control: tutor speaking state (glass, moss ring, bars). Micro "Noé is speaking · hold to interrupt". Small count pill top-right "2 turns". Task pill stays at top, now with a moss check on "ask the price" half done? Keep simple: task pill text same, with small "1 of 2" chip.

## Corrections (paper)
Top: close X left, title "After the chat" center, small ink2 "2 things" right. A short summary card: display 20 "You got the coffee." body ink2 "Noé understood you. Two things would sound more natural." Then two correction cards (full spec in STYLE.md):
Card 1: chip "REGISTER" + chip "ARTICLE". You said: display 18 clay "Je veux le café avec le lait." (underline "veux" and "le café"). Better: display 18 moss "Je voudrais un café au lait, s'il vous plaît." Why: "Je voudrais is the polite form for ordering. Un café au lait is the fixed phrase." Footer: secondary "Say it again" (mic), bookmark icon.
Card 2: chip "GENDER". You said "le machine" → Better "la machine". Why "Machine is feminine. Most nouns ending in -e are." Footer same.
Bottom sticky: primary "Keep both and continue" and ghost "Skip".

## ExchangeDone (paper)
Top: photo placeholder (the café, 390×220, with a small sun label "today"). h1 "You can now say". List of 3 phrase rows: display 18 "Je voudrais un café au lait, s'il vous plaît." + play icon; "Ça fait combien ?"; "la machine à café". Small ink2 under each "kept · review in 1 day". Level meter card: "A1 · 23 phrases kept" with thin moss bar at 23 %. Two buttons: primary "Look at something else" (camera icon), secondary "Done for now".

## ReviewQueue (paper)
Top 54. h1 "Review". small ink2 "9 due · about 4 minutes · speak your answers". Group 1 header "Feminine articles" + "4 due · you drop la before nouns you just learned" + 4 compact rows (photo thumb 48, display 16 phrase, micro place/date). Group 2 "Politeness: je voudrais" 2 rows. Group 3 "Food words" 3 rows (show 1 and fold). Primary sticky "Start · 9 cards". Bottom nav: Look / Review (active) / Diary.

## ReviewCard (paper)
Top: close X, progress "3 of 9" micro, thin bar. Review card: photo placeholder 350×262 radius 20 top (coffee machine outline), under it eyebrow "YOUR CAFÉ · 2 DAYS AGO", body 16 ink2 "Ask whether this works." Then a hint row "Hint: it is feminine" as ghost chip. Mic control idle centered, micro "Hold to talk". Ghost text button "Show the answer".

## ReviewResult (paper)
Same card, now with a result band under the photo: moss check circle + display 18 moss "Est-ce que la machine marche ?" + small ink2 "You said it right. Next in 4 days." Under: your transcript in small ink2 "You: est-ce que la machine marche". A secondary row for self-grade (Babbel pattern): "Was that easy?" with 3 small pills "Hard · Okay · Easy" (Okay selected). Primary "Next".

## RecallTrigger (night)
Camera with labels, but one label in sun: "la machine à café" with a small sun pill "we saw this before". Tutor bubble: eyebrow "NOÉ"; display 18 "On a vu ça. C'est le ou la machine ?" gloss "We saw this. Is it le or la machine?". Mic control idle. Micro "Say it". Top pill "Café · again".

## Diary (paper)
h1 "Diary". small ink2 "23 phrases · 6 places". Grid 2 columns of diary tiles (photo placeholder, phrase on image bottom gradient, micro date). 6 tiles: la machine à café (today), un billet, s'il vous plaît (yesterday), où est le lait ? (3 days ago), une table pour deux (last week), la caisse (last week), un croissant (last week). Tap state not needed. Bottom nav: Diary active.

## Settings (paper)
Title "Settings". Rows (card list): "Learning" French · A1 (chevron); "Noé's voice" Barista, Zurich (chevron); "Speed" slow / normal (toggle pills); "Corrections" After the chat (chevron); "Keep photos in diary" toggle on; "Data" Photos processed by Gemini, voice by Gradium, nothing stored on a server (small ink2 text block); "About" version 0.1 · hackathon 2026-10-10. No account section.

## StateNoMic (night)
Camera with dimmed photo. Centered glass card: mic-off icon, display 20 snow "Alltag can't hear you", body gloss "Allow the microphone in Settings to talk to Noé. You can still look at things and read." Primary "Open Settings", ghost "Just look".

## StateSlow (night)
Roleplay screen with the mic in thinking state. Above it a small glass pill with a clock icon: "Noé is thinking… slow connection". Transcript shows the user line. Micro under the mic "Taking longer than usual".

## StateEmptyReview (paper)
Review tab with nothing due: illustration = a soft paper card with a camera outline; h2 "Nothing due". body ink2 "Look at something new. What you learn today comes back tomorrow." Primary "Open the camera". Bottom nav Review active.
