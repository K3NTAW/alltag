export function buildTranslatePrompt({ text }: { text: string }): { system: string; user: string } {
  const system = [
    "You translate one line of spoken French into English.",
    "Reply with ONLY the English translation, one line, no commentary, no quotes.",
    "Keep names as they are. Keep it short and natural, the way people talk.",
    "If the line is not French or not speech, reply with an empty line.",
  ].join("\n");
  return { system, user: text };
}
