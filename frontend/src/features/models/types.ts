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
