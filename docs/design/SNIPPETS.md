# Copy-paste snippets for Alltag v3. Change only text, positions and which state; never colors, radii, fonts or curves.

## A. File skeleton (phone board 390x844). Light screen shown; dark screens use background #0A0B0D and color #F5F4F0 on the root.
```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Screen name</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@500&display=swap">
<style>
body{margin:0}
a{color:#127A5E}a:hover{color:#0E5C47}
KEYFRAMES_BLOCK
</style>
</helmet>
<div style="width: 390px; height: 844px; box-sizing: border-box; position: relative; overflow: hidden; font-family: 'Geist', system-ui, sans-serif; color: #121316; background: radial-gradient(70% 45% at 85% -5%, rgba(47,163,127,0.10), rgba(47,163,127,0) 70%), #F4F2EE">
  ...
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":390,"height":844}}'>
class Component extends DCLogic {
  renderVals() { return {}; }
}
</script>
</body>
</html>
```
Rules: all styling inline except the helmet block (body, a, the keyframes). Animations are referenced inline: style="animation: riseIn 360ms cubic-bezier(0.22,1,0.36,1) both; animation-delay: 100ms". Close every element, quote every attribute. No {{holes}} on static boards. No external images, data URIs, emoji, iframes.

## B. KEYFRAMES_BLOCK (paste the whole block, every board, unchanged)
```css
@keyframes riseIn{from{opacity:0;transform:translateY(14px);filter:blur(6px)}to{opacity:1;transform:none;filter:blur(0)}}
@keyframes popIn{0%{opacity:0;transform:scale(.82)}60%{opacity:1;transform:scale(1.04)}100%{opacity:1;transform:scale(1)}}
@keyframes sheetUp{from{transform:translateY(100%)}to{transform:none}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes orbBreathe{0%,100%{transform:scale(1)}50%{transform:scale(1.045)}}
@keyframes orbSpin{to{transform:rotate(360deg)}}
@keyframes orbListen{0%,100%{transform:scale(1)}20%{transform:scale(1.10)}45%{transform:scale(.97)}70%{transform:scale(1.07)}}
@keyframes ripple{0%{transform:scale(1);opacity:.6}100%{transform:scale(1.9);opacity:0}}
@keyframes glowPulse{0%,100%{opacity:.5}50%{opacity:1}}
@keyframes bar{0%,100%{transform:scaleY(.3)}50%{transform:scaleY(1)}}
@keyframes dot{0%,80%,100%{opacity:.25;transform:translateY(0)}40%{opacity:1;transform:translateY(-3px)}}
@keyframes caret{0%,49%{opacity:1}50%,100%{opacity:0}}
@keyframes bracketLock{0%{opacity:0;transform:scale(1.12)}100%{opacity:1;transform:scale(1)}}
@keyframes scan{0%{transform:translateY(0);opacity:0}10%{opacity:1}90%{opacity:1}100%{transform:translateY(276px);opacity:0}}
@keyframes drawCheck{from{stroke-dashoffset:24}to{stroke-dashoffset:0}}
@keyframes strike{from{background-size:0% 2px}to{background-size:100% 2px}}
@keyframes underline{from{background-size:0% 2px}to{background-size:100% 2px}}
@keyframes shimmer{from{background-position:-200% 0}to{background-position:200% 0}}
@keyframes floaty{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes bump{0%,100%{transform:scale(1)}40%{transform:scale(1.18)}}
@keyframes flyToTab{0%{transform:none;opacity:1}100%{transform:translate(118px,330px) scale(.2);opacity:0}}
@media (prefers-reduced-motion: reduce){*{animation-duration:1ms!important;animation-iteration-count:1!important;animation-delay:0ms!important}}
```

