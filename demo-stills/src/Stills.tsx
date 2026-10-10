import { AbsoluteFill, Audio, Img, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as loadSerif } from "@remotion/google-fonts/InstrumentSerif";
import { loadFont as loadGeist } from "@remotion/google-fonts/Geist";
import { loadFont as loadMono } from "@remotion/google-fonts/GeistMono";
import { NARRATION, SECTIONS } from "./narration";

const serif = loadSerif().fontFamily;
const geist = loadGeist().fontFamily;
const mono = loadMono().fontFamily;

export type StillsProps = { audio: string; audioSeconds: number };

const LINEN = "#F4F2EE";
const INK = "#1B1A17";
const FADE = 12;
const words = (s: string) => s.trim().split(/\s+/).length;

type Span = { from: number; len: number };

// Split a span into parts by weight; the last part takes the rounding remainder.
const split = (span: Span, weights: number[]): Span[] => {
  const total = weights.reduce((a, b) => a + b, 0);
  let at = span.from;
  return weights.map((w, i) => {
    const len = i === weights.length - 1 ? span.from + span.len - at : Math.round((span.len * w) / total);
    const s = { from: at, len };
    at += len;
    return s;
  });
};

const fadeInOut = (frame: number, len: number, fade = FADE) => {
  const f = Math.min(fade, len / 3);
  return interpolate(frame, [0, f, len - f, len], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
};

const Orb = ({ size }: { size: number }) => {
  const frame = useCurrentFrame();
  const s = 1 + 0.05 * Math.sin((frame / 30) * Math.PI * 0.5);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        transform: `scale(${s}) rotate(${frame * 0.4}deg)`,
        background:
          "radial-gradient(circle at 32% 28%, #F0C766 0%, #BFE8D6 22%, #2FA37F 52%, #0E5C47 82%)",
        boxShadow: `0 0 ${size * 0.5}px rgba(47,163,127,${0.25 + 0.15 * s})`,
      }}
    />
  );
};

const Phone = ({ board, len }: { board: string; len: number }) => {
  const frame = useCurrentFrame();
  const zoom = interpolate(frame, [0, len], [1, 1.03]);
  const W = 420;
  const H = (W * 844) / 390;
  return (
    <div
      style={{
        position: "absolute",
        left: 300,
        top: (1080 - H) / 2 - 8,
        width: W + 16,
        height: H + 16,
        borderRadius: 55,
        background: "#16171A",
        padding: 8,
        boxShadow: "0 40px 80px rgba(27,26,23,.22), 0 8px 24px rgba(27,26,23,.12)",
        opacity: fadeInOut(frame, len),
      }}
    >
      <div style={{ width: W, height: H, borderRadius: 47, overflow: "hidden", position: "relative" }}>
        <Img src={staticFile(`shots/${board}.png`)} style={{ width: W, height: H, transform: `scale(${zoom})` }} />
        <div
          style={{
            position: "absolute",
            top: 11,
            left: (W - 120) / 2,
            width: 120,
            height: 34,
            borderRadius: 17,
            background: "#000",
          }}
        />
      </div>
    </div>
  );
};

