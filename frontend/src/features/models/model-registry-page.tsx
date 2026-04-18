import type { FormEvent, ReactNode } from "react";
import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import {
  Cable,
  CircleGauge,
  Database,
  HardDrive,
  TriangleAlert,
  Plus,
  Search,
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MetricCard } from "@/components/ui/metric-card";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api";
import { queryClient } from "@/lib/query-client";
import { cn } from "@/lib/utils";

type ModelFormState = {
  displayName: string;
  role: "candidate" | "judge" | "both";
  providerType: string;
  apiStyle: string;
  runtimeType: "remote" | "local";
  endpointUrl: string;
  modelIdentifier: string;
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

const emptyForm: ModelFormState = {
  displayName: "",
  role: "candidate",
  providerType: "openai",
  apiStyle: "openai_compatible",
  runtimeType: "remote",
  endpointUrl: "https://api.openai.com/v1/chat/completions",
  modelIdentifier: "gpt-5.2",
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
    modelIdentifiers: ["gpt-5.2", "gpt-5-mini", "gpt-5-nano", "gpt-4.1"],
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
};

const providerOptions = Object.keys(providerPresets);
const apiStyleOptions = ["openai_compatible", "huggingface"];

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

function getFieldHintLabel(providerType: string): string {
  return getProviderPreset(providerType)?.label ?? "this provider";
}

function toFormState(model: ModelProfile): ModelFormState {
  return {
    displayName: model.display_name,
    role: model.role,
    providerType: model.provider_type,
    apiStyle: model.api_style,
    runtimeType: model.runtime_type,
    endpointUrl: model.endpoint_url,
    modelIdentifier: model.model_identifier,
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
    ...(state.secret.trim() ? { secret: state.secret.trim() } : {}),
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

export function ModelRegistryPage() {
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState("");
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
  const [, startTransition] = useTransition();
  const lastSuggestedApiStyleRef = useRef<string | null>(null);
  const lastSuggestedEndpointRef = useRef<string | null>(null);
  const lastSuggestedModelRef = useRef<string | null>(null);
  const warningCloseTimerRef = useRef<number | null>(null);
  const toastCloseTimerRef = useRef<number | null>(null);

  const modelsQuery = useQuery({
    queryKey: ["model-profiles", showArchived],
    queryFn: () => fetchModelProfiles(showArchived),
  });

  useEffect(() => {
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

  useEffect(
    () => () => {
      if (warningCloseTimerRef.current !== null) {
        window.clearTimeout(warningCloseTimerRef.current);
      }
      if (toastCloseTimerRef.current !== null) {
        window.clearTimeout(toastCloseTimerRef.current);
      }
    },
    [],
  );

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
      showToast(
        selectedModel
          ? `Model "${model.display_name}" updated.`
          : `Model "${model.display_name}" created.`,
      );
      setIsEditorOpen(false);
      startTransition(() => {
        setSelectedModel(model);
        setFormState(toFormState(model));
      });
    },
    onError: (error) => {
      setFeedback(
        error instanceof ApiError ? error.message : "Unable to save model profile.",
      );
    },
  });

  const archiveMutation = useMutation({
    mutationFn: archiveModelProfile,
    onSuccess: async (model) => {
      await queryClient.invalidateQueries({ queryKey: ["model-profiles"] });
      setFeedback(null);
      showToast(`Model "${model.display_name}" archived.`);
      setIsEditorOpen(false);
      startTransition(() => {
        setSelectedModel(null);
      });
    },
    onError: (error) => {
      setFeedback(
        error instanceof ApiError
          ? error.message
          : "Unable to archive model profile.",
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
      setConnectionFeedback({
        ...result,
        modelId: model.id,
      });
    },
    onError: (error, model) => {
      setConnectionFeedback({
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
  const visibleModels = scopedModels.filter((model) =>
    matchesSearch(model, search),
  );
  const loadError =
    (modelsQuery.error instanceof ApiError && modelsQuery.error.message) || null;

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
  const suggestedEndpointUrl = getSuggestedEndpointUrl(formState);
  const hasStoredSecret = selectedModel?.has_secret ?? false;
  const hasFormSecret = formState.secret.trim().length > 0;
  const remoteSecretMissing =
    formState.runtimeType === "remote" && !(hasStoredSecret || hasFormSecret);

  const updateFormWithSuggestions = (
    updater: (current: ModelFormState) => ModelFormState,
    options?: {
      preserveApiStyleInput?: boolean;
      preserveEndpointInput?: boolean;
      preserveModelIdentifierInput?: boolean;
    },
  ) => {
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
    setIsEditorOpen(true);
  };

  const openEditModal = (model: ModelProfile) => {
    startTransition(() => {
      setSelectedModel(model);
      setFeedback(null);
    });
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);
    await saveMutation.mutateAsync(toPayload(formState));
  };

  return (
    <div className="px-5 py-8 lg:px-10 lg:py-10">
      <section className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.2),_transparent_28%),linear-gradient(135deg,_rgba(239,246,255,0.98),_rgba(255,255,255,0.96))] p-6 shadow-xl lg:p-8">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.05)_1px,transparent_1px)] bg-[size:26px_26px] opacity-50" />
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-4">
            <span className="inline-flex rounded-full border border-sky-300 bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-sky-950">
              Connection Profiles
            </span>
            <div className="space-y-3">
              <h1 className="font-display text-4xl font-semibold tracking-tight text-slate-950 lg:text-5xl">
                Model Registry
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-600">
                Manage candidate and judge profiles across remote APIs and local
                runtimes, with masked secrets and direct endpoint validation.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard
              icon={Database}
              label="Visible Models"
              tone="sky"
              value={String(visibleModels.length)}
            />
            <MetricCard
              icon={CircleGauge}
              label="Candidates"
              tone="sky"
              value={String(roleCounts?.candidates ?? 0)}
            />
            <MetricCard
              icon={Shield}
              label="Judges"
              tone="sky"
              value={String(roleCounts?.judges ?? 0)}
            />
          </div>
        </div>
      </section>

      <section className="mt-8">
        <Card className="overflow-hidden border-border/70 bg-white/90 shadow-sm">
          <div className="border-b border-border/80 px-5 py-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">
                  Shared Model Profiles
                </h2>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <label className="relative block min-w-64">
                  <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                  <Input
                    className="pl-9"
                    placeholder="Search names, providers, runtimes"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </label>
                <Button
                  variant={showArchived ? "secondary" : "ghost"}
                  onClick={() => setShowArchived((current) => !current)}
                >
                  {showArchived ? "Show unarchived" : "Show archived"}
                </Button>
                <Button onClick={openCreateModal}>
                  <Plus className="h-4 w-4" />
                  New profile
                </Button>
              </div>
            </div>
          </div>

          {loadError ? (
            <div className="border-b border-rose-200 bg-rose-50 px-5 py-3 text-sm text-rose-900">
              {loadError}
            </div>
          ) : null}

          {feedback ? (
            <div className="border-b border-sky-200 bg-sky-50 px-5 py-3 text-sm text-sky-950">
              {feedback}
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed text-left">
              <thead className="bg-slate-50 text-xs uppercase tracking-[0.16em] text-slate-500">
                <tr>
                  <th className="w-[26%] px-5 py-3 font-semibold">Display name</th>
                  <th className="w-[10%] px-5 py-3 font-semibold">Role</th>
                  <th className="w-[15%] px-5 py-3 font-semibold">Provider</th>
                  <th className="w-[10%] px-5 py-3 font-semibold">Runtime</th>
                  <th className="w-[14%] px-5 py-3 font-semibold">Status</th>
                  <th className="w-[8%] px-5 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {modelsQuery.isLoading ? (
                  <TableEmptyRow message="Loading model registry..." />
                ) : visibleModels.length === 0 ? (
                  <TableEmptyRow
                    message={
                      showArchived
                        ? "No archived model profiles yet."
                        : "No model profiles match the current filters."
                    }
                  />
                ) : (
                  visibleModels.map((model) => {
                    const isSelected = selectedModel?.id === model.id;
                    const isTestingConnection = testingModelId === model.id;
                    const rowConnectionFeedback =
                      connectionFeedback?.modelId === model.id ? connectionFeedback : null;
                    const isUnusable = model.runtime_type === "remote" && !model.has_secret;

                    return (
                      <tr
                        key={model.id}
                        className={cn(
                          "cursor-pointer border-t border-border/70 transition-colors",
                          isSelected && "bg-sky-50/70",
                          isUnusable && "bg-slate-50/80 text-slate-500 opacity-75",
                        )}
                        onClick={() => {
                          openEditModal(model);
                        }}
                      >
                        <td className="relative px-5 py-4 align-top">
                          <div className="flex items-start gap-3">
                            <Button
                              aria-label={`Test connection for ${model.display_name}`}
                              disabled={testConnectionMutation.isPending || isUnusable}
                              onClick={(event) => {
                                event.stopPropagation();
                                testConnectionMutation.mutate(model);
                              }}
                              size="iconSm"
                              title={`Test connection for ${model.display_name}`}
                              type="button"
                              variant="soft"
                            >
                              <TestTube2
                                className={cn(
                                  "h-4 w-4",
                                  isTestingConnection && "animate-pulse text-sky-700",
                                )}
                              />
                            </Button>
                            <div className="min-w-0 space-y-1">
                              <div className="flex items-center gap-2">
                                {isUnusable ? (
                                  <button
                                    aria-label={`Explain missing secret for ${model.display_name}`}
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
                                    title="Missing secret"
                                  >
                                    <TriangleAlert className="h-4 w-4" />
                                  </button>
                                ) : null}
                                <p
                                  className="block w-full truncate text-left text-sm font-semibold text-slate-950 transition hover:text-sky-900"
                                  title={model.display_name}
                                >
                                  {model.display_name}
                                </p>
                              </div>
                              <p
                                className="truncate text-sm text-slate-500"
                                title={model.model_identifier}
                              >
                                {model.model_identifier}
                              </p>
                              {isTestingConnection ? (
                                <p className="truncate text-xs font-medium text-sky-700">
                                  Testing connection...
                                </p>
                              ) : rowConnectionFeedback ? (
                                <p
                                  className={cn(
                                    "truncate text-xs font-medium",
                                    rowConnectionFeedback.ok
                                      ? "text-emerald-700"
                                      : "text-rose-700",
                                  )}
                                  title={
                                    rowConnectionFeedback.status_code
                                      ? `HTTP ${rowConnectionFeedback.status_code} — ${rowConnectionFeedback.detail}`
                                      : rowConnectionFeedback.detail
                                  }
                                >
                                  {rowConnectionFeedback.status_code
                                    ? `HTTP ${rowConnectionFeedback.status_code} — `
                                    : ""}
                                  {rowConnectionFeedback.detail}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 align-top">
                          <RoleBadge role={model.role} />
                        </td>
                        <td className="px-5 py-4 align-top">
                          <div className="flex flex-col gap-2">
                            <Badge variant="accent">{model.provider_type}</Badge>
                            <Badge variant="neutral">{model.api_style}</Badge>
                          </div>
                        </td>
                        <td className="px-5 py-4 align-top">
                          <RuntimeBadge runtimeType={model.runtime_type} />
                        </td>
                        <td className="px-5 py-4 align-top">
                          <div className="flex flex-wrap gap-2">
                            <Badge variant={model.is_archived ? "muted" : "success"}>
                              {model.is_archived ? "Archived" : "Active"}
                            </Badge>
                            {!model.is_active && !model.is_archived ? (
                              <Badge variant="neutral">Inactive</Badge>
                            ) : null}
                            {isUnusable ? <Badge variant="muted">Missing secret</Badge> : null}
                          </div>
                        </td>
                        <td className="px-5 py-4 align-top" onClick={(event) => event.stopPropagation()}>
                          <div className="flex justify-end gap-1.5">
                            <Button
                              aria-label={`Archive ${model.display_name}`}
                              size="iconSm"
                              title={`Archive ${model.display_name}`}
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
        description="Create a new shared model profile or adjust an existing one from a dedicated editor."
        onClose={() => setIsEditorOpen(false)}
        open={isEditorOpen}
        size="xl"
        title={selectedModel ? "Edit profile" : "Create profile"}
      >
        <form className="space-y-5" onSubmit={handleSubmit}>
          {loadError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
              {loadError}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              hint='Example: "GPT-4.1 Mini - Remote"'
              label="Display name"
            >
              <Input
                placeholder="GPT-4.1 Mini - Remote"
                required
                value={formState.displayName}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    displayName: event.target.value,
                  }))
                }
              />
            </Field>
            <Field
              hint="Choose Candidate for generation, Judge for scoring, or Both."
              label="Role"
            >
              <Select
                value={formState.role}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    role: event.target.value as ModelFormState["role"],
                  }))
                }
              >
                <option value="candidate">Candidate</option>
                <option value="judge">Judge</option>
                <option value="both">Both</option>
              </Select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              hint='Pick a known provider or type your own value. Example: "openai", "google", "mistral", "groq", "deepseek", "huggingface" or "ollama".'
              label="Provider type"
            >
              <Input
                list="provider-type-options"
                placeholder="openai"
                value={formState.providerType}
                onChange={(event) =>
                  updateFormWithSuggestions((current) => ({
                    ...current,
                    providerType: event.target.value,
                  }))
                }
              />
            </Field>
            <Field
              hint='Recommended options are driven by the provider. You can still type a custom style if you know what you are doing.'
              label="API style"
            >
              <Input
                list="api-style-options"
                placeholder="openai_compatible"
                value={formState.apiStyle}
                onChange={(event) =>
                  updateFormWithSuggestions((current) => ({
                    ...current,
                    apiStyle: event.target.value,
                  }), { preserveApiStyleInput: true })
                }
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              hint="Choose Remote for API calls or Local for operator-driven execution."
              label="Runtime type"
            >
              <Select
                value={formState.runtimeType}
                onChange={(event) =>
                  setFormState((current) => {
                    const runtimeType = event.target.value as ModelFormState["runtimeType"];
                    return {
                      ...current,
                      runtimeType,
                      pricingInputPerMillion:
                        runtimeType === "local" ? "0" : current.pricingInputPerMillion,
                      pricingOutputPerMillion:
                        runtimeType === "local" ? "0" : current.pricingOutputPerMillion,
                    };
                  })
                }
              >
                <option value="remote">Remote</option>
                <option value="local">Local</option>
              </Select>
            </Field>
          </div>

          <Field
            hint={`Auto-filled from ${getFieldHintLabel(formState.providerType)}. You can still override it manually if your deployment uses a custom URL.`}
            label="Endpoint URL"
          >
            <Input
              placeholder={suggestedEndpointUrl || "https://api.openai.com/v1/chat/completions"}
              required
              value={formState.endpointUrl}
              onChange={(event) =>
                updateFormWithSuggestions(
                  (current) => ({
                    ...current,
                    endpointUrl: event.target.value,
                  }),
                  { preserveEndpointInput: true },
                )
              }
            />
          </Field>

          <Field
            hint={`Suggested from ${getFieldHintLabel(formState.providerType)} docs. You can select one or type any custom identifier.`}
            label="Model identifier"
          >
            <Input
              list="model-identifier-options"
              placeholder={
                modelIdentifierSuggestions[0] ?? "gpt-5-mini"
              }
              required
              value={formState.modelIdentifier}
              onChange={(event) =>
                updateFormWithSuggestions(
                  (current) => ({
                    ...current,
                    modelIdentifier: event.target.value,
                  }),
                  { preserveModelIdentifierInput: true },
                )
              }
            />
          </Field>

          <Field
            hint={
              formState.runtimeType === "local"
                ? "Local runtime does not require a secret."
                : remoteSecretMissing
                  ? "Remote models need a secret before they are usable."
                  : hasStoredSecret
                  ? "Leave empty to keep the existing secret unchanged."
                  : "Remote models need a secret before they are usable."
            }
            label="Secret"
          >
            <div className="space-y-2">
              <Input
                placeholder={
                  formState.runtimeType === "local"
                    ? "Not required for local runtime"
                    : remoteSecretMissing
                      ? "Optional bearer token"
                      : hasStoredSecret
                      ? "Leave blank to keep stored secret"
                      : "Optional bearer token"
                }
                type="password"
                value={formState.secret}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    secret: event.target.value,
                  }))
                }
              />
              {formState.runtimeType === "local" ? (
                <p className="text-xs text-slate-500">
                  No secret is needed for local runtimes.
                </p>
              ) : remoteSecretMissing ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-950">
                  Remote models without a secret are marked unusable until one is set.
                </div>
              ) : hasStoredSecret ? (
                <p className="text-xs text-slate-500">
                  A secret is already stored. Leave this blank to keep it unchanged.
                </p>
              ) : null}
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              hint='Example: "60"'
              label="Timeout seconds"
            >
              <Input
                inputMode="numeric"
                placeholder="60"
                value={formState.timeoutSeconds}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    timeoutSeconds: event.target.value,
                  }))
                }
              />
            </Field>
            <Field
              hint='Example: "128000"'
              label="Context window"
            >
              <Input
                inputMode="numeric"
                placeholder="Optional"
                value={formState.contextWindow}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    contextWindow: event.target.value,
                  }))
                }
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              hint={
                formState.runtimeType === "local"
                  ? "Local runtimes are forced to 0."
                  : 'Example: "0.15"'
              }
              label="Input pricing / 1M"
            >
              <Input
                inputMode="decimal"
                placeholder="Optional"
                disabled={formState.runtimeType === "local"}
                value={formState.pricingInputPerMillion}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    pricingInputPerMillion: event.target.value,
                  }))
                }
              />
            </Field>
            <Field
              hint={
                formState.runtimeType === "local"
                  ? "Local runtimes are forced to 0."
                  : 'Example: "0.60"'
              }
              label="Output pricing / 1M"
            >
              <Input
                inputMode="decimal"
                placeholder="Optional"
                disabled={formState.runtimeType === "local"}
                value={formState.pricingOutputPerMillion}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    pricingOutputPerMillion: event.target.value,
                  }))
                }
              />
            </Field>
          </div>

          <Field
            hint='Example: "Use for fast draft generation on short prompts."'
            label="Notes"
          >
            <Textarea
              placeholder="Use for fast draft generation on short prompts."
              value={formState.notes}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
            />
          </Field>

          <Field
            hint='Example: "Launch Ollama, load the model, then click Confirm ready."'
            label="Local load instructions"
          >
            <Textarea
              placeholder="Launch Ollama, load the model, then click Confirm ready."
              value={formState.localLoadInstructions}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  localLoadInstructions: event.target.value,
                }))
              }
            />
          </Field>

          <label className="flex items-center gap-3 rounded-2xl border border-border/80 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input
              checked={formState.isActive}
              className="h-4 w-4 rounded border-border"
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  isActive: event.target.checked,
                }))
              }
              type="checkbox"
            />
            Profile available for new sessions
          </label>
          <p className="-mt-2 text-xs leading-5 text-slate-500">
            Disable this if the profile should stay in history but no longer appear in
            new session setup.
          </p>

          {feedback ? (
            <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
              {feedback}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-5">
            {selectedModel ? (
              <Button
                aria-label={`Archive ${selectedModel.display_name}`}
                disabled={archiveMutation.isPending || selectedModel.is_archived}
                onClick={() => archiveMutation.mutate(selectedModel.id)}
                size="iconSm"
                title={`Archive ${selectedModel.display_name}`}
                type="button"
                variant="dangerSoft"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : null}
            <Button onClick={() => setIsEditorOpen(false)} type="button" variant="soft">
              Cancel
            </Button>
            <Button
              disabled={
                saveMutation.isPending ||
                !formState.displayName.trim() ||
                !formState.endpointUrl.trim() ||
                !formState.modelIdentifier.trim() ||
                !formState.timeoutSeconds.trim()
              }
              type="submit"
            >
              {selectedModel ? "Save changes" : "Create profile"}
            </Button>
          </div>
        </form>
        <datalist id="provider-type-options">
          {providerOptions.map((provider) => (
            <option key={provider} value={provider}>
              {providerPresets[provider].label}
            </option>
          ))}
        </datalist>
        <datalist id="api-style-options">
          {apiStyleOptions.map((apiStyle) => (
            <option key={apiStyle} value={apiStyle} />
          ))}
        </datalist>
        <datalist id="model-identifier-options">
          {modelIdentifierSuggestions.map((modelIdentifier) => (
            <option key={modelIdentifier} value={modelIdentifier} />
          ))}
        </datalist>
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
              <p className="font-semibold">Secret missing</p>
              <p className="mt-1">
                This remote model cannot be used until a secret is configured.
              </p>
            </div>,
            document.body,
          )
        : null}

      {toast
        ? createPortal(
            <div className="fixed bottom-5 right-5 z-[1000] w-[22rem] rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950 shadow-xl">
              <p className="font-semibold">Done</p>
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

function Field({
  children,
  hint,
  label,
}: {
  children: ReactNode;
  hint?: string;
  label: string;
}) {
  return (
    <label className="block space-y-2">
      <span className="block">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        {hint ? (
          <span className="mt-1 block text-xs leading-5 text-slate-500">{hint}</span>
        ) : null}
      </span>
      {children}
    </label>
  );
}
