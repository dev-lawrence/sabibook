// Minimal client for any OpenAI compatible chat endpoint. Locally this is
// Ollama serving Gemma 4; swap LLM_BASE_URL to point anywhere else.

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type LlmConfig = { baseUrl: string; model: string; apiKey?: string };

export function llmConfigFromEnv(): LlmConfig {
  const baseUrl = process.env.LLM_BASE_URL;
  const model = process.env.LLM_MODEL;
  if (!baseUrl || !model) {
    throw new Error("LLM_BASE_URL and LLM_MODEL must be set");
  }
  return { baseUrl: baseUrl.replace(/\/$/, ""), model, apiKey: process.env.LLM_API_KEY };
}

export async function chat(
  config: LlmConfig,
  messages: ChatMessage[],
  options: { jsonSchema?: { name: string; schema: object }; maxTokens?: number } = {},
): Promise<{ content: string; ms: number }> {
  const started = performance.now();
  const res = await reach(`${config.baseUrl}/chat/completions`, "language model", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: 0,
      max_tokens: options.maxTokens ?? 800,
      ...(options.jsonSchema
        ? {
            response_format: {
              type: "json_schema",
              json_schema: { ...options.jsonSchema, strict: true },
            },
          }
        : {}),
    }),
  });
  if (!res.ok) {
    throw new Error(`LLM request failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("LLM returned no content");
  return { content, ms: Math.round(performance.now() - started) };
}

/** fetch, but a dead server becomes a sentence a trader can act on. */
async function reach(url: string, what: string, init: RequestInit) {
  try {
    return await fetch(url, init);
  } catch {
    throw new Error(`I could not reach the ${what}. Check that it is running, then try again.`);
  }
}