## C. Noé orb. Replace S with the size (28/44/96/168). Inner layers scale with the box.
IDLE:
```html
<div style="position: relative; width: Spx; height: Spx; flex-shrink: 0">
  <div style="position: absolute; inset: -18%; border-radius: 50%; background: radial-gradient(closest-side, rgba(47,163,127,0.38), rgba(47,163,127,0)); filter: blur(10px); animation: glowPulse 4.8s cubic-bezier(0.65,0,0.35,1) infinite"></div>
  <div style="position: absolute; inset: 0; border-radius: 50%; overflow: hidden; animation: orbBreathe 4.8s cubic-bezier(0.65,0,0.35,1) infinite; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.35), 0 14px 36px rgba(14,92,71,0.28)">
    <div style="position: absolute; inset: -35%; background: conic-gradient(from 0deg, #0E5C47, #2FA37F, #BFE8D6, #F0C766, #2FA37F, #0E5C47); filter: blur(14px); animation: orbSpin 12s linear infinite"></div>
    <div style="position: absolute; inset: 0; border-radius: 50%; background: radial-gradient(55% 45% at 34% 26%, rgba(255,255,255,0.78), rgba(255,255,255,0) 62%)"></div>
  </div>
</div>
```
LISTENING: same, but the core uses animation: orbListen 1.1s cubic-bezier(0.65,0,0.35,1) infinite; glow opacity stays (animation: glowPulse 1.1s ...), and BEFORE the glow add two rings:
```html
  <div style="position: absolute; inset: 0; border-radius: 50%; border: 2px solid rgba(47,163,127,0.55); animation: ripple 1.6s cubic-bezier(0.22,1,0.36,1) infinite"></div>
  <div style="position: absolute; inset: 0; border-radius: 50%; border: 2px solid rgba(47,163,127,0.55); animation: ripple 1.6s cubic-bezier(0.22,1,0.36,1) infinite; animation-delay: 0.8s"></div>
```
THINKING: inner conic uses animation: orbSpin 2.2s linear infinite; core opacity: 0.75; no rings; under the orb three dots:
```html
<div style="display: flex; gap: 6px; justify-content: center"><span style="width: 6px; height: 6px; border-radius: 50%; background: currentColor; animation: dot 1.2s infinite"></span><span style="width: 6px; height: 6px; border-radius: 50%; background: currentColor; animation: dot 1.2s infinite; animation-delay: .15s"></span><span style="width: 6px; height: 6px; border-radius: 50%; background: currentColor; animation: dot 1.2s infinite; animation-delay: .3s"></span></div>
```
SPEAKING: core animation: orbBreathe 1.4s cubic-bezier(0.65,0,0.35,1) infinite; rings as LISTENING but border color rgba(240,199,102,0.6) and ripple 2s.

## D. Floating top circle button (light: glass-light; dark: swap to glass-dark values and color #F5F4F0)
```html
<button aria-label="Close" style="position: absolute; top: 62px; left: 20px; width: 44px; height: 44px; border-radius: 22px; border: 1px solid rgba(255,255,255,0.8); background: rgba(255,255,255,0.62); backdrop-filter: blur(24px) saturate(170%); -webkit-backdrop-filter: blur(24px) saturate(170%); box-shadow: inset 0 1px 0 rgba(255,255,255,0.9), 0 10px 30px rgba(18,19,22,0.12), 0 0 0 0.5px rgba(18,19,22,0.08); display: flex; align-items: center; justify-content: center; color: #121316; padding: 0; cursor: pointer; overflow: hidden">
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"></path></svg>
</button>
```
Dark values: border: 1px solid rgba(255,255,255,0.14); background: rgba(22,24,28,0.52); box-shadow: inset 0 1px 0 rgba(255,255,255,0.16), 0 12px 36px rgba(0,0,0,0.45); color: #F5F4F0.

## E. Tab bar (light). Selected = Review here. For dark screens use glass-dark values, labels rgba(245,244,240,0.70), selected tint rgba(143,220,192,0.20) and selected color #8FDCC0.
```html
<nav aria-label="Tabs" style="position: absolute; left: 20px; right: 20px; top: 734px; height: 64px; border-radius: 32px; border: 1px solid rgba(255,255,255,0.8); background: rgba(255,255,255,0.62); backdrop-filter: blur(24px) saturate(170%); -webkit-backdrop-filter: blur(24px) saturate(170%); box-shadow: inset 0 1px 0 rgba(255,255,255,0.9), 0 10px 30px rgba(18,19,22,0.12), 0 0 0 0.5px rgba(18,19,22,0.08); display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); align-items: center; padding: 0 8px; box-sizing: border-box; overflow: hidden">
  <a href="#" style="height: 48px; margin: 0 4px; border-radius: 24px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; color: #5E616A; text-decoration: none; font-size: 11px; font-weight: 600"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8V6a2 2 0 0 1 2-2h2M17 4h2a2 2 0 0 1 2 2v2M21 16v2a2 2 0 0 1-2 2h-2M7 20H5a2 2 0 0 1-2-2v-2"></path><circle cx="12" cy="12" r="3.5"></circle></svg>Look</a>
  <a href="#" style="height: 48px; margin: 0 4px; border-radius: 24px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; color: #5E616A; text-decoration: none; font-size: 11px; font-weight: 600"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 10v4M10 6v12M14 8v8M18 11v2"></path></svg>Listen</a>
  <a href="#" aria-current="page" style="height: 48px; margin: 0 4px; border-radius: 24px; background: rgba(18,122,94,0.14); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; color: #127A5E; text-decoration: none; font-size: 11px; font-weight: 600"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="5" width="13" height="15" rx="2.5"></rect><path d="M8 3h10a2 2 0 0 1 2 2v12"></path></svg>Review</a>
  <a href="#" style="height: 48px; margin: 0 4px; border-radius: 24px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; color: #5E616A; text-decoration: none; font-size: 11px; font-weight: 600"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="2"></rect><rect x="13" y="4" width="7" height="7" rx="2"></rect><rect x="4" y="13" width="7" height="7" rx="2"></rect><rect x="13" y="13" width="7" height="7" rx="2"></rect></svg>Diary</a>
</nav>
```

