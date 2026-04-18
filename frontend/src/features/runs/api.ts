import { API_URL, ApiError, apiRequest } from "@/lib/api";

import type {
  CandidateResponse,
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

export function startRemoteCandidate(
  runId: number,
  modelSnapshotId: number,
): Promise<CandidateResponseListResponse> {
  return apiRequest<CandidateResponseListResponse>(
    `/runs/${runId}/models/${modelSnapshotId}/start`,
    {
      method: "POST",
    },
  );
}

export function retryCandidateResponse(
  runId: number,
  responseId: number,
): Promise<CandidateResponse> {
  return apiRequest<CandidateResponse>(`/runs/${runId}/responses/${responseId}/retry`, {
    method: "POST",
  });
}

export function fetchRunJudging(runId: number): Promise<RunJudging> {
  return apiRequest<RunJudging>(`/runs/${runId}/judging`);
}

export function startRunJudging(runId: number): Promise<RunJudging> {
  return apiRequest<RunJudging>(`/runs/${runId}/judging/start`, {
    method: "POST",
  });
}

export function retryRunJudging(runId: number): Promise<RunJudging> {
  return apiRequest<RunJudging>(`/runs/${runId}/judging/retry`, {
    method: "POST",
  });
}

export function retryJudgeBatch(runId: number, batchId: number): Promise<RunJudging> {
  return apiRequest<RunJudging>(`/runs/${runId}/judging/batches/${batchId}/retry`, {
    method: "POST",
  });
}

export function generateRunReport(runId: number): Promise<{ html_report_path: string | null; report_status: string; run_id: number }> {
  return apiRequest(`/runs/${runId}/report/generate`, {
    method: "POST",
  });
}

export async function downloadRunReportPdf(runId: number): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/runs/${runId}/report/pdf`);
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Network request failed.";
    throw new ApiError(
      `Unable to reach the API at ${API_URL}. Check that the backend is running and CORS allows the frontend origin. (${message})`,
      0,
    );
  }

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as
      | { detail?: string }
      | null;
    throw new ApiError(
      errorBody?.detail ?? "Unable to download PDF report.",
      response.status,
    );
  }

  const blob = await response.blob();
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = `run-${runId}.pdf`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(objectUrl);
}
