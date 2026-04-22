import type { ReactNode } from "react";
import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import {
  Check,
  Archive,
  Cable,
  CircleGauge,
  Database,
  HardDrive,
  TriangleAlert,
  Plus,
  Search,
  RotateCcw,
  Shield,
  TestTube2,
  Trash2,
} from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";

import {
  archiveModelProfile,
  createModelProfile,
  fetchModelProfiles,
  testModelProfileConnection,
  updateModelProfile,
} from "@/features/models/api";
import type {
  ConnectionTestResponse,
  ModelProfile,
  ModelProfilePayload,
} from "@/features/models/types";
import { fetchApiKeyPresets } from "@/features/settings/api-keys-api";
import type { ApiKeyPreset } from "@/features/settings/api-keys-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LoadErrorState } from "@/components/ui/load-error-state";
import { MetricCard } from "@/components/ui/metric-card";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api";
import { queryClient } from "@/lib/query-client";
import { cn } from "@/lib/utils";

const TEST_TUBE_CSS = `
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

function AnimatedTestTube({ className }: { className?: string }) {
  const [key, setKey] = useState(0);
  const [shaking, setShaking] = useState(false);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    function schedule() {
      const delay = 3000 + Math.random() * 9000;
      timeout = setTimeout(() => {
        setShaking(true);
        setKey((k) => k + 1);
        setTimeout(() => {
          setShaking(false);
          schedule();
        }, 700);
      }, delay);
    }

    schedule();
    return () => clearTimeout(timeout);
  }, []);

  return (
    <>
      <style>{TEST_TUBE_CSS}</style>
      <TestTube2 key={key} className={cn(className, shaking && "test-tube-shaking")} />
    </>
  );
}

type ModelFormState = {
  displayName: string;
  role: "candidate" | "judge" | "both";
  providerType: string;
  apiStyle: string;
  runtimeType: "remote" | "local";
  endpointUrl: string;
  modelIdentifier: string;
  secretMode: "manual" | "preset";
  apiKeyPresetId: string;
  secret: string;
  timeoutSeconds: string;
  contextWindow: string;
  pricingInputPerMillion: string;
  pricingOutputPerMillion: string;
  notes: string;
  localLoadInstructions: string;
  isActive: boolean;
};

type ConnectionFeedbackState = ConnectionTestResponse & {
  modelId: number;
};

type ToastState = {
  message: string;
  kind: "success";
};

type ModelFilterState = {
  showArchived: boolean;
  search: string;
  selectedRoles: ModelFormState["role"][];
  selectedProviderType: string;
  selectedRuntimeType: string;
};

const MODEL_FILTERS_STORAGE_KEY = "benchforge.model-registry.filters";

function readModelFilterState(): ModelFilterState {
  if (typeof window === "undefined") {
    return {
      showArchived: false,
      search: "",
      selectedRoles: [],
      selectedProviderType: "all",
      selectedRuntimeType: "all",
    };
  }

  const raw = window.localStorage.getItem(MODEL_FILTERS_STORAGE_KEY);
  if (!raw) {
    return {
      showArchived: false,
      search: "",
      selectedRoles: [],
      selectedProviderType: "all",
      selectedRuntimeType: "all",
    };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ModelFilterState>;
    const validRoles = new Set<ModelFormState["role"]>([
      "candidate",
      "judge",
      "both",
    ]);
    return {
      showArchived: Boolean(parsed.showArchived),
      search: typeof parsed.search === "string" ? parsed.search : "",
      selectedRoles: Array.isArray(parsed.selectedRoles)
        ? parsed.selectedRoles.filter(
            (role): role is ModelFormState["role"] =>
              typeof role === "string" && validRoles.has(role as ModelFormState["role"]),
          )
        : [],
      selectedProviderType:
        typeof parsed.selectedProviderType === "string"
          ? parsed.selectedProviderType
          : "all",
      selectedRuntimeType:
        typeof parsed.selectedRuntimeType === "string"
          ? parsed.selectedRuntimeType
          : "all",
    };
  } catch {
    return {
      showArchived: false,
      search: "",
      selectedRoles: [],
      selectedProviderType: "all",
      selectedRuntimeType: "all",
    };
  }
}

const emptyForm: ModelFormState = {
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

type ProviderPreset = {
  apiStyle: string;
  endpointUrl?: string;
  label: string;
  modelIdentifiers: string[];
};

const providerPresets: Record<string, ProviderPreset> = {
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

const apiStyleOptions = ["openai_compatible", "anthropic", "huggingface"];

function normalizePresetKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function getProviderPreset(providerType: string): ProviderPreset | null {
  return providerPresets[normalizePresetKey(providerType)] ?? null;
}

function getSuggestedEndpointUrl(state: ModelFormState): string {
  if (state.apiStyle.trim().toLowerCase() === "huggingface") {
    return state.modelIdentifier.trim()
      ? `https://api-inference.huggingface.co/models/${state.modelIdentifier.trim()}`
      : "https://api-inference.huggingface.co/models/<your-model-id>";
  }

  return getProviderPreset(state.providerType)?.endpointUrl ?? "";
}

function shouldAutofillField(currentValue: string, previousSuggestion: string | null) {
  const trimmedValue = currentValue.trim();

  return trimmedValue.length === 0 || trimmedValue === previousSuggestion;
}


function toFormState(model: ModelProfile): ModelFormState {
  const hasPreset = model.api_key_preset_id !== null;
  return {
    displayName: model.display_name,
    role: model.role,
    providerType: model.provider_type,
    apiStyle: model.api_style,
    runtimeType: model.runtime_type,
    endpointUrl: model.endpoint_url,
    modelIdentifier: model.model_identifier,
    secretMode: hasPreset ? "preset" : "manual",
    apiKeyPresetId: hasPreset ? String(model.api_key_preset_id) : "",
    secret: "",
    timeoutSeconds: String(model.timeout_seconds),
    contextWindow: model.context_window ? String(model.context_window) : "",
    pricingInputPerMillion: model.pricing_input_per_million ?? "",
    pricingOutputPerMillion: model.pricing_output_per_million ?? "",
    notes: model.notes ?? "",
    localLoadInstructions: model.local_load_instructions ?? "",
    isActive: model.is_active,
  };
}

function toPayload(state: ModelFormState): ModelProfilePayload {
  const pricingInputPerMillion =
    state.runtimeType === "local" ? "0" : state.pricingInputPerMillion.trim() || null;
  const pricingOutputPerMillion =
    state.runtimeType === "local" ? "0" : state.pricingOutputPerMillion.trim() || null;

  return {
    display_name: state.displayName.trim(),
    role: state.role,
    provider_type: state.providerType.trim(),
    api_style: state.apiStyle.trim(),
    runtime_type: state.runtimeType,
    endpoint_url: state.endpointUrl.trim(),
    model_identifier: state.modelIdentifier.trim(),
    ...(state.secretMode === "manual" && state.secret.trim()
      ? { secret: state.secret.trim() }
      : {}),
    ...(state.secretMode === "preset" && state.apiKeyPresetId
      ? { api_key_preset_id: Number(state.apiKeyPresetId) }
      : {}),
    timeout_seconds: Number(state.timeoutSeconds),
    context_window: state.contextWindow ? Number(state.contextWindow) : null,
    pricing_input_per_million: pricingInputPerMillion,
    pricing_output_per_million: pricingOutputPerMillion,
    notes: state.notes.trim() || null,
    local_load_instructions: state.localLoadInstructions.trim() || null,
    is_active: state.isActive,
  };
}

