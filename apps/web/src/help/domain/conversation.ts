export type HelpContext = "account" | "model";

export function contextQuestion(message: string): HelpContext | null {
  const text = message.normalize("NFKC").toLowerCase().replace(/[’]/g, "'").trim().replace(/[?!.]+$/, "");
  if (/^(?:(?:whose|who's) account (?:is this|am i using)|who am i|who (?:is|am i) (?:signed|logged) in(?: as)?|(?:what is|what's) my (?:name|account))$/.test(text)) return "account";
  if (/^(?:(?:what|which) (?:ai )?model (?:is (?:this|it)|are you(?: using)?|is (?:it|help|the chatbot) using|do you use)|(?:what is|what's) your (?:ai )?model|what powers (?:you|help|the chatbot)|are you (?:gemini|an ai))$/.test(text)) return "model";
  return null;
}

export function blockedModelQuestion(message: string): boolean {
  const text = message.normalize("NFKC").toLowerCase().replace(/[’]/g, "'");
  // Block specific unsupported requests, not every phrase missing a FAQ match.
  return /\b(?:ignore|override|forget)\b.*\b(?:rules|instructions|prompt|previous)\b|\b(?:system prompt|hidden prompt|api key|secret|credentials|base64)\b|\b(?:another|other|someone else's)\b.*\b(?:user|student|account|report|attendance|data)\b/.test(text)
    || /^(?:(?:please|can you|could you|will you)\s+)*(?:submit|send|write|generate|create|delete|change|update|mark|record)\b/.test(text)
    || /\b(?:essay|homework|politics|president|recipe|joke|weather|medical|investment|salary|javascript|python|geofenc\w*|biometric\w*|payroll)\b/.test(text);
}
