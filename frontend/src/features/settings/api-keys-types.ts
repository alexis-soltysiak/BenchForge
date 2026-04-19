export type ApiKeyPreset = {
  id: number;
  name: string;
  provider_type: string;
  has_secret: boolean;
  secret_preview: string | null;
  created_at: string;
  updated_at: string;
};

export type ApiKeyPresetListResponse = {
  items: ApiKeyPreset[];
  total: number;
};

export type ApiKeyPresetPayload = {
  name: string;
  provider_type: string;
  secret?: string | null;
};
