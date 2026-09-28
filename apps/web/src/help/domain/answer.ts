import { articles, helpRoutes } from "./knowledge.ts";

export const refusal = "I can only help with Daybook features and how to use the system. Try asking about attendance, reports, calendar, or settings.";
export const unknown = "I don’t have verified guidance for that Daybook question yet.";
export const MAX_MESSAGE = 800;
const welcome = "Hello! I can explain Daybook attendance, reports, calendar, reminders, and settings. Choose a starter question or ask how to use a feature.";
const clarify = "Which Daybook feature do you mean: attendance, reports, calendar, reminders, or profile settings? Ask one focused question so I can show verified guidance.";
export type HelpReply = { text: string; sources: { id: string; label: string; href: string }[] };

// No model, executable tools, dynamic retrieval, or conversational instructions.
// Even false-positive intent matches can return only these approved product texts.
export function answerHelp(message: string): HelpReply {
  const text = message.normalize("NFKC").toLowerCase().replace(/[’']/g, "'");
  if (/\b(?:ignore|override|forget)\b.*\b(?:rules|instructions|prompt|previous)\b|\b(?:pretend|roleplay|role-play|base64|decode|system prompt|hidden prompt|api key|secret|credentials|database|infrastructure)\b|\b(?:another|other|someone else's)\b.*\b(?:user|student|account|report|attendance|data)\b/.test(text)) return { text: refusal, sources: [] };
  if (/^(?:hi|hello|hey|thanks|thank you)[!.\s]*$/.test(text)) return { text: welcome, sources: [] };
  const parts = text.split(/[?;!\n]+|\.(?:\s|$)|\s+(?:and also|also|and then|and)\s+/).map(part => part.trim()).filter(Boolean).slice(0, 8);
  const selected = new Set<string>();
  let excluded = false;
  for (const part of parts) {
    // Plain action commands are not executed or represented as successful actions.
    if (/^(?:(?:please|can you|could you|will you)\s+)*(?:submit|send|write|generate|create|delete|change|update|mark|record)\b/.test(part)
      || /\b(?:essay|homework|politics|president|recipe|joke|weather|medical|legal|law|investment|salary|javascript|python|code|geofenc\w*|gps|biometric\w*|payroll)\b/.test(part)) { excluded = true; continue; }
    const matches = articles.filter(article => article.matches.some(pattern => pattern.test(part)));
    if (matches.length === 1) selected.add(matches[0].id);
    else if (matches.length > 1) {
      // Prefer a specific workflow over generic mentions of reports/profile/hours.
      const specific = matches.filter(article => !["profile", "draft", "hours", "reminders"].includes(article.id));
      if (specific.length === 1) selected.add(specific[0].id);
      else return { text: clarify, sources: [] };
    } else excluded = true;
  }
  const found = articles.filter(article => selected.has(article.id)).slice(0, 2);
  if (!found.length) {
    if (/^(?:help|help me|how does it work|how do i use (?:daybook|reports|attendance))[?.\s]*$/.test(text)) return { text: clarify, sources: [] };
    if (/\b(?:daybook|dar|attendance|report|hours|settings)\b/.test(text) && !/\b(?:essay|homework|politics|weather|code)\b/.test(text)) return { text: unknown, sources: [] };
    return { text: refusal, sources: [] };
  }
  return {
    text: found.map(article => article.answer).join("\n\n") + (excluded ? `\n\n${refusal}` : ""),
    sources: found.map(article => ({ id: article.id, label: `${article.source} · ${helpRoutes[article.topic].label}`, href: helpRoutes[article.topic].href })),
  };
}

export function parseHelpRequest(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const object = value as Record<string, unknown>;
  if (Object.keys(object).length !== 1 || typeof object.message !== "string") return null;
  const message = object.message.trim();
  return message && message.length <= MAX_MESSAGE ? message : null;
}

export function isHelpReply(value: unknown): value is HelpReply {
  if (!value || typeof value !== "object") return false;
  const reply = value as HelpReply;
  if (!(typeof reply.text === "string" && reply.text.length <= 4000 && Array.isArray(reply.sources) && reply.sources.length <= 2
    && reply.sources.every(source => articles.some(article => source?.id === article.id
      && source.href === helpRoutes[article.topic].href
      && source.label === `${article.source} · ${helpRoutes[article.topic].label}`)))) return false;
  if (!reply.sources.length) return [refusal, unknown, welcome, clarify].includes(reply.text);
  if (new Set(reply.sources.map(source => source.id)).size !== reply.sources.length) return false;
  const approvedText = reply.sources.map(source => articles.find(article => article.id === source.id)!.answer).join("\n\n");
  return reply.text === approvedText || reply.text === `${approvedText}\n\n${refusal}`;
}
