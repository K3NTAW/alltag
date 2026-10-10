import { useEffect, useState, useSyncExternalStore, type ChangeEvent } from "react";
import { getSettings, setSettings, type Settings as SettingsShape } from "../lib/settings";
import type { Level } from "../lib/types";
import * as store from "../srs/store";
import { gemma, MODEL_FILE, MODEL_LABEL, MODEL_LICENCE, type GemmaStatus } from "../offline/gemma";
import { useInstallPrompt } from "../pwa/install";
import { useAuth } from "../auth/auth";
import { useBackupStatus, type BackupStatus } from "../sync/backup";
import Orb from "../components/Orb";

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
      return s.source === "bundled" ? "ready, built into the app" : "ready";
    case "error":
      return s.reason ? `error: ${s.reason}` : "error";
  }
}

function backupText(s: BackupStatus): string {
  switch (s.state) {
    case "ok": {
      if (s.lastOkAt === null) return "ready";
      const time = new Date(s.lastOkAt).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Europe/Zurich",
      });
      return `backed up ${time}`;
    }
    case "working":
      return "backing up…";
    case "error":
      return "backup failed, will retry";
    case "offline":
      return "offline, will back up later";
    case "off":
      return "ready";
  }
}

const eyebrow =
  "mx-5 mb-2 font-mono text-[11px] leading-[14px] font-medium tracking-[0.08em] text-ink2 uppercase";
const card = "overflow-hidden rounded-[var(--radius-card)] bg-card shadow-[var(--e1)]";
const panel = `${card} flex flex-col gap-3 p-5`;
// Grouped list row: 56 tall, hairline inset 20 from the left, none under the last row.
const row = "flex min-h-14 items-stretch pl-5 [&:last-child>*]:border-b-0";
const rowInner = "flex flex-1 items-center justify-between gap-3 border-b border-line py-2 pr-4";
const rowLabel = "text-[16px] leading-[21px]";
const control =
  "rounded-[var(--radius-chip)] bg-[var(--sunken)] px-3 py-1.5 text-[15px] leading-[20px] text-ink2";
const footnote = "text-[13px] leading-[18px] text-ink2";
const secondary =
  "press inline-flex h-10 items-center self-start rounded-[var(--radius-pill)] bg-[var(--sunken)] px-[18px] text-[15px] leading-[20px] font-semibold";
