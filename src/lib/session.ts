import type { Correction, SceneResult, TurnMessage } from "./types";

export interface Session {
  scene: SceneResult | null;
  /** JPEG data URL of the frozen frame */
  frame: string | null;
  recallCardId: string | null;
  lastExchange: {
    transcript: TurnMessage[];
    corrections: Correction[];
    kept_phrase_fr: string[];
  } | null;
}

export const session: Session = {
  scene: null,
  frame: null,
  recallCardId: null,
  lastExchange: null,
};

export function resetSession(): void {
  session.scene = null;
  session.frame = null;
  session.recallCardId = null;
  session.lastExchange = null;
}
