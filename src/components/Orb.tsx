export type OrbSize = 28 | 44 | 96 | 168;
export type OrbState = "idle" | "listening" | "thinking" | "speaking";

// Orb gradient (STYLE-V3 section 2), only inside the orb and its glow.
export const ORB_GRADIENT = "conic-gradient(from 0deg, #0E5C47, #2FA37F, #BFE8D6, #F0C766, #2FA37F, #0E5C47)";

const motion: Record<OrbState, string> = {
  idle: "orb-breathe",
  listening: "orb-listen",
  thinking: "orb-think",
  speaking: "orb-speak",
};

const ring: Partial<Record<OrbState, string>> = {
  listening: "rgba(47,163,127,0.55)",
  speaking: "rgba(240,199,102,0.6)",
};

interface Props {
  size?: OrbSize;
  state?: OrbState;
  className?: string;
}

/** The Noé orb (SNIPPETS C): one element, four states, same construction at every size. */
export default function Orb({ size = 44, state = "idle", className = "" }: Props) {
  const rings = ring[state];
  const glow = state === "listening" ? 0.6 : 0.38;
  return (
    <div className={`inline-flex shrink-0 flex-col items-center gap-2 ${className}`}>
      <div
        role="img"
        aria-label={`Noé, ${state}`}
        data-state={state}
        className={`relative shrink-0 ${motion[state]}`}
        style={{ width: size, height: size }}
      >
        {rings && (
          <>
            <div className="orb-ring absolute inset-0 rounded-full" style={{ border: `2px solid ${rings}` }} />
            <div className="orb-ring absolute inset-0 rounded-full" style={{ border: `2px solid ${rings}` }} />
          </>
        )}
        <div
          className="orb-glow absolute rounded-full"
          style={{
            inset: "-18%",
            background: `radial-gradient(closest-side, rgba(47,163,127,${glow}), rgba(47,163,127,0))`,
            filter: "blur(10px)",
          }}
        />
        <div
          className="orb-core absolute inset-0 overflow-hidden rounded-full"
          style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.35), 0 14px 36px rgba(14,92,71,0.28)" }}
        >
          <div className="orb-spin absolute" style={{ inset: "-35%", background: ORB_GRADIENT, filter: "blur(14px)" }} />
          <div
            className="absolute inset-0 rounded-full"
            style={{ background: "radial-gradient(55% 45% at 34% 26%, rgba(255,255,255,0.78), rgba(255,255,255,0) 62%)" }}
          />
        </div>
      </div>
      {state === "thinking" && (
        <div aria-hidden className="flex justify-center gap-1.5">
          <span className="orb-dot h-1.5 w-1.5 rounded-full bg-current" />
          <span className="orb-dot h-1.5 w-1.5 rounded-full bg-current" />
          <span className="orb-dot h-1.5 w-1.5 rounded-full bg-current" />
        </div>
      )}
    </div>
  );
}
