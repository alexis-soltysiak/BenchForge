import { API_URL, ApiError, apiRequest, buildNetworkErrorMessage } from "@/lib/api";

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

export function clearRunJudging(runId: number): Promise<RunJudging> {
  return apiRequest<RunJudging>(`/runs/${runId}/judging/clear`, {
    method: "POST",
  });
}

export function restartRunJudging(runId: number): Promise<RunJudging> {
  return apiRequest<RunJudging>(`/runs/${runId}/judging/restart`, {
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

async function downloadFromUrl(url: string, filename: string, errorMessage: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new ApiError(buildNetworkErrorMessage(API_URL), 0);
  }
  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new ApiError(errorBody?.detail ?? errorMessage, response.status);
  }
  const blob = await response.blob();
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(objectUrl);
}

export function downloadRunReportPdf(runId: number): Promise<void> {
  return downloadFromUrl(`${API_URL}/runs/${runId}/report/pdf`, `run-${runId}.pdf`, "Unable to download PDF report.");
}

export function downloadRunReportHtml(runId: number): Promise<void> {
  return downloadFromUrl(`${API_URL}/runs/${runId}/report/html`, `run-${runId}.html`, "Unable to download HTML report.");
}

export function downloadRunReportSvg(runId: number): Promise<void> {
  return downloadFromUrl(`${API_URL}/runs/${runId}/report/svg`, `run-${runId}-charts.zip`, "Unable to download SVG charts.");
}

export function downloadRunReportSummarySvg(runId: number): Promise<void> {
  return downloadFromUrl(`${API_URL}/runs/${runId}/report/summary-svg`, `run-${runId}-summary.svg`, "Unable to download summary SVG.");
}

export async function generateAndDownloadAll(runId: number): Promise<void> {
  await generateRunReport(runId);
  await Promise.all([
    downloadRunReportHtml(runId),
    downloadRunReportPdf(runId),
    downloadRunReportSvg(runId),
  ]);
}

export async function regenerateAndDownloadHtml(runId: number): Promise<void> {
  await generateRunReport(runId);
  await downloadRunReportHtml(runId);
}
