import type { Card, SceneResult } from "../lib/types";

const ARTICLE = /^(?:les|le|la|l'|une|un|des)\s*/;

function clean(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’]/g, "'")
    .trim();
}

export function normalizeNoun(s: string): string {
  const c = clean(s);
  const m = c.match(ARTICLE);
  // only drop "le"/"la"/... when followed by a space; "l'" may be glued to the noun
  if (m && (m[0].endsWith(" ") || m[0] === "l'")) return c.slice(m[0].length).trim();
  return c;
}

export function findRecall(scene: SceneResult, cards: Card[], now = Date.now()): Card | null {
  const nouns = new Set(scene.objects.map((o) => normalizeNoun(o.fr)));
  const hits = cards
    .filter((c) => c.noun_fr !== undefined && c.due <= now && nouns.has(normalizeNoun(c.noun_fr)))
    .sort((a, b) => a.due - b.due);
  return hits[0] ?? null;
}

function levenshtein(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

function cleanPhrase(s: string): string {
  return clean(s)
    .replace(/[^\p{L}\p{N}' ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function similarity(a: string, b: string): number {
  const x = cleanPhrase(a);
  const y = cleanPhrase(b);
  const len = Math.max(x.length, y.length);
  if (len === 0) return 1;
  return 1 - levenshtein(x, y) / len;
}

export function gradeFromTranscript(transcript: string, target: string): 0 | 1 | 3 | 5 {
  if (cleanPhrase(transcript) === "") return 0;
  const s = similarity(transcript, target);
  if (s >= 0.85) return 5;
  if (s >= 0.6) return 3;
  return 1;
}
