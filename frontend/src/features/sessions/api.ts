import { apiRequest } from "@/lib/api";

import type { Run } from "@/features/runs/types";
import type { Session, SessionListResponse, SessionPayload } from "@/features/sessions/types";

export function fetchSessions(includeArchived: boolean): Promise<SessionListResponse> {
  const params = new URLSearchParams();
  if (includeArchived) {
    params.set("include_archived", "true");
  }

  const search = params.toString();
  return apiRequest<SessionListResponse>(`/sessions${search ? `?${search}` : ""}`);
}

export function createSession(payload: SessionPayload): Promise<Session> {
  return apiRequest<Session>("/sessions", {
    method: "POST",
    body: payload,
  });
}

export function updateSession(sessionId: number, payload: Partial<SessionPayload>): Promise<Session> {
  return apiRequest<Session>(`/sessions/${sessionId}`, {
    method: "PATCH",
    body: payload,
  });
}

export function archiveSession(sessionId: number): Promise<Session> {
  return apiRequest<Session>(`/sessions/${sessionId}/archive`, {
    method: "POST",
  });
}

export function duplicateSession(sessionId: number): Promise<Session> {
  return apiRequest<Session>(`/sessions/${sessionId}/duplicate`, {
    method: "POST",
  });
}

export function launchSessionRun(sessionId: number): Promise<Run> {
  return apiRequest<Run>(`/sessions/${sessionId}/launch`, {
    method: "POST",
  });
}

export function addSessionPrompt(sessionId: number, promptId: number): Promise<Session> {
  return apiRequest<Session>(`/sessions/${sessionId}/prompts`, {
    method: "POST",
    body: { prompt_id: promptId },
  });
}

export function removeSessionPrompt(sessionId: number, sessionPromptId: number): Promise<Session> {
  return apiRequest<Session>(`/sessions/${sessionId}/prompts/${sessionPromptId}`, {
    method: "DELETE",
  });
}

export function addSessionCandidate(
  sessionId: number,
  modelProfileId: number,
): Promise<Session> {
  return apiRequest<Session>(`/sessions/${sessionId}/candidates`, {
    method: "POST",
    body: { model_profile_id: modelProfileId },
  });
}

export function removeSessionCandidate(
  sessionId: number,
  sessionCandidateId: number,
): Promise<Session> {
  return apiRequest<Session>(
    `/sessions/${sessionId}/candidates/${sessionCandidateId}`,
    {
      method: "DELETE",
    },
  );
}

export function addSessionJudge(sessionId: number, modelProfileId: number): Promise<Session> {
  return apiRequest<Session>(`/sessions/${sessionId}/judges`, {
    method: "POST",
    body: { model_profile_id: modelProfileId },
  });
}

export function removeSessionJudge(sessionId: number, sessionJudgeId: number): Promise<Session> {
  return apiRequest<Session>(`/sessions/${sessionId}/judges/${sessionJudgeId}`, {
    method: "DELETE",
  });
}
