import { apiRequest } from "@/lib/api";

import type {
  ConnectionTestResponse,
  ModelProfile,
  ModelProfileListResponse,
  ModelProfilePayload,
} from "@/features/models/types";

export function fetchModelProfiles(
  includeArchived: boolean,
): Promise<ModelProfileListResponse> {
  const params = new URLSearchParams();
  if (includeArchived) {
    params.set("include_archived", "true");
  }

  const search = params.toString();
  return apiRequest<ModelProfileListResponse>(
    `/model-profiles${search ? `?${search}` : ""}`,
  );
}

export function fetchMachineLabels(): Promise<string[]> {
  return apiRequest<string[]>("/model-profiles/machine-labels");
}

export function createModelProfile(
  payload: ModelProfilePayload,
): Promise<ModelProfile> {
  return apiRequest<ModelProfile>("/model-profiles", {
    method: "POST",
    body: payload,
  });
}

export function updateModelProfile(
  modelId: number,
  payload: ModelProfilePayload,
): Promise<ModelProfile> {
  return apiRequest<ModelProfile>(`/model-profiles/${modelId}`, {
    method: "PATCH",
    body: payload,
  });
}

export function archiveModelProfile(modelId: number): Promise<ModelProfile> {
  return apiRequest<ModelProfile>(`/model-profiles/${modelId}/archive`, {
    method: "POST",
  });
}

export function testModelProfileConnection(
  modelId: number,
  timeoutSeconds?: number,
): Promise<ConnectionTestResponse> {
  return apiRequest<ConnectionTestResponse>(
    `/model-profiles/${modelId}/test-connection`,
    {
      method: "POST",
      body: timeoutSeconds ? { timeout_seconds: timeoutSeconds } : {},
    },
  );
}

