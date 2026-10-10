import { useEffect, useState, useSyncExternalStore, type ChangeEvent } from "react";
import { getSettings, setSettings, type Settings as SettingsShape } from "../lib/settings";
import type { Level } from "../lib/types";
import * as store from "../srs/store";
import { gemma, MODEL_FILE, type GemmaStatus } from "../offline/gemma";

const levels: Level[] = ["A1", "A2", "B1", "B2"];

const voices = [
  { id: "YKeBw3OV1RgpdhLh", name: "Jules" },
  { id: "biuhvu17TxVKOcyy", name: "Marius" },
  { id: "iEu63s1rhn_kegTr", name: "Gaspard" },
  { id: "YhIHaAfQ0cQPDV9R", name: "Solène" },
  { id: "FXxJ9mANRq6BCTX5", name: "Noémie" },
];

const modelUrl = (import.meta.env.VITE_GEMMA_MODEL_URL as string | undefined) || "";

function statusText(s: GemmaStatus): string {
  switch (s.state) {
    case "unavailable":
      return "not supported in this browser (needs webgpu)";
    case "absent":
      return "not installed";
    case "loading":
      return s.progress === undefined ? "loading" : `loading ${s.progress} %`;
    case "ready":
      return "ready";
    case "error":
      return s.reason ? `error: ${s.reason}` : "error";
  }
}

const row = "flex flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-card p-4";
const control = "rounded-[var(--radius-button)] border border-line bg-card px-3 py-2";

export default function Settings() {
  const [settings, setLocal] = useState(getSettings);
  const [cleared, setCleared] = useState(false);

  function update(partial: Partial<SettingsShape>) {
    setLocal(setSettings(partial));
  }

  function clearAll() {
    if (!window.confirm("clear everything? this removes every kept phrase.")) return;
    store.clear();
    setCleared(true);
  }

  return (
    <section className="flex flex-col gap-3 p-[var(--gutter)]">
      <h1 className="text-[length:var(--text-h1)] leading-[var(--lh-h1)]">settings</h1>

      <div className={row}>
        <span className="text-muted">language</span>
        <span>french</span>
      </div>

      <label className={row}>
        <span className="text-muted">level</span>
        <select
          value={settings.level}
          onChange={(e) => update({ level: e.target.value as Level })}
          className={control}
        >
          {levels.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </label>

      <label className={row}>
        <span className="text-muted">voice</span>
        <select value={settings.voiceId} onChange={(e) => update({ voiceId: e.target.value })} className={control}>
          {voices.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </label>

      <label className={row}>
        <span className="text-muted">speed {settings.speed.toFixed(1)}</span>
        <input
          type="range"
          min={0.8}
          max={1.2}
          step={0.1}
          value={settings.speed}
          onChange={(e) => update({ speed: Number(e.target.value) })}
          className="accent-[var(--moss)]"
        />
      </label>

      <OfflineTutor />

      <div className={row}>
        <span className="text-muted">data</span>
        <p className="text-[length:var(--text-small)] text-muted">everything stays in this browser</p>
        <button
          type="button"
          onClick={clearAll}
          className="self-start rounded-[var(--radius-pill)] border border-line px-4 py-2 text-[var(--clay)]"
        >
          clear everything
        </button>
        {cleared && <p className="text-[length:var(--text-small)] text-muted">cleared</p>}
      </div>
    </section>
  );
}

function OfflineTutor() {
  const status = useSyncExternalStore(gemma.subscribe, gemma.status);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    void gemma.refresh();
  }, []);

  function run(job: Promise<void>) {
    setFailed(null);
    job.catch((e: unknown) => setFailed(e instanceof Error ? e.message : "could not install"));
  }

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) run(gemma.importFile(file));
  }

  function remove() {
    if (!window.confirm("remove the offline tutor? you will need to pick the file again.")) return;
    run(gemma.remove());
  }

  const busy = status.state === "loading";
  const usable = status.state !== "unavailable";

  return (
    <div className={row}>
      <span className="text-muted">offline tutor</span>
      <p data-testid="offline-status">{statusText(status)}</p>
      {usable &&
        (modelUrl ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => run(gemma.importUrl(modelUrl))}
            className="self-start rounded-[var(--radius-pill)] border border-line px-4 py-2 disabled:opacity-50"
          >
            download
          </button>
        ) : (
          <label className="flex flex-col gap-1">
            <span className="text-[length:var(--text-small)]">choose {MODEL_FILE}</span>
            <input
              type="file"
              accept=".task"
              aria-label={`choose ${MODEL_FILE}`}
              disabled={busy}
              onChange={onFile}
              className={control}
            />
          </label>
        ))}
      {usable && (status.state === "ready" || status.state === "error") && (
        <button
          type="button"
          onClick={remove}
          className="self-start rounded-[var(--radius-pill)] border border-line px-4 py-2 text-[var(--clay)]"
        >
          remove
        </button>
      )}
      {failed && <p className="text-[length:var(--text-small)] text-muted">{failed}</p>}
      <p className="text-[length:var(--text-small)] text-muted">
        when the network is gone, noé runs on gemma 3 1b in this browser. get {MODEL_FILE} (about 700 mb) from{" "}
        <a
          href="https://huggingface.co/litert-community/Gemma3-1B-IT"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          hugging face
        </a>
        . you accept the gemma licence there first. the file stays in this browser.
      </p>
    </div>
  );
}
