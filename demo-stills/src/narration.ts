// Copied verbatim from the voice-over script (s01..s12).
export const NARRATION: string[] = [
  "This is Alltag. You learn French from the room you're in. No lessons, no streaks. Just your phone, what's around you, and Noé, your tutor.",
  "Point the camera at anything. Alltag sends one photo to Gemini vision, and in about three seconds every object gets a French label at your level. Green dots are words you know, yellow ones are due for review, white ones are new.",
  "Tap a label to see the article, the gender, the plural, and a phrase you would actually say right here. One tap keeps it.",
  "Then Noé gives you a small task in that exact scene. Tap talk and just speak. Noé listens and answers out loud in real time, through Gemini Live, and you can interrupt whenever you like.",
  "After the exchange you get calm, typed corrections: what you said, what's better, and why. Every phrase you fumbled goes into your review queue.",
  "Review is spoken, not tapped. You see the English, you say the French, a grader checks it, and spaced repetition decides when it comes back.",
  "And when the camera sees that object again, Noé opens with it, so review happens in real life.",
  "The diary keeps every scene and phrase you kept, by place.",
  "Listen mode is for real conversations. Alltag hears the French around you, shows each line with its English translation, and afterwards picks the phrases worth learning.",
  "No signal? A Gemma 4 model runs on the phone itself, so the tutor still works offline.",
  "Accounts are optional. Sign in to back up your cards to a server in Zurich and get them back on a new phone.",
  "Alltag runs as an iPhone app and on the web, built with Gemini, Gradium voice, Supabase and Vercel. Look around. Speak. Remember.",
];

export type Section = { boards: string[]; eyebrow: string; headline: string; how: string; card?: "title" | "end" };

export const SECTIONS: Section[] = [
  { card: "title", boards: [], eyebrow: "Alltag", headline: "alltag", how: "Learn French from the room you are in." },
  { boards: ["CameraIdle", "CameraScanning", "SceneLabels"], eyebrow: "Scene", headline: "Point at anything.", how: "One photo to Gemini vision, French labels in about three seconds." },
  { boards: ["ObjectSheet"], eyebrow: "Object sheet", headline: "Every word, in context.", how: "Article, gender, plural and a phrase for right here." },
  { boards: ["RoleplayStart", "RoleplayListening", "RoleplayReply"], eyebrow: "Roleplay", headline: "Talk to Noé.", how: "Real-time voice through Gemini Live. Interrupt any time." },
  { boards: ["Corrections", "ExchangeDone"], eyebrow: "Corrections", headline: "Calm, typed feedback.", how: "What you said, what is better, and why." },
  { boards: ["ReviewQueue", "ReviewCard", "ReviewResult"], eyebrow: "Review", headline: "Spoken, not tapped.", how: "See the English, say the French, spaced repetition does the rest." },
  { boards: ["RecallTrigger"], eyebrow: "Recall", headline: "Review in real life.", how: "When the camera sees it again, Noé opens with it." },
  { boards: ["Diary"], eyebrow: "Diary", headline: "Kept, by place.", how: "Every scene and phrase you kept." },
  { boards: ["ListenIdle", "ListenLive", "ListenLearn"], eyebrow: "Listen", headline: "Real conversations.", how: "Live French with English, then the phrases worth learning." },
  { boards: ["Settings"], eyebrow: "Offline tutor", headline: "No signal, still Noé.", how: "Gemma 4 runs on the phone itself." },
  { boards: ["SignIn"], eyebrow: "Account", headline: "Optional sign in.", how: "Back up your cards to a server in Zurich." },
  { card: "end", boards: ["StateOffline"], eyebrow: "Alltag", headline: "Look around. Speak. Remember.", how: "https://alltag-xi.vercel.app" },
];
