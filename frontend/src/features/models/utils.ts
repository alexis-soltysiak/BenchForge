import type {
  ConnectionFeedbackState,
  ModelFilterState,
  ModelFormState,
  ModelProfile,
  ModelProfilePayload,
  ProviderPreset,
  TFunc,
} from "./types";
import {
  DEFAULT_MODEL_FILTER_STATE,
  MODEL_FILTERS_STORAGE_KEY,
  providerPresets,
} from "./constants";

export function normalizePresetKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

export function getProviderPreset(providerType: string): ProviderPreset | null {
  return providerPresets[normalizePresetKey(providerType)] ?? null;
}

export function getSuggestedEndpointUrl(state: ModelFormState): string {
  if (state.apiStyle.trim().toLowerCase() === "huggingface") {
    return state.modelIdentifier.trim()
      ? `https://api-inference.huggingface.co/models/${state.modelIdentifier.trim()}`
      : "https://api-inference.huggingface.co/models/<your-model-id>";
  }
  return getProviderPreset(state.providerType)?.endpointUrl ?? "";
}

export function shouldAutofillField(
  currentValue: string,
  previousSuggestion: string | null,
): boolean {
  const trimmedValue = currentValue.trim();
  return trimmedValue.length === 0 || trimmedValue === previousSuggestion;
}

export function readModelFilterState(): ModelFilterState {
  if (typeof window === "undefined") return DEFAULT_MODEL_FILTER_STATE;

  const raw = window.localStorage.getItem(MODEL_FILTERS_STORAGE_KEY);
  if (!raw) return DEFAULT_MODEL_FILTER_STATE;

  try {
    const parsed = JSON.parse(raw) as Partial<ModelFilterState>;
    const validRoles = new Set<ModelFormState["role"]>(["candidate", "judge", "both"]);
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
    return DEFAULT_MODEL_FILTER_STATE;
  }
}

export function toFormState(model: ModelProfile): ModelFormState {
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

export function toPayload(state: ModelFormState): ModelProfilePayload {
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

export function matchesSearch(model: ModelProfile, search: string): boolean {
  if (!search) return true;
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

export function matchesArchiveState(model: ModelProfile, showArchived: boolean): boolean {
  return showArchived ? model.is_archived : !model.is_archived;
}

export function matchesRole(
  model: ModelProfile,
  roles: ModelFormState["role"][],
): boolean {
  return roles.length === 0 || roles.includes(model.role);
}

export function matchesProvider(model: ModelProfile, providerType: string): boolean {
  return providerType === "all" || model.provider_type === providerType;
}

export function matchesRuntime(model: ModelProfile, runtimeType: string): boolean {
  return runtimeType === "all" || model.runtime_type === runtimeType;
}

export function roleLabel(role: ModelFormState["role"], t: TFunc): string {
  if (role === "candidate") return t("models.role.candidate");
  if (role === "judge") return t("models.role.judge");
  return t("models.role.both");
}

export function roleDescription(role: ModelFormState["role"], t: TFunc): string {
  if (role === "candidate") return t("models.role.candidateDesc");
  if (role === "judge") return t("models.role.judgeDesc");
  return t("models.role.bothDesc");
}

export function getConnectionFeedbackLabel(
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
  if (feedback.status_code)
    return t("models.connection.failure", { code: feedback.status_code });
  return t("models.connection.failureNoCode");
}

export function uniqueProviderTypes(models: ModelProfile[]): string[] {
  return Array.from(
    new Set(
      models
        .map((model) => model.provider_type.trim())
        .filter((providerType) => providerType.length > 0),
    ),
  ).sort((left, right) => left.localeCompare(right));
}
