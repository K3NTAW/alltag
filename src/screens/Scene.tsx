import { useEffect, useRef, useState } from "react";
import { coverPoint } from "../lib/cover";
import { go } from "../lib/screen";
import { session } from "../lib/session";
import type { SceneObject } from "../lib/types";
import { findRecall } from "../srs/recall";
import * as store from "../srs/store";
import GlassButton from "../components/GlassButton";
import Orb from "../components/Orb";
import { useIsFullScreen } from "../components/TabBar";

type DotState = "known" | "due" | "new";

function dotState(fr: string, now: number): DotState {
  const card = store.byNoun(fr);
  if (!card) return "new";
  return card.reps > 0 && card.due <= now ? "due" : "known";
}

const dot: Record<DotState, string> = {
  due: "bg-[var(--sun-on-dark)] shadow-[0_0_0_3px_var(--glass-clear-bg)]",
  known: "bg-[var(--moss-on-dark)] shadow-[0_0_0_3px_var(--glass-clear-bg)]",
  new: "bg-snow shadow-[0_0_0_3px_var(--glass-clear-bg)]",
};

function Pill({
  obj,
  now,
  active,
  onOpen,
}: {
  obj: SceneObject;
  now: number;
  active: boolean;
  onOpen: () => void;
}) {
  const state = dotState(obj.fr, now);
  return (
    <button
      type="button"
      aria-label={obj.fr}
      data-state={state}
      onClick={onOpen}
      className={`${active ? "glass-dark" : "glass-clear"} glass-specular press flex h-[38px] cursor-pointer items-center gap-2 rounded-full pr-3.5 pl-2.5 whitespace-nowrap`}
    >
      <span
        aria-hidden
        className={`h-2 w-2 shrink-0 rounded-full ${dot[state]}`}
      />
      <span
        lang="fr"
        className="font-display text-[18px] leading-[22px] text-snow"
      >
        {obj.fr}
      </span>
    </button>
  );
}

const eyebrow =
  "font-mono text-[11px] leading-[14px] font-medium tracking-[0.08em] uppercase";
const chip = `inline-flex h-7 items-center rounded-[var(--radius-chip)] px-2.5 ${eyebrow}`;

