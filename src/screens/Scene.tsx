import { useState } from "react";
import { go } from "../lib/screen";
import { session } from "../lib/session";
import type { SceneObject } from "../lib/types";
import * as store from "../srs/store";

type DotState = "known" | "due" | "new";

function dotState(fr: string, now: number): DotState {
  const card = store.byNoun(fr);
  if (!card) return "new";
  return card.reps > 0 && card.due <= now ? "due" : "known";
}

function Pill({ obj, now, onOpen }: { obj: SceneObject; now: number; onOpen: () => void }) {
  const state = dotState(obj.fr, now);
  return (
    <button
      type="button"
      aria-label={obj.fr}
      data-state={state}
      onClick={onOpen}
      className="flex items-center gap-2 rounded-[var(--radius-pill)] bg-card px-3 py-1 text-[length:var(--text-s)] text-ink shadow"
    >
      {obj.fr}
      {state !== "new" && (
        <span
          aria-hidden
          className={`h-2 w-2 rounded-[var(--radius-pill)] ${state === "due" ? "bg-due" : "bg-accent"}`}
        />
      )}
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
      <section className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
        <p className="text-muted">nothing seen yet</p>
        <button
          type="button"
          onClick={() => go("look")}
          className="rounded-[var(--radius-pill)] bg-accent px-5 py-2 text-card"
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
    <section className="flex min-h-screen flex-col">
      <header className="flex items-start justify-between gap-3 p-4">
        <div>
          <p className="text-[length:var(--text-m)]">{scene.task.fr}</p>
          <p className="text-[length:var(--text-s)] text-muted">{scene.task.en}</p>
        </div>
        <button
          type="button"
          onClick={() => go("look")}
          className="shrink-0 rounded-[var(--radius-pill)] border border-line bg-card px-4 py-1 text-[length:var(--text-s)]"
        >
          look again
        </button>
      </header>

      <div className="relative">
        {session.frame && <img src={session.frame} alt={scene.place} className="block w-full" />}
        {placed.map((obj) => {
          const [x, y, w, h] = obj.bbox!;
          return (
            <div
              key={obj.id}
              className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
              style={{ left: `${(x + w / 2) * 100}%`, top: `${(y + h / 2) * 100}%` }}
            >
              <Pill obj={obj} now={now} onOpen={() => setOpen(obj)} />
              <span aria-hidden className="h-2 w-2 rounded-[var(--radius-pill)] bg-card" />
            </div>
          );
        })}
      </div>

      {stacked.length > 0 && (
        <div className="flex flex-wrap gap-2 p-4">
          {stacked.map((obj) => (
            <Pill key={obj.id} obj={obj} now={now} onOpen={() => setOpen(obj)} />
          ))}
        </div>
      )}

      {open && (
        <div role="dialog" aria-label={open.fr} className="fixed inset-x-0 bottom-0 rounded-t-[var(--radius-m)] bg-card p-6 shadow-lg">
          <div className="flex items-start justify-between">
            <p className="text-[length:var(--text-xl)]">
              {open.fr.startsWith(open.article) ? open.fr : `${open.article} ${open.fr}`}
            </p>
            <button type="button" onClick={() => setOpen(null)} className="text-muted" aria-label="close">
              close
            </button>
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
              className="flex-1 rounded-[var(--radius-pill)] border border-line px-4 py-2"
            >
              keep
            </button>
            <button
              type="button"
              onClick={() => go("roleplay")}
              className="flex-1 rounded-[var(--radius-pill)] bg-accent px-4 py-2 text-card"
            >
              talk
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