const primary =
  "press inline-flex h-10 items-center self-start rounded-[var(--radius-pill)] bg-ink px-[18px] text-[15px] leading-[20px] font-semibold text-snow shadow-[0_6px_16px_rgba(18,19,22,0.16)]";

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
    <section className="screen-enter pt-safe pb-tabbar flex flex-col gap-6 px-[var(--gutter)]">
      <h1 className="mt-2 text-[40px] leading-[44px] tracking-[-0.01em] text-ink">Settings</h1>

      <AccountSection />

      <div>
        <div className={eyebrow}>learning</div>
        <div className={card}>
          <div className={row}>
            <div className={rowInner}>
              <span className={rowLabel}>language</span>
              <span lang="fr" className="font-display text-[18px] leading-[22px] text-ink2">
                Français
              </span>
            </div>
          </div>

          <label className={row}>
            <span className={rowInner}>
              <span className={rowLabel}>level</span>
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
            </span>
          </label>

          <label className={row}>
            <span className={rowInner}>
              <span className={rowLabel}>voice</span>
              <select
                value={settings.voiceId}
                onChange={(e) => update({ voiceId: e.target.value })}
                className={control}
              >
                {voices.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </span>
          </label>

          <label className={row}>
            <span className={rowInner}>
              <span className={rowLabel}>speed {settings.speed.toFixed(1)}</span>
              <input
                type="range"
                min={0.8}
                max={1.2}
                step={0.1}
                value={settings.speed}
                onChange={(e) => update({ speed: Number(e.target.value) })}
                className="w-[148px] accent-[var(--moss)]"
              />
            </span>
          </label>
        </div>
      </div>

      <OnYourPhone />

      <OfflineTutor />

      <div>
        <div className={eyebrow}>data</div>
        <div className={card}>
          <div className={row}>
            <p className={`${rowInner} ${footnote}`}>everything stays in this browser</p>
          </div>
          <div className={row}>
            <div className={rowInner}>
              <button
                type="button"
                onClick={clearAll}
                className="press min-h-11 flex-1 text-left text-[16px] leading-[21px] text-clay"
              >
                clear everything
              </button>
              {cleared && <p className={footnote}>cleared</p>}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function AccountSection() {
  const { status, address, openAccount, signOut } = useAuth();
  const backup = useBackupStatus();

  let body;
  if (status === "disabled") {
    body = <p className={footnote}>sync is off in this build</p>;
  } else if (status === "loading") {
    body = <p className={footnote}>checking your account…</p>;
  } else if (status === "signed_out") {
    body = (
      <>
        <p className={footnote}>
          sign in to sync your words, scenes and conversations across devices. everything also works without an account.
        </p>
        <button type="button" onClick={openAccount} className={`${primary} mt-1`}>
          sign in
        </button>
      </>
    );
  } else {
    body = (
      <>
        <p data-testid="account-address" className="truncate text-[16px] leading-[21px]">
          {address}
        </p>
        <p className={footnote}>signed in</p>
        <div className="flex items-center justify-between gap-3">
          <span className={footnote}>sync</span>
          <span
            data-testid="sync-state"
            className="inline-flex h-6 items-center rounded-[12px] bg-moss-soft px-[9px] font-mono text-[10px] leading-[14px] font-medium tracking-[0.08em] text-moss uppercase"
          >
            {backupText(backup)}
          </span>
        </div>
        <button type="button" onClick={() => void signOut()} className={`${secondary} mt-1`}>
          sign out
        </button>
      </>
    );
  }

  return (
    <div className={`${card} flex items-start gap-3.5 py-4 pr-4 pl-5`} data-testid="account">
      <Orb size={44} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[17px] leading-[22px] font-semibold">account</span>
        {body}
      </div>
    </div>
  );
}

function OnYourPhone() {
  const { canInstall, install, platform, installed } = useInstallPrompt();

  let body;
  if (installed) {
    body = <p className="text-[16px] leading-[21px]">installed. works offline.</p>;
  } else if (canInstall) {
    body = (
      <button type="button" onClick={() => void install()} className={secondary}>
        add to home screen
      </button>
    );
  } else if (platform === "ios") {
    body = (
      <ol className="flex list-inside list-decimal flex-col gap-1 text-[15px] leading-[21px]">
        <li>open in safari</li>
        <li>tap share</li>
        <li>add to home screen</li>
      </ol>
    );
  } else {
    body = <p className={footnote}>open this page on your phone to install it</p>;
  }

  return (
    <div data-testid="on-your-phone">
      <div className={eyebrow}>on your phone</div>
      <div className={panel}>{body}</div>
    </div>
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
  const builtIn = status.source === "bundled";
  const usable = status.state !== "unavailable" && !builtIn;
  const installed = builtIn || status.state === "ready";

  return (
    <div>
      <div className={eyebrow}>offline tutor</div>
      <div className={panel}>
        <p
          data-testid="offline-status"
          className={`text-[16px] leading-[21px] ${installed ? "text-moss" : "text-ink"}`}
        >
          {statusText(status)}
        </p>
        {usable &&
          (modelUrl ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => run(gemma.importUrl(modelUrl))}
              className={`${secondary} disabled:opacity-50`}
            >
              download
            </button>
          ) : (
            <label className="flex flex-col gap-1">
              <span className={footnote}>choose {MODEL_FILE}</span>
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
          <button type="button" onClick={remove} className={`${secondary} text-clay`}>
            remove
          </button>
        )}
        {failed && <p className={footnote}>{failed}</p>}
        {installed && (
          <p className={footnote}>
            on-device model: {MODEL_LABEL},{" "}
            <a href={MODEL_LICENCE.url} target="_blank" rel="noreferrer" className="underline">
              {MODEL_LICENCE.name}
            </a>
          </p>
        )}
        {!builtIn && (
          <p className={footnote}>
            when the network is gone, noé runs on gemma 4 e2b in this browser. get {MODEL_FILE} (about 2 gb) from{" "}
            <a
              href="https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              hugging face
            </a>
            . the file stays in this browser.
          </p>
        )}
      </div>
    </div>
  );
}
