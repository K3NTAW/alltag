import type { ButtonHTMLAttributes, ReactNode } from "react";

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> {
  "aria-label": string;
  variant?: "light" | "dark";
  children: ReactNode;
}

/** 44px floating circle for back, close and settings at the top corners (SNIPPETS D). */
export default function GlassButton({ variant = "light", className = "", children, type = "button", ...rest }: Props) {
  return (
    <button
      type={type}
      {...rest}
      className={`glass-${variant} glass-specular press flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-[22px] p-0 ${className}`}
    >
      {children}
    </button>
  );
}

export type MicState = "idle" | "listening" | "speaking" | "thinking";

/**
 * The 88px mic control face. Clear glass over night and camera, light glass on paper.
 * The caller owns the element, its handlers and its label.
 */
export function MicFace({ state, surface = "dark" }: { state: MicState; surface?: "light" | "dark" }) {
  const dot =
    state === "listening"
      ? "bg-moss"
      : state === "speaking"
        ? "bg-sun"
        : surface === "dark"
          ? state === "thinking"
            ? "bg-snow/30"
            : "bg-snow/60"
          : state === "thinking"
            ? "bg-ink/30"
            : "bg-ink/50";
  return (
    <span aria-hidden className="relative flex h-[104px] w-[104px] items-center justify-center">
      {state === "listening" && (
        <span className="absolute inset-0 rounded-[var(--radius-pill)] border border-moss opacity-20 motion-safe:animate-ping" />
      )}
      <span
        className={`${surface === "dark" ? "glass-clear" : "glass-light"} glass-specular flex h-[88px] w-[88px] items-center justify-center rounded-[var(--radius-pill)] border-2 ${
          surface === "dark" ? "border-snow/60" : "border-snow/90"
        }`}
      >
        {state === "listening" && <span className="absolute h-16 w-16 rounded-[var(--radius-pill)] border border-moss" />}
        <span className={`relative h-6 w-6 rounded-[var(--radius-pill)] ${dot}`} />
      </span>
    </span>
  );
}