const Copy = ({ eyebrow, headline, how, len }: { eyebrow: string; headline: string; how: string; len: number }) => {
  const frame = useCurrentFrame();
  const o = fadeInOut(frame, len);
  const y = interpolate(frame, [0, 18], [16, 0], { extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", left: 880, top: 360, width: 860, opacity: o, transform: `translateY(${y}px)` }}>
      <div
        style={{
          display: "inline-block",
          fontFamily: mono,
          fontSize: 22,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: "#0E5C47",
          background: "rgba(47,163,127,.12)",
          border: "1px solid rgba(14,92,71,.25)",
          borderRadius: 999,
          padding: "8px 18px",
        }}
      >
        {eyebrow}
      </div>
      <div style={{ fontFamily: serif, fontSize: 96, lineHeight: 1.05, color: INK, marginTop: 28 }}>{headline}</div>
      <div style={{ fontFamily: geist, fontSize: 34, lineHeight: 1.35, color: "#55524B", marginTop: 24 }}>{how}</div>
    </div>
  );
};

const Card = ({ kind, len }: { kind: "title" | "end"; len: number }) => {
  const frame = useCurrentFrame();
  const o = fadeInOut(frame, len);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: o, paddingBottom: 120 }}>
      <Orb size={180} />
      {kind === "title" ? (
        <>
          <div style={{ fontFamily: serif, fontSize: 200, color: INK, marginTop: 30, lineHeight: 1 }}>alltag</div>
          <div style={{ fontFamily: geist, fontSize: 44, color: "#55524B", marginTop: 24 }}>
            Learn French from the room you are in.
          </div>
        </>
      ) : (
        <>
          <div style={{ fontFamily: serif, fontSize: 120, color: INK, marginTop: 40, lineHeight: 1 }}>
            Look around. Speak. Remember.
          </div>
          <div style={{ fontFamily: mono, fontSize: 34, color: "#0E5C47", marginTop: 36 }}>https://alltag-xi.vercel.app</div>
          <div style={{ fontFamily: geist, fontSize: 30, color: "#55524B", marginTop: 18 }}>team Kenta</div>
        </>
      )}
    </AbsoluteFill>
  );
};

const Caption = ({ text, len }: { text: string; len: number }) => {
  const frame = useCurrentFrame();
  const o = fadeInOut(frame, len, 6);
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 48 }}>
      <div
        style={{
          maxWidth: 1500,
          fontFamily: geist,
          fontSize: 34,
          lineHeight: 1.3,
          color: "#fff",
          background: "rgba(27,26,23,.78)",
          borderRadius: 14,
          padding: "12px 26px",
          textAlign: "center",
          opacity: o,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

export const Stills = ({ audio, audioSeconds }: StillsProps) => {
  const { fps, durationInFrames } = useVideoConfig();
  const audioFrames = Math.round(audioSeconds * fps);
  const sections = split({ from: 0, len: audioFrames }, NARRATION.map(words));
  // The end section also covers the silent tail.
  sections[sections.length - 1].len = durationInFrames - sections[sections.length - 1].from;

  return (
    <AbsoluteFill style={{ background: LINEN }}>
      <Audio src={staticFile(audio)} />
      {SECTIONS.map((sec, i) => {
        const span = sections[i];
        if (sec.card === "title") {
          return (
            <Sequence key={i} from={span.from} durationInFrames={span.len}>
              <Card kind="title" len={span.len} />
            </Sequence>
          );
        }
        // End section: the boards briefly, then the end card.
        const [boardSpan, cardSpan] = sec.card === "end" ? split(span, [0.35, 0.65]) : [span, null];
        const shots = split(boardSpan, sec.boards.map(() => 1));
        return (
          <Sequence key={i} from={0}>
            {shots.map((s, j) => (
              <Sequence key={j} from={s.from} durationInFrames={s.len + (j < shots.length - 1 ? FADE : 0)}>
                <Phone board={sec.boards[j]} len={s.len + (j < shots.length - 1 ? FADE : 0)} />
              </Sequence>
            ))}
            <Sequence from={boardSpan.from} durationInFrames={boardSpan.len}>
              <Copy eyebrow={sec.eyebrow} headline={sec.card === "end" ? "Works offline." : sec.headline} how={sec.card === "end" ? "Cards keep, sync when you are back." : sec.how} len={boardSpan.len} />
            </Sequence>
            {cardSpan && (
              <Sequence from={cardSpan.from} durationInFrames={cardSpan.len}>
                <Card kind="end" len={cardSpan.len} />
              </Sequence>
            )}
          </Sequence>
        );
      })}
      <div style={{ position: "absolute", right: 64, top: 56 }}>
        <Orb size={72} />
      </div>
      {sections.map((span, i) => {
        const sentences = NARRATION[i].match(/[^.!?]+[.!?]+/g) ?? [NARRATION[i]];
        const parts = split(i === sections.length - 1 ? { from: span.from, len: audioFrames - span.from } : span, sentences.map(words));
        return parts.map((p, j) => (
          <Sequence key={`${i}-${j}`} from={p.from} durationInFrames={p.len}>
            <Caption text={sentences[j].trim()} len={p.len} />
          </Sequence>
        ));
      })}
    </AbsoluteFill>
  );
};
