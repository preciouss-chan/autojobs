import OpenAI from "openai";
import { LLM_CONFIG } from "@/app/lib/llm-config";

type LlmClientResult =
  | {
      ok: true;
      client: OpenAI;
      model: string;
      provider: string;
      isLocal: boolean;
    }
  | {
      ok: false;
      error: string;
    };

function getProvider(): string {
  return (
    process.env.LLM_PROVIDER ||
    (process.env.LLM_BASE_URL ? "local" : "openai")
  ).toLowerCase();
}

function getBaseUrl(provider: string): string | undefined {
  if (process.env.LLM_BASE_URL) {
    return process.env.LLM_BASE_URL;
  }

  if (provider === "local" || provider === "ollama") {
    return "http://localhost:11434/v1";
  }

  return undefined;
}

function isLocalProvider(provider: string, baseUrl?: string): boolean {
  return provider === "local" ||
    provider === "ollama" ||
    (!!baseUrl && !baseUrl.includes("api.openai.com"));
}

export function createLlmClient(apiKeyFromRequest?: string | null): LlmClientResult {
  const provider = getProvider();
  const baseURL = getBaseUrl(provider);
  const isLocal = isLocalProvider(provider, baseURL);
  const apiKey = apiKeyFromRequest?.trim() ||
    process.env.LLM_API_KEY ||
    process.env.OPENAI_API_KEY ||
    (isLocal ? "ollama" : "");
  const model = process.env.LLM_MODEL ||
    (isLocal ? "gemma4:e4b" : LLM_CONFIG.DEFAULTS.model);

  if (!apiKey) {
    return {
      ok: false,
      error: "OpenAI API key is required unless LLM_PROVIDER=local or LLM_BASE_URL is configured.",
    };
  }

  return {
    ok: true,
    client: new OpenAI({
      apiKey,
      ...(baseURL ? { baseURL } : {}),
    }),
    model,
    provider,
    isLocal,
  };
}
