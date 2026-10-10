import { useState } from "react";
import { go } from "../lib/screen";
import { session } from "../lib/session";
import type { SceneObject } from "../lib/types";
import { findRecall } from "../srs/recall";
import * as store from "../srs/store";
import GlassButton from "../components/GlassButton";

type DotState = "known" | "due" | "new";

function dotState(fr: string, now: number): DotState {
  const card = store.byNoun(fr);
  if (!card) return "new";
  return card.reps > 0 && card.due <= now ? "due" : "known";
}

function Pill({ obj, now, active, onOpen }: { obj: SceneObject; now: number; active: boolean; onOpen: () => void }) {
  const state = dotState(obj.fr, now);
  return (
    <button
      type="button"
      aria-label={obj.fr}
      data-state={state}
      onClick={onOpen}
      className={`${active ? "glass-dark" : "glass-clear"} glass-specular flex h-9 items-center gap-2 rounded-[18px] px-3 text-[15px] font-semibold whitespace-nowrap`}
    >
      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-[var(--radius-pill)] ${state === "due" ? "bg-sun" : state === "known" ? "bg-moss" : "bg-moss/60"}`}
      />
      {obj.fr}
    </button>
  );
}

export default function Scene() {
  const scene = session.scene;
  const [open, setOpen] = useState<SceneObject | null>(null);
  const [, setVersion] = useState(0);
  const [now] = useState(() => Date.now());

  if (!scene) {
    return (
      <section className="pb-tabbar flex min-h-dvh flex-col items-center justify-center gap-4 p-6">
        <p className="text-muted">nothing seen yet</p>
        <button
          type="button"
          onClick={() => go("look")}
          className="rounded-[26px] bg-accent px-6 py-3 text-[length:var(--text-m)] font-semibold text-card"
        >
          look
        </button>
      </section>
    );
  }

  const placed = scene.objects.filter((o) => o.bbox);
  const stacked = scene.objects.filter((o) => !o.bbox);

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

  return (
    <section className="bg-night pb-tabbar flex min-h-dvh flex-col text-snow">
      <div className="relative min-h-[120px]">
        {session.frame && <img src={session.frame} alt={scene.place} className="block w-full" />}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[120px] bg-gradient-to-b from-[var(--camera-dim)] to-transparent" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[160px] bg-gradient-to-t from-[var(--camera-dim)] to-transparent" />
        <header className="pt-safe absolute inset-x-0 top-0 z-10 flex items-center gap-3 px-4">
          <GlassButton variant="dark" aria-label="look again" onClick={() => go("look")}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </GlassButton>
          <p className="glass-dark glass-specular flex h-9 min-w-0 items-center rounded-[18px] px-4 text-[15px] font-semibold">
            <span className="truncate">{scene.task.fr}</span>
          </p>
        </header>
        {placed.map((obj) => {
          const [x, y, w, h] = obj.bbox!;
          return (
            <div
              key={obj.id}
              className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
              style={{ left: `${(x + w / 2) * 100}%`, top: `${(y + h / 2) * 100}%` }}
            >
              <Pill obj={obj} now={now} active={open?.id === obj.id} onOpen={() => setOpen(obj)} />
              <span aria-hidden className="h-2 w-2 rounded-[var(--radius-pill)] bg-snow" />
            </div>
          );
        })}
      </div>

      <p className="px-4 pt-4 text-[length:var(--text-s)] text-snow/72">{scene.task.en}</p>

      {stacked.length > 0 && (
        <div className="flex flex-wrap gap-2 p-4">
          {stacked.map((obj) => (
            <Pill key={obj.id} obj={obj} now={now} active={open?.id === obj.id} onOpen={() => setOpen(obj)} />
          ))}
        </div>
      )}

      {open && (
        <div
          role="dialog"
          aria-label={open.fr}
          className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md rounded-t-[var(--radius-sheet)] bg-paper/96 px-6 pt-2 pb-[calc(24px+env(safe-area-inset-bottom))] text-ink shadow-lg backdrop-blur-[20px]"
        >
          <span aria-hidden className="mx-auto mb-3 block h-[5px] w-9 rounded-[var(--radius-pill)] bg-[#C9C7C1]" />
          <div className="flex items-start justify-between">
            <p className="font-display text-[length:var(--text-xl)] leading-[var(--lh-h2)] font-bold">
              {open.fr.startsWith(open.article) ? open.fr : `${open.article} ${open.fr}`}
            </p>
            <GlassButton aria-label="close" onClick={() => setOpen(null)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </GlassButton>
          </div>
          <p className="text-[length:var(--text-s)] text-muted">
            {open.gender === "m" ? "masculine" : "feminine"} · plural {open.plural}
          </p>
          <p className="mt-4 text-[length:var(--text-l)]">{open.phrase_fr}</p>
          <p className="text-[length:var(--text-s)] text-muted">{open.phrase_en}</p>
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={() => keep(open)}
              className="h-[52px] flex-1 rounded-[26px] border border-line bg-card px-4 text-[length:var(--text-m)] font-semibold"
            >
              keep
            </button>
            <button
              type="button"
              onClick={() => {
                session.recallCardId = findRecall(scene, store.all())?.id ?? null;
                go("roleplay");
              }}
              className="h-[52px] flex-1 rounded-[26px] bg-accent px-4 text-[length:var(--text-m)] font-semibold text-card"
            >
              talk
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
