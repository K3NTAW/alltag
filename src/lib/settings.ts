import type { Level } from "./types";

export interface Settings {
  language: "fr";
  level: Level;
  voiceId: string;
  speed: number;
}

const KEY = "alltag.settings";

const defaults: Settings = {
  language: "fr",
  level: "A1",
  voiceId: "YKeBw3OV1RgpdhLh",
  speed: 1,
};

export function getSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...defaults };
    return { ...defaults, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return { ...defaults };
  }
}

export function setSettings(partial: Partial<Settings>): Settings {
  const next = { ...getSettings(), ...partial };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
