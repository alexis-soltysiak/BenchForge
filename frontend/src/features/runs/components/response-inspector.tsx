import type { CandidateResponse, RunModelSnapshot, RunPromptSnapshot } from "../types";
import { formatInspectorContent, formatInspectorDuration, formatInteger, formatTokensPerSecond, formatDateTime } from "../utils";
import { SummaryStat } from "./summary-stat";
import { InspectorPanel } from "./inspector-panel";
import { PromptBlock } from "./prompt-block";
import { CodeBlock } from "./code-block";
import { MetricTile } from "./metric-tile";

export function ResponseInspector({
  model,
  prompt,
  response,
}: {
  model: RunModelSnapshot | undefined;
  prompt: RunPromptSnapshot | undefined;
  response: CandidateResponse;
}) {
  const normalizedResponse = formatInspectorContent(response.normalized_response_text);
  const rawResponse =
    formatInspectorContent(response.raw_response_jsonb) ??
    formatInspectorContent(response.raw_response_text);
  const requestPayload = formatInspectorContent(response.request_payload_jsonb);
  const hasExecutionMetrics = Boolean(
    response.metric?.duration_ms !== null ||
      response.metric?.total_tokens !== null ||
      response.metric?.tokens_per_second ||
      response.metric?.estimated_cost,
  );

  return (
    <div className="mt-2 space-y-5 text-sm text-slate-900">
      <div className="grid gap-3 lg:grid-cols-4">
        <SummaryStat label="Scenario" value={prompt?.name ?? "Unknown scenario"} />
        <SummaryStat label="Candidate" value={model?.display_name ?? "Unknown model"} />
        <SummaryStat label="Status" value={response.status.replaceAll("_", " ")} />
        <SummaryStat
          label="Completed"
          value={formatDateTime(response.completed_at) ?? "In progress"}
        />
      </div>

      {response.error_message ? (
        <InspectorPanel accent="rose" title="Execution Error">
          <CodeBlock content={response.error_message} tone="rose" />
        </InspectorPanel>
      ) : null}

      <div className="space-y-5">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)]">
          <div className="space-y-5">
            <InspectorPanel
              accent="sky"
              eyebrow="Scenario"
              title={prompt?.name ?? "Unknown scenario"}
              subtitle="Snapshot de scénario utilisé pour cette réponse."
            >
              {prompt?.system_prompt_text ? (
                <PromptBlock label="System instruction" text={prompt.system_prompt_text} />
              ) : null}
              <PromptBlock
                label="Rendered scenario"
                text={prompt?.user_prompt_text ?? "No scenario text recorded."}
              />
              {prompt?.evaluation_notes ? (
                <PromptBlock label="Evaluation Notes" text={prompt.evaluation_notes} />
              ) : null}
            </InspectorPanel>

            <InspectorPanel
              accent="slate"
              eyebrow="Request"
              title="Request Payload"
              subtitle="Payload envoyé au provider pour cette exécution."
            >
              <CodeBlock
                content={requestPayload?.content ?? "No payload persisted yet."}
                isJson={requestPayload?.isJson}
              />
            </InspectorPanel>
          </div>

          <div className="space-y-5">
            <InspectorPanel
              accent="amber"
              eyebrow="Answer"
              title="Normalized Response"
              subtitle="Version directe et exploitable de la réponse du modèle."
            >
              <CodeBlock
                content={normalizedResponse?.content ?? "No normalized response recorded yet."}
                isJson={normalizedResponse?.isJson}
                tone="amber"
              />
            </InspectorPanel>

            <InspectorPanel
              accent="slate"
              eyebrow="Raw Output"
              title="Raw Response"
              subtitle="Réponse complète brute, formatée automatiquement si du JSON est disponible."
            >
              <CodeBlock
                content={rawResponse?.content ?? "No raw response persisted yet."}
                isJson={rawResponse?.isJson}
              />
            </InspectorPanel>
          </div>
        </div>

        {hasExecutionMetrics ? (
          <InspectorPanel
            accent="emerald"
            eyebrow="Metrics"
            title="Execution Metrics"
            subtitle="Mesures enregistrées pendant l'appel modèle."
          >
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              <MetricTile
                label="Duration"
                value={formatInspectorDuration(response.metric?.duration_ms)}
              />
              <MetricTile
                label="Tokens"
                value={formatInteger(response.metric?.total_tokens)}
              />
              <MetricTile
                label="Input Tokens"
                value={formatInteger(response.metric?.input_tokens)}
              />
              <MetricTile
                label="Output Tokens"
                value={formatInteger(response.metric?.output_tokens)}
              />
              <MetricTile
                label="Tokens / Second"
                value={formatTokensPerSecond(response.metric?.tokens_per_second)}
              />
              <MetricTile
                label="Estimated Cost"
                value={response.metric?.estimated_cost ?? "—"}
              />
            </div>
          </InspectorPanel>
        ) : null}
      </div>
    </div>
  );
}
