import type { ModelFormState, ModelFilterState, ProviderPreset } from "./types";

export const TEST_TUBE_CSS = `
@keyframes test-tube-shake {
  0%   { transform: rotate(0deg); }
  10%  { transform: rotate(-18deg); }
  25%  { transform: rotate(14deg); }
  40%  { transform: rotate(-10deg); }
  55%  { transform: rotate(8deg); }
  70%  { transform: rotate(-5deg); }
  85%  { transform: rotate(3deg); }
  100% { transform: rotate(0deg); }
}
.test-tube-shaking {
  animation: test-tube-shake 0.7s ease-in-out forwards;
  transform-origin: bottom center;
}
`;

export const MODEL_FILTERS_STORAGE_KEY = "benchforge.model-registry.filters";

export const DEFAULT_MODEL_FILTER_STATE: ModelFilterState = {
  showArchived: false,
  search: "",
  selectedRoles: [],
  selectedProviderType: "all",
  selectedRuntimeType: "all",
};

export const emptyForm: ModelFormState = {
  displayName: "",
  role: "candidate",
  providerType: "openai",
  apiStyle: "openai_compatible",
  runtimeType: "remote",
  endpointUrl: "https://api.openai.com/v1/chat/completions",
  modelIdentifier: "gpt-5.4-2026-03-05",
  secretMode: "manual",
  apiKeyPresetId: "",
  secret: "",
  timeoutSeconds: "60",
  contextWindow: "",
  pricingInputPerMillion: "",
  pricingOutputPerMillion: "",
  notes: "",
  localLoadInstructions: "",
  isActive: true,
};

export const providerPresets: Record<string, ProviderPreset> = {
  openai: {
    label: "OpenAI",
    apiStyle: "openai_compatible",
    endpointUrl: "https://api.openai.com/v1/chat/completions",
    modelIdentifiers: ["gpt-5.4-2026-03-05", "gpt-5.4-mini-2026-03-17", "gpt-5.4-nano"],
  },
  google: {
    label: "Google Gemini",
    apiStyle: "openai_compatible",
    endpointUrl:
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    modelIdentifiers: [
      "gemini-2.5-pro",
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite",
    ],
  },
  mistral: {
    label: "Mistral",
    apiStyle: "openai_compatible",
    endpointUrl: "https://api.mistral.ai/v1/chat/completions",
    modelIdentifiers: [
      "mistral-large-latest",
      "mistral-small-latest",
      "mistral-medium-latest",
      "codestral-latest",
    ],
  },
  groq: {
    label: "Groq",
    apiStyle: "openai_compatible",
    endpointUrl: "https://api.groq.com/openai/v1/chat/completions",
    modelIdentifiers: [
      "openai/gpt-oss-120b",
      "openai/gpt-oss-20b",
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
    ],
  },
  deepseek: {
    label: "DeepSeek",
    apiStyle: "openai_compatible",
    endpointUrl: "https://api.deepseek.com/v1/chat/completions",
    modelIdentifiers: ["deepseek-chat", "deepseek-reasoner"],
  },
  openrouter: {
    label: "OpenRouter",
    apiStyle: "openai_compatible",
    endpointUrl: "https://openrouter.ai/api/v1/chat/completions",
    modelIdentifiers: ["openai/gpt-4"],
  },
  anthropic: {
    label: "Anthropic",
    apiStyle: "anthropic",
    endpointUrl: "https://api.anthropic.com/v1/messages",
    modelIdentifiers: [
      "claude-sonnet-4-6",
      "claude-sonnet-4-5-20250929",
      "claude-opus-4-7",
      "claude-haiku-4-5-20251001",
    ],
  },
  huggingface: {
    label: "Hugging Face",
    apiStyle: "huggingface",
    modelIdentifiers: [
      "openai/gpt-oss-120b",
      "Qwen/Qwen3-Coder-480B-A35B-Instruct",
      "deepseek-ai/DeepSeek-R1",
      "google/gemma-2-2b-it",
    ],
  },
  ollama: {
    label: "Ollama",
    apiStyle: "openai_compatible",
    endpointUrl: "http://localhost:11434/v1/chat/completions",
    modelIdentifiers: ["llama3.2", "qwen3", "gemma3", "mistral"],
  },
  lmstudio: {
    label: "LM Studio",
    apiStyle: "openai_compatible",
    endpointUrl: "http://127.0.0.1:1234/v1/chat/completions",
    modelIdentifiers: ["qwen/qwen3.6-35b-a3b"],
  },
};

export const apiStyleOptions = ["openai_compatible", "anthropic", "huggingface"];
