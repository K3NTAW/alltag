import { useEffect } from "react";
import { useAuth } from "../auth/auth";
import * as store from "../srs/store";
import { getBackupStatus, runBackup, runRestore, setActiveUser } from "./backup";

const DEBOUNCE_MS = 3000;
const RETRY_MS = 60_000;

/** Drives the card backup while signed in. Renders nothing; no network otherwise. */
export default function BackupRunner() {
  const { status, userId } = useAuth();

  useEffect(() => {
    if (status !== "signed_in" || !userId) {
      setActiveUser(null);
      return;
    }
    setActiveUser(userId);
    let alive = true;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let restoreFailed = false;

    function afterRun() {
      if (!alive) return;
      if (getBackupStatus().state !== "error" && !restoreFailed) return;
      if (retry !== undefined) return;
      retry = setTimeout(() => {
        retry = undefined;
        void (restoreFailed ? restoreThenBackup() : backup());
      }, RETRY_MS);
    }

    async function restoreThenBackup() {
      const ok = await runRestore();
      if (!alive) return;
      restoreFailed = !ok && getBackupStatus().state === "error";
      await runBackup();
      afterRun();
    }

    async function backup() {
      await runBackup();
      afterRun();
    }

    const unsubscribe = store.subscribe(() => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        debounce = undefined;
        void backup();
      }, DEBOUNCE_MS);
    });
    const onOnline = () => void restoreThenBackup();
    window.addEventListener("online", onOnline);
    void restoreThenBackup();

    return () => {
      alive = false;
      clearTimeout(debounce);
      clearTimeout(retry);
      unsubscribe();
      window.removeEventListener("online", onOnline);
      setActiveUser(null);
    };
  }, [status, userId]);

  return null;
}
