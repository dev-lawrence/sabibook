// Client for an OpenAI compatible /v1/audio/transcriptions endpoint
// (Speaches, the project formerly called faster-whisper-server).
import { LANGUAGES, type Language } from "./languages";

export type AsrConfig = { baseUrl: string; model: string; apiKey?: string };

export function asrConfigFromEnv(language: Language): AsrConfig {
  const baseUrl = process.env.ASR_BASE_URL;
  const fallback = process.env.ASR_MODEL;
  // Optional second model for Pidgin, Yoruba, Hausa and Igbo (NaijaVox).
  const naija = process.env.ASR_MODEL_NAIJA;
  const model = LANGUAGES[language].asrTrack === "naija" && naija ? naija : fallback;
  if (!baseUrl || !model) {
    throw new Error("ASR_BASE_URL and ASR_MODEL must be set");
  }
  return { baseUrl: baseUrl.replace(/\/$/, ""), model, apiKey: process.env.ASR_API_KEY };
}

export async function transcribe(
  config: AsrConfig,
  audio: Blob,
  options: { language?: string; filename?: string; prompt?: string } = {},
): Promise<{ text: string; ms: number }> {
  const form = new FormData();
  form.append("file", audio, options.filename ?? "note.webm");
  form.append("model", config.model);
  form.append("response_format", "json");
  form.append("temperature", "0");
  if (options.language) form.append("language", options.language);
  if (options.prompt) form.append("prompt", options.prompt);

  const started = performance.now();
  const res = await reach(`${config.baseUrl}/audio/transcriptions`, "speech model", {
    method: "POST",
    headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {},
    body: form,
  });
  if (!res.ok) {
    throw new Error(`ASR request failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
  const data = (await res.json()) as { text?: string };
  return { text: (data.text ?? "").trim(), ms: Math.round(performance.now() - started) };
}

/** fetch, but a dead server becomes a sentence a trader can act on. */
async function reach(url: string, what: string, init: RequestInit) {
  try {
    return await fetch(url, init);
  } catch {
    throw new Error(`I could not reach the ${what}. Check that it is running, then try again.`);
  }
}
