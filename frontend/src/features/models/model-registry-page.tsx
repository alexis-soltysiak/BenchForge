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
import { Input } from "@/components/ui/input";
import { LoadErrorState } from "@/components/ui/load-error-state";
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
    <div className="text-foreground">
      {/* ── Header ── */}
      <header className="px-6 lg:px-8 pt-8 pb-6 border-b border-border/50">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[0.62rem] font-bold uppercase tracking-[0.28em] text-primary/80 mb-1.5">
              {t("models.connectionProfiles")}
            </p>
            <h1 className="text-[1.75rem] font-semibold tracking-tight text-foreground leading-none">
              {t("models.pageTitle")}
            </h1>
            <div className="flex items-center gap-1 mt-3 flex-wrap">
              <div className="flex items-center gap-1.5 text-[0.78rem] text-muted-foreground">
                <Database className="h-3.5 w-3.5 shrink-0" />
                <span>
                  <span className="font-semibold text-foreground">{visibleModels.length}</span>{" "}
                  {t("models.metricVisible")}
                </span>
              </div>
              <span className="text-border/60 mx-1.5">·</span>
              <div className="flex items-center gap-1.5 text-[0.78rem] text-muted-foreground">
                <CircleGauge className="h-3.5 w-3.5 shrink-0" />
                <span>
                  <span className="font-semibold text-foreground">{roleCounts.candidates}</span>{" "}
                  {t("models.metricCandidates")}
                </span>
              </div>
              <span className="text-border/60 mx-1.5">·</span>
              <div className="flex items-center gap-1.5 text-[0.78rem] text-muted-foreground">
                <Shield className="h-3.5 w-3.5 shrink-0" />
                <span>
                  <span className="font-semibold text-foreground">{roleCounts.judges}</span>{" "}
                  {t("models.metricJudges")}
                </span>
              </div>
            </div>
          </div>
          <Button className="shrink-0" onClick={openCreateModal}>
            <Plus className="h-4 w-4" />
            {t("models.newProfile")}
          </Button>
        </div>
      </header>

      {/* ── Filter bar ── */}
      <div className="px-6 lg:px-8 py-3 border-b border-border/40 flex items-center gap-2 flex-wrap">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="h-9 w-52 pl-8 text-sm rounded-lg"
            placeholder={t("models.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>

        {/* Role filter */}
        <div className="relative z-40">
          <button
            type="button"
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[0.82rem] font-medium transition",
              selectedRoles.length > 0
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-[hsl(var(--surface))] text-foreground hover:bg-[hsl(var(--surface-muted))]",
            )}
            onClick={() => { setIsRoleMenuOpen((v) => !v); setIsProviderMenuOpen(false); setIsRuntimeMenuOpen(false); }}
          >
            {selectedRoles.length > 0 ? selectedRoles.map((r) => roleLabel(r, t)).join(", ") : t("models.allRoles")}
            {selectedRoles.length > 0 ? (
              <span
                className="ml-1 opacity-60 hover:opacity-100"
                onClick={(e) => { e.stopPropagation(); setSelectedRoles([]); }}
              >×</span>
            ) : null}
          </button>
          {isRoleMenuOpen ? (
            <div className="absolute left-0 top-[calc(100%+0.4rem)] z-[90] min-w-[14rem] overflow-hidden rounded-xl border border-border bg-[hsl(var(--surface-elevated))] shadow-[0_20px_60px_-16px_rgba(0,0,0,0.5)]">
              <div className="px-3 py-2.5 border-b border-border/60">
                <p className="text-[0.78rem] font-semibold text-foreground">{t("models.pickRoles")}</p>
                <p className="text-[0.68rem] text-muted-foreground mt-0.5">{t("models.pickRolesDesc")}</p>
              </div>
              <div className="py-1">
                {(["candidate", "judge", "both"] as const).map((role) => {
                  const isSelected = selectedRoles.includes(role);
                  return (
                    <button
                      key={role}
                      type="button"
                      className={cn(
                        "flex w-full items-start justify-between gap-2 px-3 py-2.5 text-[0.82rem] text-left transition",
                        isSelected
                          ? "bg-primary/10 text-primary font-semibold"
                          : "text-foreground hover:bg-[hsl(var(--surface-muted))]",
                      )}
                      onClick={() => toggleRole(role)}
                    >
                      <span className="min-w-0">
                        <span className="block font-medium">{roleLabel(role, t)}</span>
                        <span className="block text-[0.68rem] text-muted-foreground">{roleDescription(role, t)}</span>
                      </span>
                      <Check className={cn("h-3.5 w-3.5 shrink-0 mt-0.5", isSelected ? "opacity-100" : "opacity-0")} />
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        {/* Provider filter */}
        <div className="relative z-40">
          <button
            type="button"
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[0.82rem] font-medium transition",
              selectedProviderType !== "all"
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-[hsl(var(--surface))] text-foreground hover:bg-[hsl(var(--surface-muted))]",
            )}
            onClick={() => { setIsProviderMenuOpen((v) => !v); setIsRoleMenuOpen(false); setIsRuntimeMenuOpen(false); }}
          >
            {selectedProviderType === "all" ? t("models.providerLabel") : selectedProviderType}
            {selectedProviderType !== "all" ? (
              <span
                className="ml-1 opacity-60 hover:opacity-100"
                onClick={(e) => { e.stopPropagation(); setSelectedProviderType("all"); }}
              >×</span>
            ) : null}
          </button>
          {isProviderMenuOpen ? (
            <div className="absolute left-0 top-[calc(100%+0.4rem)] z-[90] min-w-[12rem] max-h-72 overflow-y-auto rounded-xl border border-border bg-[hsl(var(--surface-elevated))] shadow-[0_20px_60px_-16px_rgba(0,0,0,0.5)]">
              <div className="px-3 py-2.5 border-b border-border/60">
                <p className="text-[0.78rem] font-semibold text-foreground">{t("models.chooseProvider")}</p>
                <p className="text-[0.68rem] text-muted-foreground mt-0.5">{t("models.chooseProviderDesc")}</p>
              </div>
              <div className="py-1">
                {(["all", ...providerTypeOptions]).map((pt) => {
                  const isSelected = selectedProviderType === pt;
                  const label = pt === "all" ? t("models.allProviders") : pt;
                  return (
                    <button
                      key={pt}
                      type="button"
                      className={cn(
                        "flex w-full items-center justify-between gap-2 px-3 py-2 text-[0.82rem] transition",
                        isSelected
                          ? "bg-primary/10 text-primary font-semibold"
                          : "text-foreground hover:bg-[hsl(var(--surface-muted))]",
                      )}
                      onClick={() => { setSelectedProviderType(pt); setIsProviderMenuOpen(false); }}
                    >
                      <span className="font-medium">{label}</span>
                      {isSelected ? <Check className="h-3.5 w-3.5" /> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        {/* Runtime filter */}
        <div className="relative z-40">
          <button
            type="button"
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[0.82rem] font-medium transition",
              selectedRuntimeType !== "all"
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-[hsl(var(--surface))] text-foreground hover:bg-[hsl(var(--surface-muted))]",
            )}
            onClick={() => { setIsRuntimeMenuOpen((v) => !v); setIsRoleMenuOpen(false); setIsProviderMenuOpen(false); }}
          >
            {selectedRuntimeType === "all" ? t("models.runtimeLabel") : selectedRuntimeType}
            {selectedRuntimeType !== "all" ? (
              <span
                className="ml-1 opacity-60 hover:opacity-100"
                onClick={(e) => { e.stopPropagation(); setSelectedRuntimeType("all"); }}
              >×</span>
            ) : null}
          </button>
          {isRuntimeMenuOpen ? (
            <div className="absolute left-0 top-[calc(100%+0.4rem)] z-[90] min-w-[10rem] overflow-hidden rounded-xl border border-border bg-[hsl(var(--surface-elevated))] shadow-[0_20px_60px_-16px_rgba(0,0,0,0.5)]">
              <div className="px-3 py-2.5 border-b border-border/60">
                <p className="text-[0.78rem] font-semibold text-foreground">{t("models.chooseRuntime")}</p>
                <p className="text-[0.68rem] text-muted-foreground mt-0.5">{t("models.chooseRuntimeDesc")}</p>
              </div>
              <div className="py-1">
                {(["all", "remote", "local"] as const).map((rt) => {
                  const isSelected = selectedRuntimeType === rt;
                  const label = rt === "all" ? t("models.allRuntimes") : rt === "remote" ? t("models.runtime.remote") : t("models.runtime.local");
                  return (
                    <button
                      key={rt}
                      type="button"
                      className={cn(
                        "flex w-full items-center justify-between gap-2 px-3 py-2 text-[0.82rem] transition",
                        isSelected
                          ? "bg-primary/10 text-primary font-semibold"
                          : "text-foreground hover:bg-[hsl(var(--surface-muted))]",
                      )}
                      onClick={() => { setSelectedRuntimeType(rt); setIsRuntimeMenuOpen(false); }}
                    >
                      <span className="font-medium">{label}</span>
                      {isSelected ? <Check className="h-3.5 w-3.5" /> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={!hasAnyFilters}
            title={t("models.resetFilters")}
            aria-label={t("models.resetFilters")}
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-lg transition",
              hasAnyFilters
                ? "text-muted-foreground hover:text-foreground hover:bg-[hsl(var(--surface-muted))]"
                : "text-muted-foreground/25 cursor-default",
            )}
            onClick={() => { setSearch(""); setSelectedRoles([]); setSelectedProviderType("all"); setSelectedRuntimeType("all"); setIsRoleMenuOpen(false); setIsProviderMenuOpen(false); setIsRuntimeMenuOpen(false); }}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title={showArchived ? t("models.showUnarchived") : t("models.showArchived")}
            aria-label={showArchived ? t("models.showUnarchived") : t("models.showArchived")}
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-lg transition",
              showArchived
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-[hsl(var(--surface-muted))]",
            )}
            onClick={() => setShowArchived((v) => !v)}
          >
            <Archive className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Error state */}
      {loadError ? (
        <LoadErrorState message={loadError} onRetry={retryLoad} resourceLabel="the model registry" />
      ) : null}

      {/* Feedback strip */}
      {feedback ? (
        <div className="border-b border-primary/20 bg-primary/5 px-6 lg:px-8 py-2.5 text-[0.82rem] text-primary">
          {feedback}
        </div>
      ) : null}

      {/* ── Table ── */}
      <div className={cn(showArchived && "border-l-2 border-primary/25")}>
        <table className="w-full table-fixed text-left">
          <thead>
            <tr className="border-b border-border/50">
              <th className="px-6 lg:px-8 py-2.5 text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground w-[30%]">{t("models.colDisplayName")}</th>
              <th className="px-4 py-2.5 text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground w-24">{t("models.colRole")}</th>
              <th className="px-4 py-2.5 text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground w-28">{t("models.colProvider")}</th>
              <th className="px-4 py-2.5 text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground w-24">{t("models.colRuntime")}</th>
              <th className="px-4 py-2.5 text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground w-36">{t("models.colStatus")}</th>
              <th className="px-4 py-2.5 w-14" />
            </tr>
          </thead>
          <tbody>
            {modelsQuery.isLoading ? (
              <TableEmptyRow message={t("models.loading")} />
            ) : visibleModels.length === 0 ? (
              <TableEmptyRow message={showArchived ? t("models.noArchivedYet") : t("models.noMatchingFilters")} />
            ) : (
              visibleModels.map((model) => {
                const isSelected = selectedModel?.id === model.id;
                const isTestingConnection = testingModelId === model.id;
                const rowConnectionFeedback = connectionFeedback?.modelId === model.id ? connectionFeedback : null;
                const isUnusable = model.runtime_type === "remote" && !model.has_secret;
                const connectionFeedbackLabel = getConnectionFeedbackLabel(rowConnectionFeedback, isTestingConnection, model.runtime_type, t);
                return (
                  <tr
                    key={model.id}
                    className={cn(
                      "group border-b border-border/30 cursor-pointer transition-colors duration-100",
                      isSelected ? "bg-primary/5" : "hover:bg-[hsl(var(--surface-muted)/0.6)]",
                      isUnusable && "opacity-60",
                    )}
                    onClick={() => openEditModal(model)}
                  >
                    <td className="px-6 lg:px-8 py-3.5 align-middle">
                      <div className="flex items-center gap-3">
                        <Button
                          aria-label={t("models.testConnection", { name: model.display_name })}
                          disabled={testConnectionMutation.isPending || isUnusable}
                          onClick={(e) => { e.stopPropagation(); testConnectionMutation.mutate(model); }}
                          size="iconSm"
                          title={t("models.testConnection", { name: model.display_name })}
                          type="button"
                          variant="soft"
                        >
                          <AnimatedTestTube className={cn("h-4 w-4", isTestingConnection && "animate-pulse text-primary")} />
                        </Button>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {isUnusable ? (
                              <button
                                aria-label={t("models.missingSecretExplain", { name: model.display_name })}
                                className="inline-flex shrink-0 items-center justify-center text-amber-500 transition hover:text-amber-400"
                                onClick={(e) => e.stopPropagation()}
                                onMouseEnter={(e) => showWarning(model, e.currentTarget as HTMLElement)}
                                onMouseLeave={closeWarningSoon}
                                type="button"
                                title={t("models.missingSecret")}
                              >
                                <TriangleAlert className="h-3.5 w-3.5" />
                              </button>
                            ) : null}
                            <p className="truncate text-[0.88rem] font-medium text-foreground" title={model.display_name}>
                              {model.display_name}
                            </p>
                          </div>
                          <p
                            className={cn(
                              "truncate text-[0.78rem] leading-tight transition",
                              isTestingConnection ? "font-medium text-primary" :
                              rowConnectionFeedback ? cn("font-medium", rowConnectionFeedback.ok ? "text-emerald-500" : "text-rose-500") :
                              "text-muted-foreground/50",
                            )}
                            title={isTestingConnection ? t("models.connection.testing") : rowConnectionFeedback ? (rowConnectionFeedback.status_code ? `HTTP ${rowConnectionFeedback.status_code} — ${rowConnectionFeedback.detail}` : rowConnectionFeedback.detail ?? "") : model.model_identifier}
                          >
                            {connectionFeedbackLabel || model.model_identifier}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 align-middle"><RoleBadge role={model.role} /></td>
                    <td className="px-4 py-3.5 align-middle">
                      <Badge variant="accent" className="whitespace-nowrap text-[0.7rem]">{model.provider_type}</Badge>
                    </td>
                    <td className="px-4 py-3.5 align-middle"><RuntimeBadge runtimeType={model.runtime_type} /></td>
                    <td className="px-4 py-3.5 align-middle">
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant={model.is_archived ? "muted" : "success"}>
                          {model.is_archived ? t("models.statusArchived") : t("models.statusActive")}
                        </Badge>
                        {!model.is_active && !model.is_archived ? <Badge variant="neutral">{t("models.statusInactive")}</Badge> : null}
                        {isUnusable ? <Badge variant="muted">{t("models.statusMissingSecret")}</Badge> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 align-middle" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          aria-label={t("common.archive", { name: model.display_name })}
                          disabled={model.is_archived || archiveMutation.isPending}
                          size="iconSm"
                          title={t("common.archive", { name: model.display_name })}
                          variant="dangerSoft"
                          onClick={() => archiveMutation.mutate(model.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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

      {/* ── Modal ── */}
      <Modal
        description={t("models.modal.description")}
        onClose={() => setIsEditorOpen(false)}
        open={isEditorOpen}
        size="xl"
        title={t(selectedModel ? "models.editModal.title" : "models.createModal.title")}
      >
        {feedback ? (
          <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm text-primary">
            {feedback}
          </div>
        ) : null}
        <form>
          <div className="flex gap-0">
            {/* Left panel */}
            <div className="w-52 shrink-0 space-y-5 border-r border-border/50 pr-6">
              <ModalField label={t("models.form.displayName")} required>
                <Input
                  placeholder={t("models.form.displayNamePlaceholder")}
                  value={formState.displayName}
                  onChange={(e) => updateForm((c) => ({ ...c, displayName: e.target.value }))}
                />
              </ModalField>

              <ModalField label={t("models.form.role")}>
                <div className="space-y-1.5">
                  {(["candidate", "judge", "both"] as const).map((r) => {
                    const isSelected = formState.role === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => updateForm((c) => ({ ...c, role: r }))}
                        className={cn(
                          "flex w-full items-center rounded-xl border px-3 py-2 text-left text-[0.78rem] font-medium transition",
                          isSelected
                            ? "border-primary/50 bg-primary/10 text-primary"
                            : "border-border/50 bg-[hsl(var(--surface-muted))] text-muted-foreground hover:border-border hover:text-foreground",
                        )}
                      >
                        {roleLabel(r, t)}
                      </button>
                    );
                  })}
                </div>
              </ModalField>

              <ModalField label={t("models.form.runtimeType")}>
                <div className="flex gap-1.5">
                  {(["remote", "local"] as const).map((rt) => {
                    const isSelected = formState.runtimeType === rt;
                    return (
                      <button
                        key={rt}
                        type="button"
                        onClick={() => updateForm((c) => ({ ...c, runtimeType: rt, pricingInputPerMillion: rt === "local" ? "0" : c.pricingInputPerMillion, pricingOutputPerMillion: rt === "local" ? "0" : c.pricingOutputPerMillion }))}
                        className={cn(
                          "flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-medium transition",
                          isSelected
                            ? "border-primary/50 bg-primary/10 text-primary"
                            : "border-border/50 bg-[hsl(var(--surface-muted))] text-muted-foreground hover:border-border hover:text-foreground",
                        )}
                      >
                        {rt === "remote" ? <Cable className="h-3.5 w-3.5" /> : <HardDrive className="h-3.5 w-3.5" />}
                        {t(`models.runtime.${rt}`)}
                      </button>
                    );
                  })}
                </div>
              </ModalField>

              <ModalField label={t("models.form.providerType")}>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(providerPresets).map(([key, preset]) => {
                    const isSelected = normalizePresetKey(formState.providerType) === key && !customProviderOpen;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => { setCustomProviderOpen(false); updateFormWithSuggestions((c) => ({ ...c, providerType: key })); }}
                        className={cn(
                          "rounded-full border px-2.5 py-0.5 text-[0.68rem] font-medium transition",
                          isSelected
                            ? "border-primary/50 bg-primary/10 text-primary"
                            : "border-border/50 bg-[hsl(var(--surface-muted))] text-muted-foreground hover:border-border hover:text-foreground",
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
                      "inline-flex items-center rounded-full border px-2 py-0.5 text-[0.68rem] font-medium transition",
                      customProviderOpen
                        ? "border-primary/50 bg-primary/10 text-primary"
                        : "border-dashed border-border/50 text-muted-foreground hover:border-border hover:text-foreground",
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
                    onChange={(e) => updateFormWithSuggestions((c) => ({ ...c, providerType: e.target.value }))}
                  />
                ) : null}
              </ModalField>

              <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-border/50 bg-[hsl(var(--surface-muted))] px-3 py-2.5 text-sm text-foreground">
                <input
                  checked={formState.isActive}
                  className="h-4 w-4 rounded border-border"
                  onChange={(e) => updateForm((c) => ({ ...c, isActive: e.target.checked }))}
                  type="checkbox"
                />
                {t("models.form.isActive")}
              </label>
            </div>

            {/* Right panel */}
            <div className="flex-1 space-y-5 pl-6">
              <ModalField label={t("models.form.apiStyle")}>
                <div className="flex gap-1.5">
                  {apiStyleOptions.map((style) => {
                    const isSelected = formState.apiStyle === style;
                    const styleLabel = style === "openai_compatible" ? "OpenAI compat." : style === "anthropic" ? "Anthropic" : "HuggingFace";
                    return (
                      <button
                        key={style}
                        type="button"
                        onClick={() => updateFormWithSuggestions((c) => ({ ...c, apiStyle: style }), { preserveApiStyleInput: true })}
                        className={cn(
                          "flex flex-1 items-center justify-center rounded-xl border px-2 py-2 text-xs font-medium transition",
                          isSelected
                            ? "border-primary/50 bg-primary/10 text-primary"
                            : "border-border/50 bg-[hsl(var(--surface-muted))] text-muted-foreground hover:border-border hover:text-foreground",
                        )}
                      >
                        {styleLabel}
                      </button>
                    );
                  })}
                </div>
              </ModalField>

              <ModalField label={t("models.form.endpointUrl")} required>
                <Input
                  placeholder={suggestedEndpointUrl || "https://api.openai.com/v1/chat/completions"}
                  value={formState.endpointUrl}
                  onChange={(e) => updateFormWithSuggestions((c) => ({ ...c, endpointUrl: e.target.value }), { preserveEndpointInput: true })}
                />
              </ModalField>

              <ModalField label={t("models.form.modelIdentifier")} required>
                <div className="flex flex-wrap gap-1">
                  {modelIdentifierSuggestions.map((id) => {
                    const isSelected = formState.modelIdentifier === id && !customModelOpen;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => { setCustomModelOpen(false); updateFormWithSuggestions((c) => ({ ...c, modelIdentifier: id }), { preserveModelIdentifierInput: true }); }}
                        className={cn(
                          "rounded-full border px-2.5 py-0.5 font-mono text-[0.68rem] font-medium transition",
                          isSelected
                            ? "border-primary/50 bg-primary/10 text-primary"
                            : "border-border/50 bg-[hsl(var(--surface-muted))] text-muted-foreground hover:border-border hover:text-foreground",
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
                      "inline-flex items-center rounded-full border px-2 py-0.5 text-[0.68rem] font-medium transition",
                      customModelOpen
                        ? "border-primary/50 bg-primary/10 text-primary"
                        : "border-dashed border-border/50 text-muted-foreground hover:border-border hover:text-foreground",
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
                    onChange={(e) => updateFormWithSuggestions((c) => ({ ...c, modelIdentifier: e.target.value }), { preserveModelIdentifierInput: true })}
                  />
                ) : null}
              </ModalField>

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
                            onClick={() => updateForm((c) => ({ ...c, secretMode: mode, apiKeyPresetId: mode === "preset" ? c.apiKeyPresetId : "", secret: mode === "manual" ? c.secret : "" }))}
                            className={cn(
                              "flex flex-1 items-center justify-center rounded-xl border px-2 py-1.5 text-xs font-medium transition",
                              isSelected
                                ? "border-primary/50 bg-primary/10 text-primary"
                                : "border-border/50 bg-[hsl(var(--surface-muted))] text-muted-foreground hover:border-border hover:text-foreground",
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
                      onChange={(e) => {
                        const nextApiKeyPresetId = e.target.value;
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
                      onChange={(e) => updateForm((c) => ({ ...c, secret: e.target.value }))}
                    />
                  )}
                  {formState.secretMode === "preset" && availableApiKeyPresets.length === 0 ? (
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs leading-5 text-amber-400">
                      {t("models.form.noPresetAvailable")}
                    </div>
                  ) : remoteSecretMissing ? (
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs leading-5 text-amber-400">
                      {t("models.form.remoteSecretMissing")}
                    </div>
                  ) : null}
                </div>
              </ModalField>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <ModalField label={t("models.form.timeoutSeconds")}>
                  <Input inputMode="numeric" placeholder="60" value={formState.timeoutSeconds} onChange={(e) => updateForm((c) => ({ ...c, timeoutSeconds: e.target.value }))} />
                </ModalField>
                <ModalField label={t("models.form.contextWindow")}>
                  <Input inputMode="numeric" placeholder={t("models.form.contextWindowPlaceholder")} value={formState.contextWindow} onChange={(e) => updateForm((c) => ({ ...c, contextWindow: e.target.value }))} />
                </ModalField>
                <ModalField label={t("models.form.inputPricing")}>
                  <Input inputMode="decimal" placeholder={t("models.form.pricingPlaceholder")} disabled={formState.runtimeType === "local"} value={formState.pricingInputPerMillion} onChange={(e) => updateForm((c) => ({ ...c, pricingInputPerMillion: e.target.value }))} />
                </ModalField>
                <ModalField label={t("models.form.outputPricing")}>
                  <Input inputMode="decimal" placeholder={t("models.form.pricingPlaceholder")} disabled={formState.runtimeType === "local"} value={formState.pricingOutputPerMillion} onChange={(e) => updateForm((c) => ({ ...c, pricingOutputPerMillion: e.target.value }))} />
                </ModalField>
              </div>

              <ModalField label={t("models.form.notes")}>
                <Textarea placeholder={t("models.form.notesPlaceholder")} value={formState.notes} onChange={(e) => updateForm((c) => ({ ...c, notes: e.target.value }))} />
              </ModalField>

              {formState.runtimeType === "local" ? (
                <ModalField label={t("models.form.localLoadInstructions")}>
                  <Textarea placeholder={t("models.form.localLoadInstructionsPlaceholder")} value={formState.localLoadInstructions} onChange={(e) => updateForm((c) => ({ ...c, localLoadInstructions: e.target.value }))} />
                </ModalField>
              ) : null}
            </div>
          </div>
        </form>
      </Modal>

      {/* Warning tooltip */}
      {warningModel && warningAnchor
        ? createPortal(
            <div
              className="fixed z-[999] w-72 rounded-2xl border border-amber-500/20 bg-[hsl(var(--surface-elevated))] px-3 py-2 text-xs leading-5 shadow-xl backdrop-blur-sm"
              onMouseEnter={() => openWarning(warningModel)}
              onMouseLeave={closeWarningSoon}
              style={{ left: Math.min(warningAnchor.left, window.innerWidth - 288 - 12), top: warningAnchor.bottom + 8 }}
            >
              <p className="font-semibold text-amber-400">{t("models.missingSecretTitle")}</p>
              <p className="mt-1 text-muted-foreground">{t("models.missingSecretDesc")}</p>
            </div>,
            document.body,
          )
        : null}

      {/* Toast */}
      {toast
        ? createPortal(
            <div className="fixed bottom-5 right-5 z-[1000] w-[22rem] rounded-2xl border border-border/60 bg-[hsl(var(--surface-elevated))] px-4 py-3 shadow-xl">
              <p className="font-semibold text-emerald-400">{t("models.toastDone")}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{toast.message}</p>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function RuntimeBadge({ runtimeType }: { runtimeType: ModelProfile["runtime_type"] }) {
  return (
    <Badge variant={runtimeType === "remote" ? "accent" : "neutral"}>
      {runtimeType === "remote" ? <Cable className="mr-1.5 h-3 w-3" /> : <HardDrive className="mr-1.5 h-3 w-3" />}
      {runtimeType}
    </Badge>
  );
}

function RoleBadge({ role }: { role: ModelProfile["role"] }) {
  const variant = role === "both" ? "accent" : role === "judge" ? "neutral" : "success";
  return <Badge variant={variant as "accent" | "neutral" | "success"}>{role}</Badge>;
}

function TableEmptyRow({ message }: { message: string }) {
  return (
    <tr className="border-t border-border/30">
      <td className="px-5 py-12 text-center text-sm text-muted-foreground/50" colSpan={6}>
        {message}
      </td>
    </tr>
  );
}

function ModalField({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <span className="block text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
        {required ? <span className="ml-1 text-primary">*</span> : null}
      </span>
      {children}
    </div>
  );
}
