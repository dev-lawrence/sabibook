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

// Some servers (Ollama with Gemma 4, at the time of writing) answer 501
// "structured output is unavailable". Remember that per server and fall back
// to asking for JSON in the prompt; callers validate the reply either way.
const noStructuredOutput = new Set<string>();

export async function chat(
  config: LlmConfig,
  messages: ChatMessage[],
  options: { jsonSchema?: { name: string; schema: object }; maxTokens?: number } = {},
): Promise<{ content: string; ms: number }> {
  const started = performance.now();
  const constrained = !!options.jsonSchema && !noStructuredOutput.has(config.baseUrl);
  const prompted =
    options.jsonSchema && !constrained
      ? [
          ...messages.slice(0, 1).map((m) => ({
            ...m,
            content: `${m.content}\n\nReply with one JSON object and nothing else. It must match this JSON Schema:\n${JSON.stringify(options.jsonSchema!.schema)}`,
          })),
          ...messages.slice(1),
        ]
      : messages;

  const res = await reach(`${config.baseUrl}/chat/completions`, "language model", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: config.model,
      messages: prompted,
      temperature: 0,
      max_tokens: options.maxTokens ?? 800,
      ...(constrained
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
    const body = (await res.text()).slice(0, 300);
    if (constrained && res.status === 501 && body.includes("structured output")) {
      noStructuredOutput.add(config.baseUrl);
      return await chat(config, messages, options);
    }
    throw new Error(`LLM request failed (${res.status}): ${body}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("LLM returned no content");
  return { content, ms: Math.round(performance.now() - started) };
}

/** Pull the JSON object out of a reply that may be wrapped in a code fence. */
export function parseJsonReply(content: string): unknown {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start === -1 || end < start) throw new Error(`Model did not return JSON: ${content.slice(0, 200)}`);
  return JSON.parse(content.slice(start, end + 1));
}

/** fetch, but a dead server becomes a sentence a trader can act on. */
async function reach(url: string, what: string, init: RequestInit) {
  try {
    return await fetch(url, init);
  } catch {
    throw new Error(`I could not reach the ${what}. Check that it is running, then try again.`);
  }
}
