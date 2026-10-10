# Alltag design language (v1, 2026-10-10)

Alltag teaches a language from the room you are in: camera on an object,
a tutor voice names it, you get through a small spoken interaction, you
get corrected after, the fumbles come back later. No courses, no streaks.

## Two surfaces
- **Camera surfaces** (viewfinder, scene labels, roleplay over the live image,
  recall trigger): near-black ground, white type, glass pills. Content is the
  user's own world; chrome stays out of the way.
- **Learning surfaces** (object sheet, corrections, review, diary, settings,
  onboarding): light paper ground, ink type, one accent.

## Colors (CSS tokens; write them INLINE, not as CSS vars, except in helmet)
Ground
- paper      #F6F5F2   light ground
- card       #FFFFFF   cards on paper
- line       #E3E1DB   hairlines on paper
- ink        #15181C   primary text on paper
- ink2       #5B6069   secondary text on paper (4.5:1 on paper)
- night      #0D0F12   camera ground
- glass      rgba(20,22,26,0.62) pills over camera, blur 18px, 1px rgba(255,255,255,0.14) border
- snow       #FFFFFF   text on camera

Accent
- moss       #0F6E56   the one accent. Buttons, active state, "better" text
- mossSoft   #DDEFE7   accent tint for chips / selected rows
- clay       #B84A1C   "what you said" in corrections, errors (3.9:1 on paper at 24px+, use 20px+ or bold)
- claySoft   #F7E3DA   tint behind clay text
- sun        #F2C94C   recall / "we saw this before" highlight, only on camera surfaces

Semantic
- success = moss, attention = clay, memory = sun. Never red/green together.

## Type (Google Fonts, both in <helmet>)
- Display: "Bricolage Grotesque", weights 500/700. Headlines, target-language words, labels on camera.
- Body: "Instrument Sans", 400/500/600. Everything else.
Helmet link:
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=Instrument+Sans:wght@400;500;600&display=swap">

Scale (px / line-height)
- hero 44/48 display 700 (target word on object sheet, onboarding titles)
- h1 32/38 display 700
- h2 24/30 display 500
- title 18/24 body 600
- body 16/24 body 400
- small 14/20 body 500
- micro 12/16 body 500, letter-spacing 0.04em, uppercase for eyebrows

Target-language text is ALWAYS display face. Native-language gloss is body face in ink2.

## Spacing and shape
- 8px grid. Screen side gutter 20px. Section gap 24px. Card padding 16px.
- Radii: card 20px, pill 999px, sheet top 28px, chip 10px, button 16px.
- Buttons: primary moss bg, snow text, 56px tall, body 600 17px. Secondary: card bg, ink text, 1px line.
- Touch targets ≥ 44px.
- Shadows: none on paper. Camera pills use glass only.

## Phone frame
- 390×844. No fake status bar. Home indicator: none. Top safe inset 54px, bottom 34px (leave as padding).
- Bottom nav on learning surfaces only, 3 items: Look (camera), Review, Diary. Icons inline stroke SVG 24px, label micro. Active = moss.
- Camera surfaces have no bottom nav: a single shutter / mic control row.

## Components (draw these consistently)
- **Viewfinder brackets**: four 28px L corners, 3px snow, radius 6, 24px in from the photo edge. (ref: CapWords)
- **Scene label**: glass pill, display 16px snow target word, then body 13px rgba(255,255,255,0.72) gloss. Small 6px moss dot on the left when the word is already known, sun dot when a card is due. Anchored to a 8px leader dot on the object.
- **Task pill**: top center on roleplay, glass, micro eyebrow "YOUR TASK" + body 15px snow. (ref: Speak)
- **Tutor bubble**: glass card max-width 320px, display 18px snow for the target language line, body 14px gloss below, 3 icon buttons: replay, translate, slower.
- **Mic control**: 72px circle. Idle: card bg, moss mic icon. Listening: moss bg, snow bars waveform. Thinking: glass, three dots. Speaking (tutor): glass with a moss ring. Label under it in micro: "Hold to talk" / "Listening" / "Thinking" / "Tap to interrupt".
- **Correction card** (ref: Speak, Duolingo): card, eyebrow micro ink2 with error type chip (GENDER, ARTICLE, TENSE, WORD ORDER, VOCAB, REGISTER). Line 1 "You said" small ink2, then display 18px clay with the wrong token underlined. Line 2 "Better" small ink2, display 18px moss. Then body 15px ink2 why, max 2 lines. Footer: "Say it again" secondary button + bookmark icon.
- **Review card**: card with photo crop on top (aspect 4:3, radius 20px top), below: micro eyebrow of the place ("YOUR KITCHEN · 2 DAYS AGO"), body 16px task ("Ask where this is"). Mic control centered under. (ref: CapWords hold-to-speak, Babbel "did you remember")
- **Error type group header** on review queue: display 20px ink "Feminine articles", small ink2 "4 due · you drop *la* before nouns you just learned".
- **Diary tile**: photo 1:1 radius 16, on-image bottom gradient, display 15px snow phrase, micro gloss date.
- **Level meter**: thin 4px moss bar, label "A1 → A2" micro.
- **Photo placeholders**: never a grey box with "image". Use a soft two-tone CSS gradient block (e.g. linear-gradient(160deg,#3A3F47,#1C1F24)) with a small inline SVG outline of the object (cup, machine, ticket) centered at 30% opacity, and a micro caption "[PHOTO: coffee machine]" bottom-left in gloss. On paper surfaces use #E9E7E1 → #D6D3CB.

## Copy
Target language for the demo: French. Native: English. Tutor name: "Noé". Persona: Zurich café barista, warm, short sentences.
Microcopy is lowercase-calm, no exclamation marks, no emoji. "Point at anything." "Hold to talk." "Say it again." "We saw this before."

## Don'ts
- No streaks, XP, flames, gems, leaderboards, mascots.
- No gradient washes on paper, no left-border cards, no emoji icons.
- No Inter/Roboto/Arial.
- No fake status bars.