## F. Buttons
Primary (light screen):
```html
<button style="height: 56px; width: 100%; border: 0; border-radius: 28px; background: #121316; color: #FFFFFF; font: 600 17px/22px 'Geist', system-ui, sans-serif; display: flex; align-items: center; justify-content: center; gap: 10px; cursor: pointer; box-shadow: 0 8px 20px rgba(18,19,22,0.18)">Continue</button>
```
Primary (dark screen): background #F5F4F0; color #121316; box-shadow 0 8px 24px rgba(0,0,0,0.4).
Secondary (light): background #FFFFFF; color #121316; box-shadow: 0 1px 2px rgba(18,19,22,0.04), 0 8px 24px rgba(18,19,22,0.06).
Secondary (dark): glass-dark values, color #F5F4F0.
Tertiary: border 0; background transparent; color #5E616A; font 600 15px Geist; height 44px.

## G. Photo placeholder (full-bleed camera or thumbnail; scale the svg)
```html
<div style="position: absolute; inset: 0; background: radial-gradient(60% 40% at 70% 30%, rgba(240,199,102,0.22), rgba(240,199,102,0) 70%), radial-gradient(80% 60% at 20% 80%, rgba(47,163,127,0.10), rgba(47,163,127,0) 70%), linear-gradient(165deg, #3B3732 0%, #23211E 55%, #121110 100%); display: flex; align-items: center; justify-content: center">
  <svg width="240" height="240" viewBox="0 0 200 200" fill="none" stroke="#F5F4F0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="opacity: 0.28"><rect x="40" y="30" width="120" height="50" rx="8"></rect><rect x="30" y="80" width="140" height="30" rx="6"></rect><path d="M60 110 v60 h80 v-60"></path><rect x="50" y="170" width="100" height="10" rx="3"></rect><path d="M85 110 v12 h30 v-12"></path><path d="M90 140 h20 v16 a10 10 0 0 1 -20 0 z"></path><path d="M110 144 h8 a6 6 0 0 1 0 12 h-8"></path><circle cx="140" cy="95" r="6"></circle></svg>
  <div style="position: absolute; left: 20px; bottom: 180px; font: 500 10px/14px 'Geist Mono', monospace; letter-spacing: 0.08em; color: rgba(245,244,240,0.45)">[PHOTO: CAFÉ COUNTER]</div>
</div>
```
Camera dims (add over the photo when glass-clear sits on it): top `linear-gradient(180deg, rgba(0,0,0,0.42), rgba(0,0,0,0))` 140px; bottom `linear-gradient(0deg, rgba(0,0,0,0.55), rgba(0,0,0,0))` 220px.

