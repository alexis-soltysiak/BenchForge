import { apiRequest } from "@/lib/api";

import type {
  Prompt,
  PromptCategory,
  PromptListResponse,
  PromptPayload,
} from "@/features/prompts/types";

export function fetchPromptCategories(): Promise<PromptCategory[]> {
  return apiRequest<PromptCategory[]>("/prompt-categories");
}

export function fetchPrompts(includeArchived: boolean): Promise<PromptListResponse> {
  const params = new URLSearchParams();
  if (includeArchived) {
    params.set("include_archived", "true");
  }

  const search = params.toString();
  return apiRequest<PromptListResponse>(`/prompts${search ? `?${search}` : ""}`);
}

export function createPrompt(payload: PromptPayload): Promise<Prompt> {
  return apiRequest<Prompt>("/prompts", {
    method: "POST",
    body: payload,
  });
}

export function updatePrompt(promptId: number, payload: PromptPayload): Promise<Prompt> {
  return apiRequest<Prompt>(`/prompts/${promptId}`, {
    method: "PATCH",
    body: payload,
  });
}

export function archivePrompt(promptId: number): Promise<Prompt> {
  return apiRequest<Prompt>(`/prompts/${promptId}/archive`, {
    method: "POST",
  });
}

