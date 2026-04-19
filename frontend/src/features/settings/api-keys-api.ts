import { apiRequest } from "@/lib/api";

import type {
  ApiKeyPreset,
  ApiKeyPresetListResponse,
  ApiKeyPresetPayload,
} from "@/features/settings/api-keys-types";

export function fetchApiKeyPresets(): Promise<ApiKeyPresetListResponse> {
  return apiRequest<ApiKeyPresetListResponse>("/api-key-presets");
}

export function createApiKeyPreset(
  payload: ApiKeyPresetPayload,
): Promise<ApiKeyPreset> {
  return apiRequest<ApiKeyPreset>("/api-key-presets", {
    method: "POST",
    body: payload,
  });
}

export function updateApiKeyPreset(
  presetId: number,
  payload: ApiKeyPresetPayload,
): Promise<ApiKeyPreset> {
  return apiRequest<ApiKeyPreset>(`/api-key-presets/${presetId}`, {
    method: "PATCH",
    body: payload,
  });
}

export function deleteApiKeyPreset(presetId: number): Promise<void> {
  return apiRequest<void>(`/api-key-presets/${presetId}`, {
    method: "DELETE",
  });
}

