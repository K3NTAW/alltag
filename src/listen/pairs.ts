/** One userText (French) or tutorText (English) event from the listen session. */
export interface PairEvent {
  kind: "user" | "tutor";
  text: string;
  final: boolean;
}

export interface Pair {
  id: string;
  fr: string;
  en: string;
  /** true once the translation for this utterance has arrived */
  final: boolean;
  kept: boolean;
}

/**
 * Reduces the event stream into French/English pairs, one per utterance.
 * A user event opens a pair (partials update its fr until the final one);
 * tutor text fills the newest pair whose French is final, and its final closes it.
 * Older pairs still waiting when a later one closes got no translation and close empty.
 */
export function pairLines(events: PairEvent[], idPrefix = "p"): Pair[] {
  const pairs: Pair[] = [];
  const frDone: boolean[] = [];
  for (const ev of events) {
    const text = ev.text.trim();
    if (ev.kind === "user") {
      const i = pairs.length - 1;
      if (i >= 0 && !frDone[i]) {
        pairs[i] = { ...pairs[i], fr: text };
        frDone[i] = ev.final;
      } else if (text) {
        pairs.push({ id: `${idPrefix}${pairs.length}`, fr: text, en: "", final: false, kept: false });
        frDone.push(ev.final);
      }
      continue;
    }
    let target = -1;
    for (let i = pairs.length - 1; i >= 0; i--) {
      if (frDone[i] && !pairs[i].final) {
        target = i;
        break;
      }
    }
    if (target < 0) continue;
    pairs[target] = { ...pairs[target], en: text, final: ev.final };
    if (ev.final) {
      for (let i = 0; i < target; i++) {
        if (frDone[i] && !pairs[i].final) pairs[i] = { ...pairs[i], final: true };
      }
    }
  }
  return pairs;
}
