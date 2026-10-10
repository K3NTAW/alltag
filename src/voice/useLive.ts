import { useCallback, useEffect, useRef, useState } from "react";
import { getLiveToken } from "../lib/api";
import type { TurnMessage } from "../lib/types";
import { LiveSession } from "./live";
import type { LiveConnectOptions, LiveDeps } from "./live";

export type LiveState = "idle" | "connecting" | "listening" | "speaking" | "done" | "error";

/** Connect options; the token is fetched from /api/live-token when omitted. */
export type LiveStartOptions = Omit<LiveConnectOptions, "token"> & { token?: string };

export function useLive(deps?: LiveDeps) {
  const [state, setState] = useState<LiveState>("idle");
  const [transcript, setTranscript] = useState<TurnMessage[]>([]);
  const [partialUser, setPartialUser] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const depsRef = useRef(deps);
  const sessionRef = useRef<LiveSession | null>(null);
  const doneRef = useRef(false);
  const genRef = useRef(0);

  useEffect(() => {
    depsRef.current = deps;
  });

  const stop = useCallback(() => {
    genRef.current += 1;
    const session = sessionRef.current;
    sessionRef.current = null;
    session?.close();
    doneRef.current = false;
    setPartialUser("");
    setState("idle");
  }, []);

  const start = useCallback(async (opts: LiveStartOptions) => {
    const gen = ++genRef.current;
    sessionRef.current?.close();
    sessionRef.current = null;
    doneRef.current = false;
    setTranscript([]);
    setPartialUser("");
    setError(undefined);
    setState("connecting");

    const session = new LiveSession(depsRef.current);
    sessionRef.current = session;
    const live = () => genRef.current === gen;
    const fail = (message: string) => {
      // A late error after the task is done (e.g. during the goodbye line) is not a failure.
      if (!live() || doneRef.current) return;
      setError(message);
      setState("error");
    };

    session.on("open", () => {
      if (live() && !doneRef.current) setState("listening");
    });
    session.on("speaking", (speaking) => {
      if (live() && !doneRef.current) setState(speaking ? "speaking" : "listening");
    });
    session.on("userText", ({ text, final }) => {
      if (!live()) return;
      if (final) {
        setPartialUser("");
        setTranscript((t) => [...t, { role: "learner", text }]);
      } else {
        setPartialUser(text);
      }
    });
    session.on("tutorText", ({ text, final }) => {
      if (live() && final) setTranscript((t) => [...t, { role: "tutor", text }]);
    });
    session.on("taskDone", () => {
      if (!live()) return;
      doneRef.current = true;
      setState("done");
    });
    session.on("error", fail);
    session.on("closed", () => {
      if (!live()) return;
      sessionRef.current = null;
      setState((s) => (s === "done" || s === "error" ? s : "idle"));
    });

    try {
      let { token, model } = opts;
      if (!token) {
        // Use the model the token is constrained to so client and route cannot drift.
        const res = await getLiveToken();
        token = res.token;
        model ??= res.model;
      }
      if (!live()) return;
      await session.connect({ ...opts, token, model });
    } catch (e) {
      fail(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(
    () => () => {
      genRef.current += 1;
      sessionRef.current?.close();
      sessionRef.current = null;
    },
    [],
  );

  return { state, transcript, partialUser, start, stop, error };
}
