import { ApiError, apiRequest } from "@/lib/api";

import type {
  CandidateResponseListResponse,
  RunJudging,
  LocalExecutionNextResponse,
  Run,
  RunListResponse,
} from "@/features/runs/types";

export function fetchRuns(): Promise<RunListResponse> {
  return apiRequest<RunListResponse>("/runs");
}

export function fetchRun(runId: number): Promise<Run> {
  return apiRequest<Run>(`/runs/${runId}`);
}

export function fetchRunResponses(runId: number): Promise<CandidateResponseListResponse> {
  return apiRequest<CandidateResponseListResponse>(`/runs/${runId}/responses`);
}

export function launchSessionRun(sessionId: number): Promise<Run> {
  return apiRequest<Run>(`/sessions/${sessionId}/launch`, {
    method: "POST",
  });
}

export function resumeRun(runId: number): Promise<CandidateResponseListResponse> {
  return apiRequest<CandidateResponseListResponse>(`/runs/${runId}/resume`, {
    method: "POST",
  });
}

export async function fetchLocalNext(runId: number): Promise<LocalExecutionNextResponse | null> {
  try {
    return await apiRequest<LocalExecutionNextResponse>(`/runs/${runId}/local-next`);
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.status === 400 &&
      error.message.toLowerCase().includes("no pending local model")
    ) {
      return null;
    }
    throw error;
  }
}

export function confirmLocalReady(runId: number): Promise<LocalExecutionNextResponse> {
  return apiRequest<LocalExecutionNextResponse>(`/runs/${runId}/local-confirm-ready`, {
    method: "POST",
  });
}

export function startLocalCurrent(runId: number): Promise<CandidateResponseListResponse> {
  return apiRequest<CandidateResponseListResponse>(`/runs/${runId}/local-start-current`, {
    method: "POST",
  });
}

export function fetchRunJudging(runId: number): Promise<RunJudging> {
  return apiRequest<RunJudging>(`/runs/${runId}/judging`);
}

export function retryRunJudging(runId: number): Promise<RunJudging> {
  return apiRequest<RunJudging>(`/runs/${runId}/judging/retry`, {
    method: "POST",
  });
}

export function generateRunReport(runId: number): Promise<{ html_report_path: string | null; report_status: string; run_id: number }> {
  return apiRequest(`/runs/${runId}/report/generate`, {
    method: "POST",
  });
}