## H. Scene label pill with anchor (absolute positioned; pop in with stagger)
```html
<div style="position: absolute; left: 196px; top: 300px; display: flex; flex-direction: column; align-items: flex-start; gap: 0; animation: popIn 360ms cubic-bezier(0.34,1.56,0.64,1) both; animation-delay: 140ms">
  <div style="position: relative; height: 38px; padding: 0 14px 0 10px; border-radius: 19px; display: flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.14); backdrop-filter: blur(16px) saturate(150%); -webkit-backdrop-filter: blur(16px) saturate(150%); border: 1px solid rgba(255,255,255,0.32); box-shadow: inset 0 1px 0 rgba(255,255,255,0.4), 0 8px 24px rgba(0,0,0,0.3); overflow: hidden">
    <span style="width: 8px; height: 8px; border-radius: 50%; background: #F3CF7A; box-shadow: 0 0 0 3px rgba(243,207,122,0.25)"></span>
    <span lang="fr" style="font: 400 18px/22px 'Instrument Serif', Georgia, serif; color: #FFFFFF">la machine à café</span>
  </div>
  <div style="width: 2px; height: 18px; margin-left: 14px; background: rgba(255,255,255,0.7)"></div>
  <div style="width: 8px; height: 8px; margin-left: 11px; border-radius: 50%; background: #FFFFFF; box-shadow: 0 0 0 4px rgba(255,255,255,0.25)"></div>
</div>
```
Dot colors: due #F3CF7A, known #8FDCC0, new #FFFFFF.

## I. Card + phrase row (light)
```html
<div style="background: #FFFFFF; border-radius: 24px; padding: 20px; box-shadow: 0 1px 2px rgba(18,19,22,0.04), 0 8px 24px rgba(18,19,22,0.06); display: flex; flex-direction: column; gap: 6px">
  <div style="font: 500 11px/14px 'Geist Mono', monospace; letter-spacing: 0.08em; text-transform: uppercase; color: #5E616A">Eyebrow</div>
  <div lang="fr" style="font: 400 24px/30px 'Instrument Serif', Georgia, serif; color: #121316">Je voudrais un café au lait, s'il vous plaît.</div>
  <div style="font: 400 15px/21px 'Geist', system-ui, sans-serif; color: #5E616A">I'd like a coffee with milk, please.</div>
</div>
```
Play circle: 36x36 radius 18 background #ECE9E3 color #121316 with a play svg 16px.

## J. Eyebrow chip (error type)
```html
<span style="height: 28px; padding: 0 10px; border-radius: 10px; background: #F7E3DB; color: #B4472A; display: inline-flex; align-items: center; font: 500 11px/14px 'Geist Mono', monospace; letter-spacing: 0.08em">REGISTER</span>
```
Green variant: background #DCEFE6 color #127A5E. Sun variant: background #FBF0D6 color #7A5208.

## K. Strike / underline (correction reveal, animated)
Wrong words: `<span style="background-image: linear-gradient(#B4472A, #B4472A); background-repeat: no-repeat; background-position: 0 58%; background-size: 100% 2px; animation: strike 280ms cubic-bezier(0.22,1,0.36,1) both; animation-delay: 300ms">veux le café</span>`
Better words: `<span style="color: #127A5E; background-image: linear-gradient(#127A5E, #127A5E); background-repeat: no-repeat; background-position: 0 100%; background-size: 100% 2px; animation: underline 220ms cubic-bezier(0.22,1,0.36,1) both; animation-delay: 800ms">voudrais un café au lait</span>`

## L. Viewfinder brackets (280x280 frame at left 55 top 230; animate bracketLock)
```html
<div style="position: absolute; left: 55px; top: 230px; width: 280px; height: 280px; animation: bracketLock 360ms cubic-bezier(0.34,1.56,0.64,1) both">
  <div style="position: absolute; left: 0; top: 0; width: 28px; height: 28px; border-left: 3px solid #FFFFFF; border-top: 3px solid #FFFFFF; border-top-left-radius: 8px"></div>
  <div style="position: absolute; right: 0; top: 0; width: 28px; height: 28px; border-right: 3px solid #FFFFFF; border-top: 3px solid #FFFFFF; border-top-right-radius: 8px"></div>
  <div style="position: absolute; left: 0; bottom: 0; width: 28px; height: 28px; border-left: 3px solid #FFFFFF; border-bottom: 3px solid #FFFFFF; border-bottom-left-radius: 8px"></div>
  <div style="position: absolute; right: 0; bottom: 0; width: 28px; height: 28px; border-right: 3px solid #FFFFFF; border-bottom: 3px solid #FFFFFF; border-bottom-right-radius: 8px"></div>
</div>
```
Scanning: add inside the frame `<div style="position: absolute; left: 8px; right: 8px; top: 2px; height: 2px; border-radius: 1px; background: linear-gradient(90deg, rgba(143,220,192,0), #8FDCC0, rgba(143,220,192,0)); box-shadow: 0 0 18px 4px rgba(143,220,192,0.45); animation: scan 1.4s cubic-bezier(0.65,0,0.35,1) infinite"></div>`.