function matchesSearch(model: ModelProfile, search: string): boolean {
  if (!search) {
    return true;
  }

  const haystack = [
    model.display_name,
    model.provider_type,
    model.runtime_type,
    model.role,
    model.endpoint_url,
    model.model_identifier,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(search.toLowerCase());
}

function matchesArchiveState(model: ModelProfile, showArchived: boolean): boolean {
  return showArchived ? model.is_archived : !model.is_archived;
}

function matchesRole(model: ModelProfile, roles: ModelFormState["role"][]): boolean {
  return roles.length === 0 || roles.includes(model.role);
}

function matchesProvider(model: ModelProfile, providerType: string): boolean {
  return providerType === "all" || model.provider_type === providerType;
}

function matchesRuntime(model: ModelProfile, runtimeType: string): boolean {
  return runtimeType === "all" || model.runtime_type === runtimeType;
}

type TFunc = (key: string, opts?: Record<string, unknown>) => string;

function roleLabel(role: ModelFormState["role"], t: TFunc): string {
  if (role === "candidate") return t("models.role.candidate");
  if (role === "judge") return t("models.role.judge");
  return t("models.role.both");
}

function roleDescription(role: ModelFormState["role"], t: TFunc): string {
  if (role === "candidate") return t("models.role.candidateDesc");
  if (role === "judge") return t("models.role.judgeDesc");
  return t("models.role.bothDesc");
}

function getConnectionFeedbackLabel(
  feedback: ConnectionFeedbackState | null,
  isTesting: boolean,
  runtimeType: ModelProfile["runtime_type"],
  t: TFunc,
): string {
  if (isTesting) return t("models.connection.testing");
  if (!feedback) return "";
  if (runtimeType === "local" && !feedback.ok) return t("models.connection.notLoaded");
  if (feedback.ok) {
    return feedback.status_code
      ? t("models.connection.success", { code: feedback.status_code })
      : t("models.connection.successNoCode");
  }
  if (feedback.status_code) return t("models.connection.failure", { code: feedback.status_code });
  return t("models.connection.failureNoCode");
}

function uniqueProviderTypes(models: ModelProfile[]): string[] {
  return Array.from(
    new Set(
      models
        .map((model) => model.provider_type.trim())
        .filter((providerType) => providerType.length > 0),
    ),
  ).sort((left, right) => left.localeCompare(right));
}

export function ModelRegistryPage() {
  const { t } = useTranslation();
  const initialModelFilters = readModelFilterState();
  const [showArchived, setShowArchived] = useState(
    initialModelFilters.showArchived,
  );
  const [search, setSearch] = useState(initialModelFilters.search);
  const [selectedRoles, setSelectedRoles] = useState<
    ModelFormState["role"][]
  >(initialModelFilters.selectedRoles);
  const [selectedProviderType, setSelectedProviderType] = useState(
    initialModelFilters.selectedProviderType,
  );
  const [selectedRuntimeType, setSelectedRuntimeType] = useState(
    initialModelFilters.selectedRuntimeType,
  );
  const [selectedModel, setSelectedModel] = useState<ModelProfile | null>(null);
  const [warningModel, setWarningModel] = useState<ModelProfile | null>(null);
  const [warningAnchor, setWarningAnchor] = useState<DOMRect | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [formState, setFormState] = useState<ModelFormState>(emptyForm);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [connectionFeedback, setConnectionFeedback] =
    useState<ConnectionFeedbackState | null>(null);
  const [testingModelId, setTestingModelId] = useState<number | null>(null);
  const [isRoleMenuOpen, setIsRoleMenuOpen] = useState(false);
  const [isProviderMenuOpen, setIsProviderMenuOpen] = useState(false);
  const [isRuntimeMenuOpen, setIsRuntimeMenuOpen] = useState(false);
  const [customProviderOpen, setCustomProviderOpen] = useState(false);
  const [customModelOpen, setCustomModelOpen] = useState(false);
  const [, startTransition] = useTransition();
  const lastSuggestedApiStyleRef = useRef<string | null>(null);
  const lastSuggestedEndpointRef = useRef<string | null>(null);
  const lastSuggestedModelRef = useRef<string | null>(null);
  const warningCloseTimerRef = useRef<number | null>(null);
  const toastCloseTimerRef = useRef<number | null>(null);
  const connectionFeedbackCloseTimerRef = useRef<number | null>(null);
  const isDirtyRef = useRef(false);
  const skipFormResetRef = useRef(false);

  const modelsQuery = useQuery({
    queryKey: ["model-profiles", showArchived],
    queryFn: () => fetchModelProfiles(showArchived),
  });
  const apiKeyPresetsQuery = useQuery({
    queryKey: ["api-key-presets"],
    queryFn: fetchApiKeyPresets,
  });

  useEffect(() => {
    if (skipFormResetRef.current) {
      skipFormResetRef.current = false;
      isDirtyRef.current = false;
      return;
    }
    isDirtyRef.current = false;

    if (!selectedModel) {
      setFormState(emptyForm);
      lastSuggestedApiStyleRef.current = emptyForm.apiStyle;
      lastSuggestedEndpointRef.current = getSuggestedEndpointUrl(emptyForm);
      lastSuggestedModelRef.current = emptyForm.modelIdentifier || null;
      return;
    }

    setFormState(toFormState(selectedModel));
    lastSuggestedApiStyleRef.current = null;
    lastSuggestedEndpointRef.current = null;
    lastSuggestedModelRef.current = null;
  }, [selectedModel]);

  useEffect(() => {
    if (selectedModel && !matchesArchiveState(selectedModel, showArchived)) {
      setSelectedModel(null);
    }
  }, [selectedModel, showArchived]);

  useEffect(() => {
    if (warningModel && !matchesArchiveState(warningModel, showArchived)) {
      setWarningModel(null);
    }
  }, [warningModel, showArchived]);

  useEffect(() => {
    window.localStorage.setItem(
      MODEL_FILTERS_STORAGE_KEY,
      JSON.stringify({
        showArchived,
        search,
        selectedRoles,
        selectedProviderType,
        selectedRuntimeType,
      }),
    );
  }, [search, selectedRoles, selectedProviderType, selectedRuntimeType, showArchived]);

  useEffect(
    () => () => {
      if (warningCloseTimerRef.current !== null) {
        window.clearTimeout(warningCloseTimerRef.current);
      }
      if (toastCloseTimerRef.current !== null) {
        window.clearTimeout(toastCloseTimerRef.current);
      }
      if (connectionFeedbackCloseTimerRef.current !== null) {
        window.clearTimeout(connectionFeedbackCloseTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!isDirtyRef.current) return;
    const isValid =
      formState.displayName.trim() &&
      formState.endpointUrl.trim() &&
      formState.modelIdentifier.trim() &&
      formState.timeoutSeconds.trim();
    if (!isValid) return;

    const timer = setTimeout(() => {
      void saveMutation.mutateAsync(toPayload(formState));
    }, 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formState]);

  const showToast = (message: string) => {
    if (toastCloseTimerRef.current !== null) {
      window.clearTimeout(toastCloseTimerRef.current);
    }
    setToast({ message, kind: "success" });
    toastCloseTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastCloseTimerRef.current = null;
    }, 5000);
  };

  const showConnectionFeedback = (nextFeedback: ConnectionFeedbackState) => {
    if (connectionFeedbackCloseTimerRef.current !== null) {
      window.clearTimeout(connectionFeedbackCloseTimerRef.current);
    }
    setConnectionFeedback(nextFeedback);
    connectionFeedbackCloseTimerRef.current = window.setTimeout(() => {
      setConnectionFeedback(null);
      connectionFeedbackCloseTimerRef.current = null;
    }, 3000);
  };

  const updateForm = (updater: (current: ModelFormState) => ModelFormState) => {
    isDirtyRef.current = true;
    setFormState(updater);
  };

  const saveMutation = useMutation({
    mutationFn: async (payload: ModelProfilePayload) => {
      if (selectedModel) {
        return updateModelProfile(selectedModel.id, payload);
      }
      return createModelProfile(payload);
    },
    onSuccess: async (model) => {
      await queryClient.invalidateQueries({ queryKey: ["model-profiles"] });
      setFeedback(null);
      skipFormResetRef.current = true;
      startTransition(() => {
        setSelectedModel(model);
      });
    },
    onError: (error) => {
      setFeedback(
        error instanceof ApiError ? error.message : t("models.feedback.errorSave"),
      );
    },
  });

  const archiveMutation = useMutation({
    mutationFn: archiveModelProfile,
    onSuccess: async (model) => {
      await queryClient.invalidateQueries({ queryKey: ["model-profiles"] });
      setFeedback(null);
      showToast(t("models.feedback.archived", { name: model.display_name }));
      setIsEditorOpen(false);
      startTransition(() => {
        setSelectedModel(null);
      });
    },
    onError: (error) => {
      setFeedback(
        error instanceof ApiError
          ? error.message
          : t("models.feedback.errorArchive"),
      );
    },
  });

  const testConnectionMutation = useMutation({
    onMutate: (model) => {
      setTestingModelId(model.id);
      setConnectionFeedback(null);
    },
    mutationFn: async (model: ModelProfile) =>
      testModelProfileConnection(model.id, Number(formState.timeoutSeconds)),
    onSuccess: (result, model) => {
      showConnectionFeedback({
        ...result,
        modelId: model.id,
      });
    },
    onError: (error, model) => {
      showConnectionFeedback({
        modelId: model.id,
        ok: false,
        status_code: null,
        detail:
          error instanceof ApiError ? error.message : "Connection test failed.",
      });
    },
    onSettled: () => {
      setTestingModelId(null);
    },
  });

  const scopedModels = (modelsQuery.data?.items ?? []).filter((model) =>
    matchesArchiveState(model, showArchived),
  );
  const providerTypeOptions = Array.from(
    new Set([...uniqueProviderTypes(scopedModels), selectedProviderType]),
  )
    .filter((providerType) => providerType !== "all")
    .sort((left, right) => left.localeCompare(right));
  const visibleModels = scopedModels.filter(
    (model) =>
      matchesSearch(model, search) &&
      matchesRole(model, selectedRoles) &&
      matchesProvider(model, selectedProviderType) &&
      matchesRuntime(model, selectedRuntimeType),
  );
  const loadError =
    (modelsQuery.error instanceof ApiError && modelsQuery.error.message) || null;
  const retryLoad = () => {
    void modelsQuery.refetch();
  };
  const hasAnyFilters =
    search.trim().length > 0 ||
    selectedRoles.length > 0 ||
    selectedProviderType !== "all" ||
    selectedRuntimeType !== "all";

  const roleCounts = scopedModels.reduce(
    (acc, item) => {
      if (item.role === "candidate" || item.role === "both") {
        acc.candidates += 1;
      }
      if (item.role === "judge" || item.role === "both") {
        acc.judges += 1;
      }
      return acc;
    },
    { candidates: 0, judges: 0 },
  );

  const modelIdentifierSuggestions =
    getProviderPreset(formState.providerType)?.modelIdentifiers ?? [];
  const providerMatchedApiKeyPresets = (apiKeyPresetsQuery.data?.items ?? []).filter(
    (preset) =>
      normalizePresetKey(preset.provider_type) ===
      normalizePresetKey(formState.providerType),
  );
  const availableApiKeyPresets =
    providerMatchedApiKeyPresets.length > 0
      ? providerMatchedApiKeyPresets
      : (apiKeyPresetsQuery.data?.items ?? []);
  const suggestedEndpointUrl = getSuggestedEndpointUrl(formState);
  const hasStoredSecret = selectedModel?.has_secret ?? false;
  const hasFormSecret = formState.secret.trim().length > 0;
  const hasSelectedApiKeyPreset = formState.apiKeyPresetId.trim().length > 0;
  const remoteSecretMissing =
    formState.runtimeType === "remote" &&
    !(hasStoredSecret || hasFormSecret || hasSelectedApiKeyPreset);

  const updateFormWithSuggestions = (
    updater: (current: ModelFormState) => ModelFormState,
    options?: {
      preserveApiStyleInput?: boolean;
      preserveEndpointInput?: boolean;
      preserveModelIdentifierInput?: boolean;
    },
  ) => {
    isDirtyRef.current = true;
    setFormState((current) => {
      const draft = updater(current);
      const preset = getProviderPreset(draft.providerType);
      const suggestedApiStyle = preset?.apiStyle ?? "";
      const suggestedModelIdentifier = preset?.modelIdentifiers[0] ?? "";
      const next = { ...draft };

      if (
        !options?.preserveApiStyleInput &&
        suggestedApiStyle &&
        shouldAutofillField(current.apiStyle, lastSuggestedApiStyleRef.current)
      ) {
        next.apiStyle = suggestedApiStyle;
      }

      if (
        !options?.preserveModelIdentifierInput &&
        suggestedModelIdentifier &&
        shouldAutofillField(
          current.modelIdentifier,
          lastSuggestedModelRef.current,
        )
      ) {
        next.modelIdentifier = suggestedModelIdentifier;
      }

      const nextSuggestedEndpoint = getSuggestedEndpointUrl(next);
      if (
        !options?.preserveEndpointInput &&
        nextSuggestedEndpoint &&
        shouldAutofillField(current.endpointUrl, lastSuggestedEndpointRef.current)
      ) {
        next.endpointUrl = nextSuggestedEndpoint;
      }

      lastSuggestedApiStyleRef.current = suggestedApiStyle || null;
      lastSuggestedModelRef.current = suggestedModelIdentifier || null;
      lastSuggestedEndpointRef.current = nextSuggestedEndpoint || null;

      return next;
    });
  };

  const openCreateModal = () => {
    startTransition(() => {
      setSelectedModel(null);
      setFeedback(null);
      setFormState(emptyForm);
    });
    setCustomProviderOpen(false);
    setCustomModelOpen(false);
    setIsEditorOpen(true);
  };

  const openEditModal = (model: ModelProfile) => {
    startTransition(() => {
      setSelectedModel(model);
      setFeedback(null);
    });
    const fs = toFormState(model);
    setCustomProviderOpen(!providerPresets[normalizePresetKey(fs.providerType)] && fs.providerType.length > 0);
    setCustomModelOpen(false);
    setIsEditorOpen(true);
  };

  const openWarning = (model: ModelProfile) => {
    if (warningCloseTimerRef.current !== null) {
      window.clearTimeout(warningCloseTimerRef.current);
      warningCloseTimerRef.current = null;
    }
    setWarningModel(model);
  };

  const showWarning = (
    model: ModelProfile,
    anchorElement: HTMLElement | null,
  ) => {
    if (anchorElement) {
      setWarningAnchor(anchorElement.getBoundingClientRect());
    }
    openWarning(model);
  };

  const closeWarningSoon = () => {
    if (warningCloseTimerRef.current !== null) {
      window.clearTimeout(warningCloseTimerRef.current);
    }
    warningCloseTimerRef.current = window.setTimeout(() => {
      setWarningModel(null);
      setWarningAnchor(null);
      warningCloseTimerRef.current = null;
    }, 120);
  };

  const toggleRole = (role: ModelFormState["role"]) => {
    setSelectedRoles((current) =>
      current.includes(role)
        ? current.filter((item) => item !== role)
        : [...current, role],
    );
  };

  return (
    <div className="px-3 py-5 lg:px-6 lg:py-6 xl:px-7">
      <section className="relative overflow-hidden rounded-[1.65rem] border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] p-3.5 shadow-xl lg:p-4">
        <div className="absolute left-0 top-0 h-full w-[58%] bg-[var(--hero-bg)]" />
        <div className="absolute inset-0 bg-[linear-gradient(var(--hero-grid)_1px,transparent_1px),linear-gradient(90deg,var(--hero-grid)_1px,transparent_1px)] bg-[size:26px_26px] opacity-50" />
        <div className="relative flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_31rem] lg:items-center lg:gap-4">
          <div className="relative max-w-[30rem] space-y-2">
            <span className="inline-flex rounded-full border border-[hsl(var(--hero-pill-border))] bg-[hsl(var(--hero-pill-bg))] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-[hsl(var(--hero-pill-foreground))]">
              {t("models.connectionProfiles")}
            </span>
            <h1 className="font-display text-[1.8rem] font-semibold tracking-tight text-foreground lg:text-[2.2rem]">
              {t("models.pageTitle")}
            </h1>
          </div>
          <div className="grid gap-1.5 sm:grid-cols-3">
            <MetricCard
              compact
              className="rounded-[1.2rem]"
              icon={Database}
              label={t("models.metricVisible")}
              tone="sky"
              value={String(visibleModels.length)}
            />
            <MetricCard
              compact
              className="rounded-[1.2rem]"
              icon={CircleGauge}
              label={t("models.metricCandidates")}
              tone="sky"
              value={String(roleCounts?.candidates ?? 0)}
            />
            <MetricCard
              compact
              className="rounded-[1.2rem]"
              icon={Shield}
              label={t("models.metricJudges")}
              tone="sky"
              value={String(roleCounts?.judges ?? 0)}
            />
          </div>
        </div>
      </section>

      <section className="mt-5">
        <Card className="overflow-visible border-border/70 bg-[hsl(var(--surface-overlay))] shadow-sm">
          <div className="relative z-30 border-b border-border/80 px-3 py-2.5 lg:px-3.5">
            <div className="flex flex-col gap-3 xl:grid xl:grid-cols-[minmax(0,1.45fr)_minmax(0,0.95fr)_minmax(0,0.95fr)_minmax(0,0.85fr)_auto] xl:items-stretch">
              <label className="relative min-h-10">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  className="h-10 rounded-[1rem] pl-9 text-[0.95rem]"
                  placeholder={t("models.searchPlaceholder")}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>

              <div className="relative min-w-0">
                <button
                  className="flex h-10 w-full items-center justify-between rounded-[1rem] border border-border/80 bg-[hsl(var(--surface))] px-3.5 text-left shadow-[0_12px_30px_-18px_rgba(15,23,42,0.12)] transition hover:border-[hsl(var(--theme-accent-border))] hover:bg-[hsl(var(--theme-accent-muted))]"
                  type="button"
                  onClick={() => {
                    setIsRoleMenuOpen((current) => !current);
                    setIsProviderMenuOpen(false);
                    setIsRuntimeMenuOpen(false);
                  }}
                >
                  <div className="min-w-0">
                    <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-[hsl(var(--foreground-soft))]">
                      {t("models.rolesLabel")}
                    </p>
                    <p className="truncate text-[0.72rem] font-semibold text-foreground">
                      {selectedRoles.length > 0
                        ? selectedRoles.map((role) => roleLabel(role, t)).join(", ")
                        : t("models.allRoles")}
                    </p>
                  </div>
                </button>

                {isRoleMenuOpen ? (
                  <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-3xl border border-border/80 bg-[hsl(var(--surface-elevated))] shadow-[0_24px_64px_-24px_rgba(15,23,42,0.18)]">
                    <div className="border-b border-border/70 bg-[linear-gradient(180deg,_hsl(var(--theme-accent-muted)),_hsl(var(--surface-elevated)))] px-4 py-3">
                      <p className="text-sm font-semibold text-foreground">{t("models.pickRoles")}</p>
                      <p className="text-xs text-[hsl(var(--foreground-soft))]">
                        {t("models.pickRolesDesc")}
                      </p>
                    </div>
                    <div className="space-y-2 p-2">
                      {(["candidate", "judge", "both"] as const).map((role) => {
                        const isSelected = selectedRoles.includes(role);
                        return (
                          <button
                            key={role}
                            className={cn(
                              "flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-left transition",
                              isSelected
                                ? "bg-[hsl(var(--theme-accent-soft))] text-[hsl(var(--theme-accent-soft-foreground))]"
                                : "hover:bg-[hsl(var(--surface-muted))]",
                            )}
                            type="button"
                            onClick={() => toggleRole(role)}
                          >
                            <span className="min-w-0">
                              <span className="block text-sm font-medium">
                                {roleLabel(role, t)}
                              </span>
                              <span className="block text-xs text-[hsl(var(--foreground-soft))]">
                                {roleDescription(role, t)}
                              </span>
                            </span>
                            <Check
                              className={cn(
                                "h-4 w-4 shrink-0",
                                isSelected ? "opacity-100" : "opacity-0",
                              )}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="relative min-w-0">
                <button
                  className="flex h-10 w-full items-center justify-between rounded-[1rem] border border-border/80 bg-[hsl(var(--surface))] px-3.5 text-left shadow-[0_12px_30px_-18px_rgba(15,23,42,0.12)] transition hover:border-[hsl(var(--theme-accent-border))] hover:bg-[hsl(var(--theme-accent-muted))]"
                  type="button"
                  onClick={() => {
                    setIsProviderMenuOpen((current) => !current);
                    setIsRoleMenuOpen(false);
                    setIsRuntimeMenuOpen(false);
                  }}
                >
                  <div className="min-w-0">
                    <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-[hsl(var(--foreground-soft))]">
                      {t("models.providerLabel")}
                    </p>
                    <p className="truncate text-[0.72rem] font-semibold text-foreground">
                      {selectedProviderType === "all"
                        ? t("models.allProviders")
                        : selectedProviderType}
                    </p>
                  </div>
                </button>

                {isProviderMenuOpen ? (
                  <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-3xl border border-border/80 bg-[hsl(var(--surface-elevated))] shadow-[0_24px_64px_-24px_rgba(15,23,42,0.18)]">
                    <div className="border-b border-border/70 bg-[linear-gradient(180deg,_hsl(var(--theme-accent-muted)),_hsl(var(--surface-elevated)))] px-4 py-3">
                      <p className="text-sm font-semibold text-foreground">
                        {t("models.chooseProvider")}
                      </p>
                      <p className="text-xs text-[hsl(var(--foreground-soft))]">
                        {t("models.chooseProviderDesc")}
                      </p>
                    </div>
                    <div className="max-h-72 overflow-y-auto p-2">
                      <button
                        className={cn(
                          "flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left transition",
                          selectedProviderType === "all"
                            ? "bg-[hsl(var(--theme-accent-soft))] text-[hsl(var(--theme-accent-soft-foreground))]"
                            : "hover:bg-[hsl(var(--surface-muted))]",
                        )}
                        type="button"
                        onClick={() => {
                          setSelectedProviderType("all");
                          setIsProviderMenuOpen(false);
                        }}
                      >
                        <span className="font-medium">{t("models.allProviders")}</span>
                        {selectedProviderType === "all" ? (
                          <Check className="h-4 w-4" />
                        ) : null}
                      </button>
                      {providerTypeOptions.map((providerType) => {
                        const isSelected = selectedProviderType === providerType;
                        return (
                          <button
                            key={providerType}
                            className={cn(
                              "flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left transition",
                              isSelected
                                ? "bg-[hsl(var(--theme-accent-soft))] text-[hsl(var(--theme-accent-soft-foreground))]"
                                : "hover:bg-[hsl(var(--surface-muted))]",
                            )}
                            type="button"
                            onClick={() => {
                              setSelectedProviderType(providerType);
                              setIsProviderMenuOpen(false);
                            }}
                          >
                            <span className="font-medium">{providerType}</span>
                            {isSelected ? <Check className="h-4 w-4" /> : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="relative min-w-0">
                <button
                  className="flex h-10 w-full items-center justify-between rounded-[1rem] border border-border/80 bg-[hsl(var(--surface))] px-3.5 text-left shadow-[0_12px_30px_-18px_rgba(15,23,42,0.12)] transition hover:border-[hsl(var(--theme-accent-border))] hover:bg-[hsl(var(--theme-accent-muted))]"
                  type="button"
                  onClick={() => {
                    setIsRuntimeMenuOpen((current) => !current);
                    setIsRoleMenuOpen(false);
                    setIsProviderMenuOpen(false);
                  }}
                >
                  <div className="min-w-0">
                    <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-[hsl(var(--foreground-soft))]">
                      {t("models.runtimeLabel")}
                    </p>
                    <p className="truncate text-[0.72rem] font-semibold text-foreground">
                      {selectedRuntimeType === "all"
                        ? t("models.allRuntimes")
                        : selectedRuntimeType}
                    </p>
                  </div>
                </button>

                {isRuntimeMenuOpen ? (
                  <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-3xl border border-border/80 bg-[hsl(var(--surface-elevated))] shadow-[0_24px_64px_-24px_rgba(15,23,42,0.18)]">
                    <div className="border-b border-border/70 bg-[linear-gradient(180deg,_hsl(var(--theme-accent-muted)),_hsl(var(--surface-elevated)))] px-4 py-3">
                      <p className="text-sm font-semibold text-foreground">
                        {t("models.chooseRuntime")}
                      </p>
                      <p className="text-xs text-[hsl(var(--foreground-soft))]">
                        {t("models.chooseRuntimeDesc")}
                      </p>
                    </div>
                    <div className="space-y-2 p-2">
                      {(["all", "remote", "local"] as const).map((runtime) => {
                        const isSelected = selectedRuntimeType === runtime;
                        const label =
                          runtime === "all"
                            ? t("models.allRuntimes")
                            : runtime === "remote"
                              ? t("models.runtime.remote")
                              : t("models.runtime.local");
                        return (
                          <button
                            key={runtime}
                            className={cn(
                              "flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left transition",
                              isSelected
                                ? "bg-[hsl(var(--theme-accent-soft))] text-[hsl(var(--theme-accent-soft-foreground))]"
                                : "hover:bg-[hsl(var(--surface-muted))]",
                            )}
                            type="button"
                            onClick={() => {
                              setSelectedRuntimeType(runtime);
                              setIsRuntimeMenuOpen(false);
                            }}
                          >
                            <span className="font-medium">{label}</span>
                            {isSelected ? <Check className="h-4 w-4" /> : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>

                <div className="flex flex-wrap items-center gap-3 xl:justify-end">
                  <Button
                    disabled={!hasAnyFilters}
                    type="button"
                    size="sm"
                    variant={hasAnyFilters ? "secondary" : "ghost"}
                    className="h-9 rounded-full px-3 text-xs font-semibold"
                    aria-label={t("models.resetFilters")}
                    title={t("models.resetFilters")}
                    onClick={() => {
                      setSearch("");
                      setSelectedRoles([]);
                      setSelectedProviderType("all");
                      setSelectedRuntimeType("all");
                      setIsRoleMenuOpen(false);
                      setIsProviderMenuOpen(false);
                      setIsRuntimeMenuOpen(false);
                    }}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    aria-label={showArchived ? t("models.showUnarchived") : t("models.showArchived")}
                    className={cn(
                      showArchived &&
                        "border-[hsl(var(--theme-accent-border))] bg-[hsl(var(--theme-accent-soft))] text-[hsl(var(--theme-accent-soft-foreground))] shadow-[0_14px_28px_-18px_rgba(15,23,42,0.18)] hover:brightness-[0.98]",
                    )}
                    title={showArchived ? t("models.showUnarchived") : t("models.showArchived")}
                    type="button"
                    variant={showArchived ? "secondary" : "ghost"}
                    size="icon"
                    onClick={() => setShowArchived((current) => !current)}
                  >
                    <Archive className="h-4 w-4" />
                  </Button>
                  <Button className="h-10 rounded-[1rem] px-4 text-[0.95rem]" onClick={openCreateModal}>
                    <Plus className="h-4 w-4" />
                    {t("models.newProfile")}
                  </Button>
              </div>
            </div>
          </div>

          {loadError ? (
            <LoadErrorState
              message={loadError}
              onRetry={retryLoad}
              resourceLabel="the model registry"
            />
          ) : null}

          {feedback ? (
            <div className="border-b border-[hsl(var(--theme-accent-border))] bg-[hsl(var(--theme-accent-muted))] px-5 py-3 text-sm text-[hsl(var(--theme-accent-soft-foreground))]">
              {feedback}
            </div>
          ) : null}

            <div
              className={cn(
                "relative z-10 overflow-x-auto",
                showArchived &&
                  "border-l-4 border-[hsl(var(--theme-accent-border))] bg-[hsl(var(--theme-accent-muted)/0.56)] pl-0",
              )}
            >
            <table className="min-w-full table-fixed text-left">
              <thead className="bg-[hsl(var(--surface-muted))] text-[10px] uppercase tracking-[0.14em] text-[hsl(var(--foreground-soft))]">
                <tr>
                  <th className="w-[26%] px-3 py-2 font-semibold lg:px-3.5">{t("models.colDisplayName")}</th>
                  <th className="w-[10%] px-3 py-2 font-semibold lg:px-3.5">{t("models.colRole")}</th>
                  <th className="w-[15%] px-3 py-2 font-semibold lg:px-3.5">{t("models.colProvider")}</th>
                  <th className="w-[10%] px-3 py-2 font-semibold lg:px-3.5">{t("models.colRuntime")}</th>
                  <th className="w-[14%] px-3 py-2 font-semibold lg:px-3.5">{t("models.colStatus")}</th>
                  <th className="w-[8%] px-3 py-2 font-semibold lg:px-3.5">{t("models.colActions")}</th>
                </tr>
              </thead>
              <tbody>
                {modelsQuery.isLoading ? (
                  <TableEmptyRow message={t("models.loading")} />
                ) : visibleModels.length === 0 ? (
                  <TableEmptyRow
                    message={
                      showArchived
                        ? t("models.noArchivedYet")
                        : t("models.noMatchingFilters")
                    }
                  />
                ) : (
                  visibleModels.map((model) => {
                    const isSelected = selectedModel?.id === model.id;
                    const isTestingConnection = testingModelId === model.id;
                    const rowConnectionFeedback =
                      connectionFeedback?.modelId === model.id ? connectionFeedback : null;
                    const isUnusable = model.runtime_type === "remote" && !model.has_secret;
                    const connectionFeedbackLabel = getConnectionFeedbackLabel(
                      rowConnectionFeedback,
                      isTestingConnection,
                      model.runtime_type,
                      t,
                    );

                    return (
                      <tr
                        key={model.id}
                        className={cn(
                          "cursor-pointer border-t border-border/70 transition-colors",
                          isSelected && "bg-[hsl(var(--theme-accent-muted)/0.78)]",
                          isUnusable &&
                            "bg-[hsl(var(--surface-muted)/0.86)] text-[hsl(var(--foreground-soft))] opacity-75",
                        )}
                        onClick={() => {
                          openEditModal(model);
                        }}
                      >
                        <td className="relative px-3 py-2.5 align-middle lg:px-3.5">
                          <div className="flex items-start gap-3">
                            <Button
                              aria-label={t("models.testConnection", { name: model.display_name })}
                              disabled={testConnectionMutation.isPending || isUnusable}
                              onClick={(event) => {
                                event.stopPropagation();
                                testConnectionMutation.mutate(model);
                              }}
                              size="iconSm"
                              title={t("models.testConnection", { name: model.display_name })}
                              type="button"
                              variant="soft"
                            >
                              <AnimatedTestTube
                                className={cn(
                                  "h-4 w-4",
                                  isTestingConnection && "animate-pulse text-sky-700",
                                )}
                              />
                            </Button>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                {isUnusable ? (
                                  <button
                                    aria-label={t("models.missingSecretExplain", { name: model.display_name })}
                                    className="inline-flex shrink-0 items-center justify-center rounded-full text-amber-600 transition hover:text-amber-700"
                                    onClick={(event) => event.stopPropagation()}
                                    onMouseEnter={(event) =>
                                      showWarning(
                                        model,
                                        event.currentTarget as HTMLElement,
                                      )
                                    }
                                    onMouseLeave={closeWarningSoon}
                                    type="button"
                                    title={t("models.missingSecret")}
                                  >
                                    <TriangleAlert className="h-4 w-4" />
                                  </button>
                                ) : null}
                                <p
                                  className="block w-full truncate text-left text-[0.95rem] font-semibold text-foreground"
                                  title={model.display_name}
                                >
                                  {model.display_name}
                                </p>
                              </div>
                              <p
                                className={cn(
                                  "block w-full truncate transition text-[0.78rem] leading-tight",
                                  isTestingConnection
                                    ? "font-medium text-sky-700"
                                    : rowConnectionFeedback
                                      ? cn(
                                          "font-medium",
                                          rowConnectionFeedback.ok
                                            ? "text-emerald-700"
                                            : "text-rose-700",
                                        )
                                      : "text-slate-400",
                                )}
                                title={
                                  isTestingConnection
                                    ? t("models.connection.testing")
                                    : rowConnectionFeedback
                                      ? rowConnectionFeedback.status_code
                                        ? `HTTP ${rowConnectionFeedback.status_code} — ${rowConnectionFeedback.detail}`
                                        : rowConnectionFeedback.detail
                                      : model.model_identifier
                                }
                              >
                                {connectionFeedbackLabel || model.model_identifier}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 align-middle lg:px-3.5">
                          <RoleBadge role={model.role} />
                        </td>
                        <td className="px-3 py-2.5 align-middle lg:px-3.5">
                          <Badge variant="accent">{model.provider_type}</Badge>
                        </td>
                        <td className="px-3 py-2.5 align-middle lg:px-3.5">
                          <RuntimeBadge runtimeType={model.runtime_type} />
                        </td>
                        <td className="px-3 py-2.5 align-middle lg:px-3.5">
                          <div className="flex flex-wrap gap-2">
                            <Badge variant={model.is_archived ? "muted" : "success"}>
                              {model.is_archived ? t("models.statusArchived") : t("models.statusActive")}
                            </Badge>
                            {!model.is_active && !model.is_archived ? (
                              <Badge variant="neutral">{t("models.statusInactive")}</Badge>
                            ) : null}
                            {isUnusable ? <Badge variant="muted">{t("models.statusMissingSecret")}</Badge> : null}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 align-middle lg:px-3.5" onClick={(event) => event.stopPropagation()}>
                          <div className="flex justify-end gap-1.5">
                            <Button
                              aria-label={t("common.archive", { name: model.display_name })}
                              size="iconSm"
                              title={t("common.archive", { name: model.display_name })}
                              variant="dangerSoft"
                              disabled={
                                model.is_archived || archiveMutation.isPending
                              }
                              onClick={() => archiveMutation.mutate(model.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      <Modal
        description={t("models.modal.description")}
        onClose={() => setIsEditorOpen(false)}
        open={isEditorOpen}
        size="xl"
        tone="sky"
        title={t(selectedModel ? "models.editModal.title" : "models.createModal.title")}
      >
        <form className="space-y-3.5">
          {loadError ? (
            <LoadErrorState compact message={loadError} resourceLabel="the model registry" />
          ) : null}

          {/* Display Name + Role */}
          <div className="grid gap-3 sm:grid-cols-2">
            <ModalField label={t("models.form.displayName")}>
              <Input
                placeholder={t("models.form.displayNamePlaceholder")}
                value={formState.displayName}
                onChange={(event) =>
                  updateForm((current) => ({ ...current, displayName: event.target.value }))
                }
              />
            </ModalField>
            <ModalField label={t("models.form.role")}>
              <div className="flex gap-1.5">
                {(["candidate", "judge", "both"] as const).map((r) => {
                  const isSelected = formState.role === r;
                  const label = r === "candidate" ? t("models.role.candidate") : r === "judge" ? t("models.role.judge") : t("models.role.both");
                  const selectedCls =
                    r === "candidate"
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700 shadow-sm"
                      : r === "judge"
                        ? "border-slate-300 bg-slate-100 text-slate-700 shadow-sm"
                        : "border-sky-300 bg-sky-50 text-sky-700 shadow-sm";
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => updateForm((c) => ({ ...c, role: r }))}
                      className={cn(
                        "flex flex-1 items-center justify-center rounded-lg border px-2 py-2 text-xs font-medium transition-all",
                        isSelected
                          ? selectedCls
                          : "border-border bg-white text-slate-400 hover:border-slate-300 hover:text-slate-600",
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </ModalField>
          </div>

          {/* Provider chips + Runtime buttons */}
          <div className="grid gap-3 sm:grid-cols-2">
            <ModalField label={t("models.form.providerType")}>
              <div className="flex flex-wrap gap-1">
                {Object.entries(providerPresets).map(([key, preset]) => {
                  const isSelected = normalizePresetKey(formState.providerType) === key && !customProviderOpen;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setCustomProviderOpen(false);
                        updateFormWithSuggestions((c) => ({ ...c, providerType: key }));
                      }}
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-all",
                        isSelected
                          ? "border-sky-300 bg-sky-50 text-sky-700"
                          : "border-border bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700",
                      )}
                    >
                      {preset.label}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setCustomProviderOpen((v) => !v)}
                  className={cn(
                    "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium transition-all",
                    customProviderOpen
                      ? "border-sky-300 bg-sky-50 text-sky-700"
                      : "border-dashed border-border text-slate-400 hover:border-slate-300 hover:text-slate-600",
                  )}
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
              {customProviderOpen ? (
                <Input
                  className="mt-1.5"
                  placeholder="custom-provider"
                  value={formState.providerType}
                  onChange={(event) =>
                    updateFormWithSuggestions((c) => ({ ...c, providerType: event.target.value }))
                  }
                />
              ) : null}
            </ModalField>

            <ModalField label={t("models.form.runtimeType")}>
              <div className="flex gap-1.5">
                {(["remote", "local"] as const).map((rt) => {
                  const isSelected = formState.runtimeType === rt;
                  return (
                    <button
                      key={rt}
                      type="button"
                      onClick={() =>
                        updateForm((c) => ({
                          ...c,
                          runtimeType: rt,
                          pricingInputPerMillion: rt === "local" ? "0" : c.pricingInputPerMillion,
                          pricingOutputPerMillion: rt === "local" ? "0" : c.pricingOutputPerMillion,
                        }))
                      }
                      className={cn(
                        "flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all",
                        isSelected && rt === "remote"
                          ? "border-sky-300 bg-sky-50 text-sky-700 shadow-sm"
                          : isSelected && rt === "local"
                            ? "border-slate-300 bg-slate-100 text-slate-700 shadow-sm"
                            : "border-border bg-white text-slate-400 hover:border-slate-300 hover:text-slate-600",
                      )}
                    >
                      {rt === "remote" ? <Cable className="h-3.5 w-3.5" /> : <HardDrive className="h-3.5 w-3.5" />}
                      {t(`models.runtime.${rt}`)}
                    </button>
                  );
                })}
              </div>
            </ModalField>
          </div>

          {/* API Style buttons */}
          <ModalField label={t("models.form.apiStyle")}>
            <div className="flex gap-1.5">
              {apiStyleOptions.map((style) => {
                const isSelected = formState.apiStyle === style;
                const styleLabel =
                  style === "openai_compatible" ? "OpenAI compatible" : style === "anthropic" ? "Anthropic" : "HuggingFace";
                return (
                  <button
                    key={style}
                    type="button"
                    onClick={() =>
                      updateFormWithSuggestions((c) => ({ ...c, apiStyle: style }), { preserveApiStyleInput: true })
                    }
                    className={cn(
                      "flex flex-1 items-center justify-center rounded-lg border px-2 py-2 text-xs font-medium transition-all",
                      isSelected
                        ? "border-sky-300 bg-sky-50 text-sky-700 shadow-sm"
                        : "border-border bg-white text-slate-400 hover:border-slate-300 hover:text-slate-600",
                    )}
                  >
                    {styleLabel}
                  </button>
                );
              })}
            </div>
          </ModalField>

          {/* Endpoint URL */}
          <ModalField label={t("models.form.endpointUrl")}>
            <Input
              placeholder={suggestedEndpointUrl || "https://api.openai.com/v1/chat/completions"}
              required
              value={formState.endpointUrl}
              onChange={(event) =>
                updateFormWithSuggestions(
                  (c) => ({ ...c, endpointUrl: event.target.value }),
                  { preserveEndpointInput: true },
                )
              }
            />
          </ModalField>

          {/* Model identifier chips */}
          <ModalField label={t("models.form.modelIdentifier")}>
            <div className="flex flex-wrap gap-1">
              {modelIdentifierSuggestions.map((id) => {
                const isSelected = formState.modelIdentifier === id && !customModelOpen;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setCustomModelOpen(false);
                      updateFormWithSuggestions((c) => ({ ...c, modelIdentifier: id }), { preserveModelIdentifierInput: true });
                    }}
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium transition-all",
                      isSelected
                        ? "border-sky-300 bg-sky-50 text-sky-700"
                        : "border-border bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700",
                    )}
                  >
                    {id}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setCustomModelOpen((v) => !v)}
                className={cn(
                  "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium transition-all",
                  customModelOpen
                    ? "border-sky-300 bg-sky-50 text-sky-700"
                    : "border-dashed border-border text-slate-400 hover:border-slate-300 hover:text-slate-600",
                )}
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
            {customModelOpen ? (
              <Input
                className="mt-1.5"
                placeholder="custom-model-id"
                value={formState.modelIdentifier}
                onChange={(event) =>
                  updateFormWithSuggestions(
                    (c) => ({ ...c, modelIdentifier: event.target.value }),
                    { preserveModelIdentifierInput: true },
                  )
                }
              />
            ) : null}
          </ModalField>

          {/* Secret */}
          <ModalField label={t("models.form.secret")}>
            <div className="space-y-2">
              {formState.runtimeType === "remote" ? (
                <div className="flex gap-1.5">
                  {(["manual", "preset"] as const).map((mode) => {
                    const isSelected = formState.secretMode === mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() =>
                          updateForm((c) => ({
                            ...c,
                            secretMode: mode,
                            apiKeyPresetId: mode === "preset" ? c.apiKeyPresetId : "",
                            secret: mode === "manual" ? c.secret : "",
                          }))
                        }
                        className={cn(
                          "flex flex-1 items-center justify-center rounded-lg border px-2 py-1.5 text-xs font-medium transition-all",
                          isSelected
                            ? "border-sky-300 bg-sky-50 text-sky-700 shadow-sm"
                            : "border-border bg-white text-slate-400 hover:border-slate-300 hover:text-slate-600",
                        )}
                      >
                        {t(`models.form.secretMode.${mode}`)}
                      </button>
                    );
                  })}
                </div>
              ) : null}
              {formState.runtimeType === "remote" && formState.secretMode === "preset" ? (
                <Select
                  value={formState.apiKeyPresetId}
                  onChange={(event) => {
                    const nextApiKeyPresetId = event.target.value;
                    updateForm((c) => ({ ...c, secretMode: "preset" as const, apiKeyPresetId: nextApiKeyPresetId, secret: "" }));
                  }}
                >
                  <option value="">{t("models.form.selectPreset")}</option>
                  {availableApiKeyPresets.map((preset: ApiKeyPreset) => (
                    <option key={preset.id} value={String(preset.id)}>
                      {preset.name} ({preset.provider_type})
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  placeholder={
                    formState.runtimeType === "local"
                      ? t("models.form.secretPlaceholder.local")
                      : hasStoredSecret
                        ? t("models.form.secretPlaceholder.stored", { preview: selectedModel?.secret_preview ?? "******" })
                        : t("models.form.secretPlaceholder.bearer")
                  }
                  type="password"
                  value={formState.secret}
                  onChange={(event) => updateForm((c) => ({ ...c, secret: event.target.value }))}
                />
              )}
              {formState.secretMode === "preset" && availableApiKeyPresets.length === 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950">
                  {t("models.form.noPresetAvailable")}
                </div>
              ) : remoteSecretMissing ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950">
                  {t("models.form.remoteSecretMissing")}
                </div>
              ) : null}
            </div>
          </ModalField>

          {/* Timeout + Context + Pricing (4 cols) */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ModalField label={t("models.form.timeoutSeconds")}>
              <Input
                inputMode="numeric"
                placeholder="60"
                value={formState.timeoutSeconds}
                onChange={(event) => updateForm((c) => ({ ...c, timeoutSeconds: event.target.value }))}
              />
            </ModalField>
            <ModalField label={t("models.form.contextWindow")}>
              <Input
                inputMode="numeric"
                placeholder={t("models.form.contextWindowPlaceholder")}
                value={formState.contextWindow}
                onChange={(event) => updateForm((c) => ({ ...c, contextWindow: event.target.value }))}
              />
            </ModalField>
            <ModalField label={t("models.form.inputPricing")}>
              <Input
                inputMode="decimal"
                placeholder={t("models.form.pricingPlaceholder")}
                disabled={formState.runtimeType === "local"}
                value={formState.pricingInputPerMillion}
                onChange={(event) => updateForm((c) => ({ ...c, pricingInputPerMillion: event.target.value }))}
              />
            </ModalField>
            <ModalField label={t("models.form.outputPricing")}>
              <Input
                inputMode="decimal"
                placeholder={t("models.form.pricingPlaceholder")}
                disabled={formState.runtimeType === "local"}
                value={formState.pricingOutputPerMillion}
                onChange={(event) => updateForm((c) => ({ ...c, pricingOutputPerMillion: event.target.value }))}
              />
            </ModalField>
          </div>

          {/* Notes */}
          <ModalField label={t("models.form.notes")}>
            <Textarea
              placeholder={t("models.form.notesPlaceholder")}
              value={formState.notes}
              onChange={(event) => updateForm((c) => ({ ...c, notes: event.target.value }))}
            />
          </ModalField>

          {/* Local load instructions (local runtime only) */}
          {formState.runtimeType === "local" ? (
            <ModalField label={t("models.form.localLoadInstructions")}>
              <Textarea
                placeholder={t("models.form.localLoadInstructionsPlaceholder")}
                value={formState.localLoadInstructions}
                onChange={(event) => updateForm((c) => ({ ...c, localLoadInstructions: event.target.value }))}
              />
            </ModalField>
          ) : null}

          {/* Active toggle */}
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border/80 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <input
              checked={formState.isActive}
              className="h-4 w-4 rounded border-border"
              onChange={(event) => updateForm((c) => ({ ...c, isActive: event.target.checked }))}
              type="checkbox"
            />
            {t("models.form.isActive")}
          </label>

          {feedback ? (
            <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
              {feedback}
            </div>
          ) : null}
        </form>
      </Modal>

      {warningModel && warningAnchor
        ? createPortal(
            <div
              className="fixed z-[999] w-72 rounded-2xl border border-amber-200 bg-amber-50/95 px-3 py-2 text-xs leading-5 text-amber-950 shadow-xl backdrop-blur-sm"
              onMouseEnter={() => openWarning(warningModel)}
              onMouseLeave={closeWarningSoon}
              style={{
                left: Math.min(warningAnchor.left, window.innerWidth - 288 - 12),
                top: warningAnchor.bottom + 8,
              }}
            >
              <p className="font-semibold">{t("models.missingSecretTitle")}</p>
              <p className="mt-1">
                {t("models.missingSecretDesc")}
              </p>
            </div>,
            document.body,
          )
        : null}

      {toast
        ? createPortal(
            <div className="fixed bottom-5 right-5 z-[1000] w-[22rem] rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950 shadow-xl">
              <p className="font-semibold">{t("models.toastDone")}</p>
              <p className="mt-1 leading-6">{toast.message}</p>
            </div>,
            document.body,
          )
        : null}

    </div>
  );
}

function RuntimeBadge({
  runtimeType,
}: {
  runtimeType: ModelProfile["runtime_type"];
}) {
  return (
    <Badge variant={runtimeType === "remote" ? "accent" : "neutral"}>
      {runtimeType === "remote" ? (
        <Cable className="mr-1.5 h-3 w-3" />
      ) : (
        <HardDrive className="mr-1.5 h-3 w-3" />
      )}
      {runtimeType}
    </Badge>
  );
}

function RoleBadge({ role }: { role: ModelProfile["role"] }) {
  const variant =
    role === "both" ? "accent" : role === "judge" ? "neutral" : "success";

  return <Badge variant={variant as "accent" | "neutral" | "success"}>{role}</Badge>;
}

function TableEmptyRow({ message }: { message: string }) {
  return (
    <tr className="border-t border-border/70">
      <td className="px-5 py-12 text-center text-sm text-slate-500" colSpan={6}>
        {message}
      </td>
    </tr>
  );
}

function ModalField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </span>
      {children}
    </div>
  );
}
