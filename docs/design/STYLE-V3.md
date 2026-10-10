# Alltag v3 "Quiet glass, living orb" — the ONE design system. Every board follows it exactly.

Why v3: v1 (paper, Bricolage) and v2 (glass layer) were mixed; fonts, radii, buttons and backgrounds differed per screen; nothing moved. v3 has one type pair, one CTA style, one signature element (the Noé orb), one motion vocabulary, glass only on floating controls.

## 1. Type (two families, no others)
Font link (copy exactly into every <helmet>):
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@500&display=swap">
- RULE: French text is ALWAYS Instrument Serif (font-family: 'Instrument Serif', Georgia, serif; weight 400; never bold). English UI and glosses are ALWAYS Geist (font-family: 'Geist', system-ui, sans-serif). Micro labels, timers, counters, eyebrows use Geist Mono.
- Scale (size/line-height):
  - display 56/56 serif, letter-spacing -0.02em (cover, hero word on ObjectSheet)
  - large title 40/44 serif, -0.01em (screen titles: "Review", "Diary", "Settings", onboarding questions)
  - phrase L 30/36 serif (the main French line on a screen)
  - phrase M 24/30 serif (tutor lines, correction lines)
  - phrase S 19/25 serif (list rows, transcript lines)
  - headline 17/22 Geist 600
  - body 16/23 Geist 400
  - callout 15/21 Geist 400 (glosses under French lines, color ink2)
  - footnote 13/18 Geist 400
  - eyebrow 11/14 Geist Mono 500, uppercase, letter-spacing 0.08em, color ink2 (or green/sun when semantic)
- Italic serif (font-style: italic) only for the gloss-free "how Noé says it" emphasis words inside a French line; use sparingly.

## 2. Color (light "linen" ground, dark "night" ground)
Light (learning surfaces: review, diary, settings, corrections, onboarding):
- ground #F4F2EE (with ONE soft light: radial-gradient(70% 45% at 85% -5%, rgba(47,163,127,0.10), rgba(47,163,127,0) 70%) layered on it)
- card #FFFFFF; sunken #ECE9E3; hairline rgba(18,19,22,0.08)
- ink #121316; ink2 #5E616A (5.6:1 on ground); ink3 #8A8D94 only for disabled/decor, never for readable text
Dark (camera, roleplay, listen live, voice):
- night #0A0B0D; raised #16181C; text #F5F4F0; text2 rgba(245,244,240,0.70)
Accents (semantic, never decorative):
- green (Noé, known, correct, "better"): #127A5E; soft #DCEFE6; on dark #8FDCC0
- sun (memory: due, recall, "seen before"): #E7A92E; soft #FBF0D6; on dark #F3CF7A; text on sun soft uses #7A5208
- clay (what you said, errors): #B4472A; soft #F7E3DB
Orb gradient colors (only inside the orb and its glow): #0E5C47, #2FA37F, #BFE8D6, #F0C766.
NO other colors. No gradient washes behind content except the single ground light and camera dims.

## 3. Space, shape, elevation
- 4-pt grid. Screen gutter 20. Between sections 32. Card padding 20. Row height min 56. Touch targets >= 44.
- Radii: chip 10, thumb 14, inner 16, card 24, sheet 32 (top corners), capsule 999. Concentric: inner = outer - padding.
- Elevation light: e1 card = box-shadow: 0 1px 2px rgba(18,19,22,0.04), 0 8px 24px rgba(18,19,22,0.06); e2 floating = 0 2px 6px rgba(18,19,22,0.06), 0 18px 48px rgba(18,19,22,0.14). Cards have NO border.
- Dark: raised #16181C with 1px rgba(255,255,255,0.06) border, no shadow.
- Safe areas: 54px top, 34px bottom reserved. No fake status bar, no home indicator.

## 4. Glass (floating layer ONLY: tab bar, top circle buttons, camera pills, mic dock, toasts). Never on cards, lists, sheets' content. Never glass on glass.
- glass-light: background: rgba(255,255,255,0.62); backdrop-filter: blur(24px) saturate(170%); -webkit-backdrop-filter: blur(24px) saturate(170%); border: 1px solid rgba(255,255,255,0.8); box-shadow: inset 0 1px 0 rgba(255,255,255,0.9), 0 10px 30px rgba(18,19,22,0.12), 0 0 0 0.5px rgba(18,19,22,0.08)
- glass-dark: background: rgba(22,24,28,0.52); backdrop-filter: blur(24px) saturate(170%); -webkit-backdrop-filter: same; border: 1px solid rgba(255,255,255,0.14); box-shadow: inset 0 1px 0 rgba(255,255,255,0.16), 0 12px 36px rgba(0,0,0,0.45)
- glass-clear (over live camera): background: rgba(255,255,255,0.14); backdrop-filter: blur(16px) saturate(150%); -webkit-backdrop-filter: same; border: 1px solid rgba(255,255,255,0.32); box-shadow: inset 0 1px 0 rgba(255,255,255,0.4), 0 8px 24px rgba(0,0,0,0.3)
- Every glass element: position relative; overflow hidden; first child = specular div: <div style="position: absolute; inset: 0; border-radius: inherit; background: linear-gradient(180deg, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0) 45%); pointer-events: none"></div> (0.18 on dark).

