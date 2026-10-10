/** One userText (French) or tutorText event from the listen session. Only French builds pairs. */
export interface PairEvent {
  kind: "user" | "tutor";
  text: string;
  final: boolean;
}

export interface Pair {
  id: string;
  fr: string;
  en: string;
  /**
   * From pairLines: true once the French is final.
   * On screen: true once its /api/translate result arrived (or failed).
   */
  final: boolean;
  kept: boolean;
}

/**
 * Reduces the event stream into French pairs, one per utterance, with en left empty.
 * A user event opens a pair (partials update its fr until the final one closes it).
 * Tutor text is ignored: the Live model answers instead of translating, so the
 * English comes from /api/translate once the French is final.
 */
export function pairLines(events: PairEvent[], idPrefix = "p"): Pair[] {
  const pairs: Pair[] = [];
  for (const ev of events) {
    if (ev.kind !== "user") continue;
    const text = ev.text.trim();
    const i = pairs.length - 1;
    if (i >= 0 && !pairs[i].final) {
      pairs[i] = { ...pairs[i], fr: text, final: ev.final };
    } else if (text) {
      pairs.push({ id: `${idPrefix}${pairs.length}`, fr: text, en: "", final: ev.final, kept: false });
    }
  }
  return pairs;
}