export default function Scene() {
  const scene = session.scene;
  const [open, setOpen] = useState<SceneObject | null>(null);
  const [, setVersion] = useState(0);
  const [now] = useState(() => Date.now());
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  // Same condition App uses to show the tab bar.
  const tabbar = !useIsFullScreen();

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [scene]);

  if (!scene) {
    return (
      <section className="bg-night pb-tabbar screen-enter flex min-h-dvh flex-col items-center justify-center gap-4 px-5 text-[var(--night-text)]">
        <p className="text-[var(--night-text2)]">nothing seen yet</p>
        <button
          type="button"
          onClick={() => go("look")}
          className="press h-14 w-full max-w-sm rounded-[28px] bg-[var(--night-text)] text-[17px] leading-[22px] font-semibold text-ink shadow-[var(--glass-dark-shadow)]"
        >
          Look
        </button>
      </section>
    );
  }
  // Pills sit on their objects only once the photo is measured and the point is visible.
  const placed: { obj: SceneObject; x: number; y: number }[] = [];
  const stacked: SceneObject[] = [];
  for (const obj of scene.objects) {
    if (obj.bbox && nat && box && box.w > 0 && box.h > 0) {
      const [x, y, w, h] = obj.bbox;
      const p = coverPoint(x + w / 2, y + h / 2, nat.w, nat.h, box.w, box.h);
      if (p.x >= 0 && p.x <= box.w && p.y >= 0 && p.y <= box.h) {
        placed.push({ obj, x: p.x, y: p.y });
        continue;
      }
    }
    stacked.push(obj);
  }

  function keep(obj: SceneObject) {
    store.keep({
      phrase_fr: obj.phrase_fr,
      phrase_en: obj.phrase_en,
      noun_fr: obj.fr,
      objectId: obj.id,
      place: scene!.place,
      crop: session.frame ?? undefined,
    });
    setVersion((v) => v + 1);
  }

  function talk() {
    session.recallCardId = findRecall(scene!, store.all())?.id ?? null;
    go("roleplay");
  }

  return (
    <section className="relative h-dvh overflow-hidden bg-night text-[var(--night-text)]">
      <div ref={boxRef} className="absolute inset-0">
        {session.frame && (
          <img
            src={session.frame}
            alt={scene.place}
            onLoad={(e) =>
              setNat({
                w: e.currentTarget.naturalWidth,
                h: e.currentTarget.naturalHeight,
              })
            }
            className="fade-in absolute inset-0 block h-full w-full object-cover"
          />
        )}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[140px] bg-gradient-to-b from-[var(--camera-dim)] to-transparent"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[220px] bg-gradient-to-t from-[var(--camera-dim)] to-transparent"
        />
        {placed.map(({ obj, x, y }, i) => (
          <div
            key={obj.id}
            className="absolute -translate-x-[15px] translate-y-[calc(-100%+4px)]"
            style={{ left: x, top: y }}
          >
            <div
              className="pop-in flex flex-col items-start"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <Pill
                obj={obj}
                now={now}
                active={open?.id === obj.id}
                onOpen={() => setOpen(obj)}
              />
              <span aria-hidden className="ml-3.5 h-[18px] w-0.5 bg-snow/70" />
              <span
                aria-hidden
                className="ml-[11px] h-2 w-2 rounded-full bg-snow shadow-[0_0_0_4px_var(--glass-clear-bg)]"
              />
            </div>
          </div>
        ))}
      </div>
      <header className="pt-safe absolute inset-x-0 top-0 z-10 flex items-center gap-3 px-5">
        <GlassButton
          variant="dark"
          aria-label="look again"
          onClick={() => go("look")}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </GlassButton>
        <p className="glass-dark glass-specular mx-auto flex h-9 min-w-0 items-center rounded-full px-4 text-[13px] font-semibold">
          <span className="block truncate first-letter:uppercase">
            {scene.place} · {scene.objects.length}{" "}
            {scene.objects.length === 1 ? "thing" : "things"}
          </span>
        </p>
        <span aria-hidden className="w-11 shrink-0" />
      </header>

      <div
        className="sheet-up absolute inset-x-0 bottom-0 z-10 flex max-h-[45dvh] flex-col gap-1.5 overflow-y-auto rounded-t-[var(--radius-sheet)] border-t border-[var(--glass-dark-border)] bg-[var(--raised)] px-5 pt-6 [animation-delay:400ms]"
        style={
          tabbar
            ? {
                bottom:
                  "calc(var(--tabbar-h) + var(--tabbar-gap) + env(safe-area-inset-bottom))",
                paddingBottom: 20,
              }
            : { paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }
        }
      >
        <div className="flex items-center gap-2">
          <Orb size={28} />
          <p className={`${eyebrow} text-[var(--moss-on-dark)]`}>Noé</p>
        </div>
        <p lang="fr" className="font-display text-[24px] leading-[30px]">
          {scene.task.fr}
        </p>
        <p className="text-[15px] leading-[21px] text-[var(--night-text2)]">
          {scene.task.en}
        </p>

        {stacked.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {stacked.map((obj, i) => (
              <div
                key={obj.id}
                className="pop-in"
                style={{ animationDelay: `${(placed.length + i) * 70}ms` }}
              >
                <Pill
                  obj={obj}
                  now={now}
                  active={open?.id === obj.id}
                  onOpen={() => setOpen(obj)}
                />
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={talk}
          className="press mt-4 flex h-14 w-full shrink-0 items-center justify-center gap-2.5 rounded-[28px] bg-[var(--night-text)] text-[17px] leading-[22px] font-semibold text-ink shadow-[var(--glass-dark-shadow)]"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
          </svg>
          talk
        </button>
      </div>

      {open && (
        <div
          aria-hidden
          className="fade-in pointer-events-none fixed inset-0 z-40 bg-[var(--camera-dim)]"
        />
      )}
      {open && (
        <div
          role="dialog"
          aria-label={open.fr}
          className="bg-paper sheet-up fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[calc(100dvh-270px)] min-h-[60dvh] max-w-md flex-col overflow-y-auto rounded-t-[var(--radius-sheet)] px-5 pt-2 pb-[calc(24px+env(safe-area-inset-bottom))] text-ink shadow-[var(--e2)]"
        >
          <span
            aria-hidden
            className="mx-auto mb-3 block h-[5px] w-9 shrink-0 rounded-[3px] bg-ink/15"
          />
          <div className="flex items-start justify-between gap-3">
            <div className="flex gap-2">
              <span
                className={`${chip} bg-[var(--sun-soft)] text-[var(--sun-ink)]`}
              >
                {open.gender === "m" ? "masculine" : "feminine"}
              </span>
              <span className={`${chip} bg-[var(--sunken)] text-ink2`}>
                {open.level}
              </span>
            </div>
            <GlassButton aria-label="close" onClick={() => setOpen(null)}>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                aria-hidden
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </GlassButton>
          </div>
          <p
            lang="fr"
            className="rise-in mt-2 font-display text-[56px] leading-[56px] tracking-[-0.02em]"
          >
            {open.fr.startsWith(open.article)
              ? open.fr
              : `${open.article} ${open.fr}`}
          </p>
          <p className="mt-2 text-[15px] leading-[21px] text-ink2">{open.en}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span
              className={`${chip} bg-[var(--sunken)] text-ink2 normal-case tracking-normal`}
            >
              plural {open.plural}
            </span>
          </div>
          <div className="rise-in mt-5 flex flex-col gap-1.5 rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--e1)] [animation-delay:100ms]">
            <p lang="fr" className="font-display text-[24px] leading-[30px]">
              {open.phrase_fr}
            </p>
            <p className="text-[15px] leading-[21px] text-ink2">
              {open.phrase_en}
            </p>
          </div>
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={talk}
              className="press flex h-14 flex-1 items-center justify-center gap-2.5 rounded-[28px] bg-card text-[17px] leading-[22px] font-semibold shadow-[var(--e1)]"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <rect x="9" y="3" width="6" height="11" rx="3" />
                <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
              </svg>
              talk
            </button>
            <button
              type="button"
              onClick={() => keep(open)}
              className="press flex h-14 flex-1 items-center justify-center gap-2.5 rounded-[28px] bg-ink text-[17px] leading-[22px] font-semibold text-snow shadow-[var(--e2)]"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M6 4h12v17l-6-4-6 4z" />
              </svg>
              keep
            </button>
          </div>
          <p className="mt-3 text-center text-[13px] leading-[18px] text-ink2">
            Kept phrases come back for review.
          </p>
        </div>
      )}
    </section>
  );
}
