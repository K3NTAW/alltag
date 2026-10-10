export type Level = "A1" | "A2" | "B1" | "B2";
export type Gender = "m" | "f";

export interface SceneObject {
  id: string;
  fr: string;
  en: string;
  article: string;
  gender: Gender;
  plural: string;
  level: Level;
  phrase_fr: string;
  phrase_en: string;
  /** x, y, w, h as 0..1 fractions of the frame */
  bbox?: [number, number, number, number];
}

export interface SceneTask {
  fr: string;
  en: string;
  role: string;
}

export interface SceneResult {
  place: string;
  objects: SceneObject[];
  task: SceneTask;
}

export interface SceneRequest {
  imageBase64: string;
  level: Level;
  knownWords: string[];
}

export interface TurnMessage {
  role: "tutor" | "learner";
  text: string;
}

export interface TurnRequest {
  scene: SceneResult;
  history: TurnMessage[];
  userText: string;
  level: Level;
}

export interface TurnResponse {
  reply_fr: string;
  reply_en: string;
  task_done: boolean;
  /** "local" when answered by the on-device model */
  source?: "cloud" | "local";
}

export type CorrectionType =
  | "article"
  | "gender"
  | "case"
  | "tense"
  | "word_order"
  | "vocab"
  | "register";

export interface Correction {
  said: string;
  better: string;
  type: CorrectionType;
  why_en: string;
}

export interface CorrectRequest {
  scene: SceneResult;
  userText: string;
  level: Level;
}

export interface CorrectResponse {
  corrections: Correction[];
  kept_phrase_fr: string;
  /** "local" when answered by the on-device model */
  source?: "cloud" | "local";
}

export interface Card {
  id: string;
  phrase_fr: string;
  phrase_en: string;
  noun_fr?: string;
  objectId?: string;
  /** JPEG data URL */
  crop?: string;
  place?: string;
  /** "phrase" for phrases kept from a listened conversation */
  errorType?: CorrectionType | "phrase";
  ease: number;
  /** days */
  interval: number;
  reps: number;
  /** epoch ms */
  due: number;
  /** epoch ms */
  learnedAt: number;
}

export interface GradiumToken {
  token: string;
  expires_at: string;
}

export interface TranslateRequest {
  text: string;
  from: "fr";
  to: "en";
}

export interface TranslateResponse {
  text: string;
}

export type ExtractType = "phrase" | "expression" | "word";

export interface ExtractRequest {
  lines: { fr: string; en: string }[];
  level: Level;
  knownWords: string[];
}

export interface ExtractItem {
  fr: string;
  en: string;
  why: string;
  type: ExtractType;
  noun_fr?: string;
}

export interface ExtractResponse {
  keep: ExtractItem[];
  known: string[];
  advanced: { fr: string; en: string }[];
}

export interface ConversationLine {
  fr: string;
  en: string;
  kept: boolean;
}

export interface Conversation {
  id: string;
  /** ISO timestamp */
  startedAt: string;
  durationS: number;
  lines: ConversationLine[];
  keptCount: number;
  place?: string;
}