## 5. Components (copy the snippets in SNIPPETS.md verbatim; change only text)
- Primary button: ink capsule (light screens) or white capsule (dark screens), height 56, radius 28, Geist 17/600, full width minus gutters. Leading icon optional 20px. ONE primary per screen.
- Secondary button: white card capsule with e1 on light; glass-dark capsule on dark. Same size.
- Tertiary: text button Geist 15/600 ink2, height 44.
- Top controls: floating 44x44 circle glass buttons at top 62, left 20 / right 20. Titles are in content (large title), never in a bar.
- Tab bar: 4 tabs Look, Listen, Review, Diary. Settings is the right top circle button on Look/Review/Diary. Glass capsule, left 20, right 20, height 64, bottom 34+12 (top edge y = 734). glass-light on light screens, glass-dark on dark. Selected tab: a 72x48 tinted capsule (green 14% on light, rgba(143,220,192,0.20) on dark) behind icon + label, icon/label green. Icons 22px stroke 1.75. Labels Geist 11/600. Content scrolls under it; last item has 110px bottom padding.
- Chips: height 28, radius 10, Geist Mono 11 uppercase. Error chips: GENDER, ARTICLE, TENSE, WORD ORDER, VOCAB, REGISTER on clay soft with clay text.
- Phrase row: white card, 64+ tall, French phrase S serif + gloss footnote ink2, trailing 36px circle play button (sunken bg).
- Correction card: white card r24. Eyebrow chips row. "You said" line: phrase M in clay with the wrong words struck (text-decoration: line-through; text-decoration-color: rgba(180,71,42,0.6)). Arrow. "Better" line: phrase M ink with the changed words in green and a 2px green underline (text-decoration: underline; text-underline-offset 4px). Why: callout ink2. Footer: secondary small "Say it again" + bookmark circle.
- Scene label pill (camera): glass-clear capsule height 38, padding 0 14 0 10, a 8px dot (green known, sun due, white new), French label Instrument Serif 18 white, English gloss on tap only. Anchored by a 2px white leader line 18px long + 6px white anchor dot on the object.
- Viewfinder brackets: four 28px L corners, 3px white stroke, radius 6, frame 280x280 centered at y 230..510.
- Shutter: 78px circle, 4px white ring, inner 62px white disc; long-press = talk to Noé (the inner disc becomes a mini orb).
- Mic dock (roleplay/review/recall): the Noé orb (section 6) sits centered in the bottom area; a glass capsule underneath holds left "Hint" and right "Translate" 44px circles? NO: keep it simple: orb 96px centered above a micro label in Geist Mono 11 ("HOLD TO TALK"), flanked by two 52px glass circle buttons (hint lightbulb left, translate right) at the orb's vertical center.
- Sheet: background #F4F2EE (light) at 100%, radius 32 top, grabber 36x5 radius 3 #CFCBC3 at top 8, e2 shadow upward. On camera, sheets are night-raised #16181C with the dark grabber rgba(255,255,255,0.25).
- Photo placeholder: see SNIPPETS.md (warm graded gradient + line art + caption "[PHOTO: …]" Geist Mono 10 at 40% white). No external images, no data URIs, no emoji.
- Icons: inline stroke SVG 24 viewBox, stroke-width 1.75, round caps/joins, currentColor. Allowed: mic, camera, play, pause, arrow-left, arrow-right, x, check, bookmark, book, grid, clock, volume, repeat, translate (two letters), lightbulb, gear, flash, flip, wave, lock, cloud, cloud-off, sparkle (4-point star), headphones, ear.

## 6. The Noé orb (signature; the only "character", abstract, no face)
One element, four states, same construction everywhere. Sizes: 28 (inline, tab, widget), 44 (header), 96 (mic dock), 168 (voice hero).
- idle: slow breathe 4.8s + inner gradient spin 12s. Glow 35%.
- listening (user speaking): orbListen 1.1s loop + two green ripple rings (ripple 1.6s, second ring delay 0.8s). Glow 60% green.
- thinking: inner spin 2.2s, outer opacity 0.75, no ripples, three Geist Mono dots under it ("dot" keyframes, delays 0/0.15/0.3s).
- speaking (Noé speaking): breathe 1.4s + sun-tinted ripple rings (rgba(240,199,102,0.5)) + 5 white bars inside? NO bars inside. Rings only.
Orb is the press target in roleplay, review, recall: press-and-hold talks. Haptic: soft impact on press, light on release.

