import type { ApiKeyPresetDraft } from "./types";

export const apiKeyProviderSuggestions = [
  "openai",
  "anthropic",
  "openrouter",
  "ovh",
  "google",
  "mistral",
  "groq",
  "deepseek",
  "huggingface",
  "ollama",
] as const;

export const emptyApiKeyPresetDraft: ApiKeyPresetDraft = {
  name: "",
  providerType: "openai",
  secret: "",
};
