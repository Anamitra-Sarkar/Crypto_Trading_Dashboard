export type GroqChatRole = "system" | "user" | "assistant";

export interface GroqChatMessage {
  role: GroqChatRole;
  content: string;
}

export interface GroqChatCompletionRequest {
  model: string;
  messages: GroqChatMessage[];
  temperature: number;
  top_p: number;
  max_tokens: number;
  stream: false;
}

export interface GroqChatCompletionChoice {
  index: number;
  message: {
    role: "assistant";
    content: string | null;
  };
  finish_reason: string | null;
}

export interface GroqChatCompletionResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: GroqChatCompletionChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export type GroqErrorType =
  | "CONFIG"
  | "TIMEOUT"
  | "NETWORK"
  | "RATE_LIMIT"
  | "UPSTREAM"
  | "INVALID_RESPONSE"
  | "UNKNOWN";

export class GroqError extends Error {
  public readonly type: GroqErrorType;
  public readonly status?: number;
  public readonly retriable: boolean;
  public readonly details?: unknown;

  constructor(args: {
    type: GroqErrorType;
    message: string;
    status?: number;
    retriable: boolean;
    details?: unknown;
  }) {
    super(args.message);
    this.name = "GroqError";
    this.type = args.type;
    this.status = args.status;
    this.retriable = args.retriable;
    this.details = args.details;
  }
}

const GROQ_API_BASE_URL = "https://api.groq.com/openai/v1";
const GROQ_MODEL = "llama3-70b-8192";

const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_MAX_RETRIES = 2;
const RETRY_BACKOFF_MS = [250, 500, 1000] as const;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getApiKey(): string {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new GroqError({
      type: "CONFIG",
      message: "GROQ_API_KEY is not configured",
      retriable: false,
    });
  }
  return apiKey;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new GroqError({
        type: "TIMEOUT",
        message: `Groq request timed out after ${timeoutMs}ms`,
        retriable: true,
      });
    }

    throw new GroqError({
      type: "NETWORK",
      message: e instanceof Error ? e.message : "Network error calling Groq",
      retriable: true,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function classifyHttpError(status: number, details: unknown): GroqError {
  if (status === 401 || status === 403) {
    return new GroqError({
      type: "CONFIG",
      status,
      message: "Groq authentication failed (check GROQ_API_KEY)",
      retriable: false,
      details,
    });
  }

  if (status === 429) {
    return new GroqError({
      type: "RATE_LIMIT",
      status,
      message: "Groq rate limit reached",
      retriable: true,
      details,
    });
  }

  if (status >= 500 && status <= 599) {
    return new GroqError({
      type: "UPSTREAM",
      status,
      message: `Groq upstream error (${status})`,
      retriable: true,
      details,
    });
  }

  return new GroqError({
    type: "UPSTREAM",
    status,
    message: `Groq request failed (${status})`,
    retriable: false,
    details,
  });
}

export async function createGroqChatCompletion(
  request: Omit<GroqChatCompletionRequest, "model"> & { model?: string },
  options?: {
    timeoutMs?: number;
    maxRetries?: number;
  }
): Promise<GroqChatCompletionResponse> {
  const apiKey = getApiKey();

  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;

  const body: GroqChatCompletionRequest = {
    model: request.model ?? GROQ_MODEL,
    messages: request.messages,
    temperature: request.temperature,
    top_p: request.top_p,
    max_tokens: request.max_tokens,
    stream: false,
  };

  const url = `${GROQ_API_BASE_URL}/chat/completions`;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetchWithTimeout(
        url,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
        timeoutMs
      );

      if (!res.ok) {
        const details = await res.json().catch(() => null);
        const err = classifyHttpError(res.status, details);
        if (!err.retriable || attempt === maxRetries) throw err;
        lastError = err;
        await sleep(RETRY_BACKOFF_MS[Math.min(attempt, RETRY_BACKOFF_MS.length - 1)]);
        continue;
      }

      const data = (await res.json()) as unknown;

      if (
        !data ||
        typeof data !== "object" ||
        !("choices" in data) ||
        !Array.isArray((data as any).choices)
      ) {
        throw new GroqError({
          type: "INVALID_RESPONSE",
          message: "Invalid response shape from Groq",
          retriable: false,
          details: data,
        });
      }

      return data as GroqChatCompletionResponse;
    } catch (e) {
      const err = e instanceof GroqError ? e : null;
      if (err && err.retriable && attempt < maxRetries) {
        lastError = err;
        await sleep(RETRY_BACKOFF_MS[Math.min(attempt, RETRY_BACKOFF_MS.length - 1)]);
        continue;
      }
      lastError = e;
      break;
    }
  }

  if (lastError instanceof GroqError) throw lastError;

  throw new GroqError({
    type: "UNKNOWN",
    message: lastError instanceof Error ? lastError.message : "Unknown Groq error",
    retriable: false,
    details: lastError,
  });
}

export async function generateGroqResponse(prompt: string): Promise<string> {
  const completion = await createGroqChatCompletion({
    messages: [
      {
        role: "system",
        content:
          "You are a cryptocurrency trading assistant. Provide clear, concise responses. Do not use asterisks (*). Format lists with bullet points (•).",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0,
    top_p: 1,
    max_tokens: 1024,
  });

  const text = completion.choices?.[0]?.message?.content ?? "";
  if (!text) {
    throw new GroqError({
      type: "INVALID_RESPONSE",
      message: "Groq returned an empty response",
      retriable: false,
      details: completion,
    });
  }

  return text.trim();
}