## 7. Motion (the system; every board animates with these and nothing else)
Durations: instant 120ms, quick 220ms, base 360ms, slow 600ms, ambient 4800ms. Stagger 50ms per item.
Curves (CSS / SwiftUI):
- out: cubic-bezier(0.22, 1, 0.36, 1) / .spring(response: 0.35, dampingFraction: 0.86) — anything entering
- sheet: cubic-bezier(0.32, 0.72, 0, 1) / .spring(response: 0.5, dampingFraction: 0.9) — sheets, page pushes
- pop: cubic-bezier(0.34, 1.56, 0.64, 1) / .spring(response: 0.4, dampingFraction: 0.62) — labels, checks, kept badge
- loop: cubic-bezier(0.65, 0, 0.35, 1) — ambient loops (orb, glow)
Named motions (implement exactly; boards show them with the KEYFRAMES block):
1. Screen enter: content blocks riseIn (14px up, blur 6px to 0, opacity 0 to 1), base 360ms, out, stagger 50ms top to bottom.
2. Press: scale 0.97 instant 120ms, release with pop. Every button.
3. Tab switch: tint capsule slides between tabs (matched geometry), quick 220ms, out; icons crossfade.
4. Bracket lock (scan): brackets start at scale 1.12 opacity 0, lock to 1 in base, pop; then a soft scan line (2px, green-to-transparent glow) sweeps top to bottom 1.4s loop while Gemini looks.
5. Label pop: scene labels popIn (scale 0.82 to 1.04 to 1), quick+, pop, stagger 70ms, each with haptic light. Anchor dots appear first (instant), then pills.
6. Sheet rise: sheetUp, slow 600ms, sheet curve; background dims to 35% in base.
7. Orb states: crossfade between states in quick; never jump-cut.
8. Live transcript: words appear one by one (riseIn 220ms each, 40ms stagger); a 2px caret blinks at the end (caret 1s steps).
9. Correction reveal: wrong words get struck through left to right (strike 280ms), then the Better line riseIn after 200ms, changed words tint green with a 2px underline drawing in (220ms).
10. Success: check stroke draws (drawCheck 360ms, out) inside a green circle that pops; haptic success.
11. Keep: the kept phrase card scales to 0.6 and flies to the Diary tab (slow, sheet curve); the Diary tab icon bumps (pop) and shows a sun dot.
12. Review card: next card slides up from the stack (cards beneath at scale 0.94 / 0.88, 10px / 20px lower); swipe out to the left/right with 8° rotation, base, out.
13. Skeleton shimmer on loading surfaces only (shimmer 1.6s linear).
Reduce Motion: replace every move/scale with a 200ms crossfade; loops stop (orb static at idle, rings hidden). Reduce Transparency: glass-light -> #FFFFFF + hairline; glass-dark -> #1C1E22; glass-clear -> rgba(22,24,28,0.78).
Haptics map: label tap light; orb press soft; correct answer success; keep rigid; error warning (only on mic denied).

## 8. Voice and copy
Lowercase-first is NOT used; sentence case. Short. No streaks, no XP, no hearts, no mascots, no emoji, no "Great job!". Noé corrects after the turn, never during. French lines always have an English gloss underneath in callout ink2 unless the learner hid glosses.

## 9. Demo scenario (identical on every board)
Learner: English speaker, French A1, in Zurich. Tutor: Noé, café barista persona.
Scene: café counter. Objects: la machine à café (due, sun), une tasse (known, green), le lait, un croissant, la carte, la caisse.
Task: "Order a coffee with milk and ask how much it is."
Learner said "Je veux le café avec le lait." -> better "Je voudrais un café au lait, s'il vous plaît." (REGISTER + ARTICLE). Also "le machine" -> "la machine" (GENDER).
Noé lines: "Bonjour ! Qu'est-ce que je vous sers ?" (Hello! What can I get you?) ; "Un café au lait, très bien. Ça fait quatre francs cinquante." (A coffee with milk, very good. That's 4.50.)
Review groups: "Feminine articles" 4 due; "Politeness: je voudrais" 2 due; "Food words" 3 due. 9 due, about 4 minutes.
Diary: la machine à café (café, today), un billet, s'il vous plaît (Hauptbahnhof, yesterday), où est le lait ? (kitchen, 3 days ago), une table pour deux (restaurant, last week), la caisse (café, last week), un croissant (café, last week). 23 phrases, 6 places, 1 conversation.
Account and data (own auth with Supabase Auth since 2026-10-10 15:45; Clerk dropped): works without an account, everything stored on the phone first; optional sign-in with address + password syncs phrases, diary photos and review state to the cloud (Supabase, Frankfurt/Zurich region: say "EU"). Sync states: "Synced 2 min ago", "3 changes waiting, will sync when online", "Offline: Noé runs on your phone (Gemma 4 E2B), voice off".
Speech: voices by Gradium (French), understanding by Gemini.
