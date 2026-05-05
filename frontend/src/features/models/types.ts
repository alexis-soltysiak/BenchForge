export type ModelProfile = {
  id: number;
  display_name: string;
  slug: string;
  role: "candidate" | "judge" | "both";
  provider_type: string;
  api_style: string;
  runtime_type: "remote" | "local";
  endpoint_url: string;
  model_identifier: string;
  has_secret: boolean;
  secret_preview: string | null;
  api_key_preset_id: number | null;
  timeout_seconds: number;
  context_window: number | null;
  pricing_input_per_million: string | null;
  pricing_output_per_million: string | null;
  notes: string | null;
  local_load_instructions: string | null;
  is_active: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

export type ModelProfileListResponse = {
  items: ModelProfile[];
  total: number;
};

export type ModelProfilePayload = {
  display_name: string;
  role: "candidate" | "judge" | "both";
  provider_type: string;
  api_style: string;
  runtime_type: "remote" | "local";
  endpoint_url: string;
  model_identifier: string;
  secret?: string | null;
  api_key_preset_id?: number | null;
  timeout_seconds: number;
  context_window: number | null;
  pricing_input_per_million: string | null;
  pricing_output_per_million: string | null;
  notes: string | null;
  local_load_instructions: string | null;
  is_active: boolean;
};

export type ConnectionTestResponse = {
  ok: boolean;
  status_code: number | null;
  detail: string;
};

export type ModelFormState = {
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

export type ConnectionFeedbackState = ConnectionTestResponse & {
  modelId: number;
};

export type ToastState = {
  message: string;
  kind: "success";
};

export type ModelFilterState = {
  showArchived: boolean;
  search: string;
  selectedRoles: ModelFormState["role"][];
  selectedProviderType: string;
  selectedRuntimeType: string;
};

export type ProviderPreset = {
  apiStyle: string;
  endpointUrl?: string;
  label: string;
  modelIdentifiers: string[];
};

export type TFunc = (key: string, opts?: Record<string, unknown>) => string;
