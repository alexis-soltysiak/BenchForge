import type { JudgeBatch, RunModelSnapshot, RunPromptSnapshot } from "../types";
import { formatInspectorContent, formatDateTime } from "../utils";
import { SummaryStat } from "./summary-stat";
import { InspectorPanel } from "./inspector-panel";
import { PromptBlock } from "./prompt-block";
import { CodeBlock } from "./code-block";

export function JudgeInspector({
  batch,
  judgeModel,
  prompt,
}: {
  batch: JudgeBatch;
  judgeModel: RunModelSnapshot | undefined;
  prompt: RunPromptSnapshot | undefined;
}) {
  const requestPayload = formatInspectorContent(batch.request_payload_jsonb);
  const rawResponse =
    formatInspectorContent(batch.raw_response_jsonb) ??
    formatInspectorContent(batch.raw_response_text);
  const parsedEvaluation = formatInspectorContent(batch.evaluation?.parsed_output_jsonb);

  return (
    <div className="mt-2 space-y-5 text-sm text-slate-900">
      <div className="grid gap-3 lg:grid-cols-5">
        <SummaryStat label="Scenario" value={prompt?.name ?? "Unknown scenario"} />
        <SummaryStat label="Judge Model" value={judgeModel?.display_name ?? "Unknown model"} />
        <SummaryStat label="Job Type" value={batch.batch_type} />
        <SummaryStat label="Status" value={batch.status.replaceAll("_", " ")} />
        <SummaryStat label="Completed" value={formatDateTime(batch.completed_at) ?? "Pending"} />
      </div>

      {batch.error_message ? (
        <InspectorPanel accent="rose" title="Judge Error">
          <CodeBlock content={batch.error_message} tone="rose" />
        </InspectorPanel>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)]">
        <div className="space-y-5">
          <InspectorPanel
            accent="sky"
            eyebrow="Scenario"
            title={prompt?.name ?? "Unknown scenario"}
            subtitle="Snapshot évalué par le juge pour ce job."
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
            title="Judge Request Payload"
            subtitle="Payload envoyé au modèle juge."
          >
            <CodeBlock
              content={requestPayload?.content ?? "No request payload persisted yet."}
              isJson={requestPayload?.isJson}
            />
          </InspectorPanel>
        </div>

        <div className="space-y-5">
          <InspectorPanel
            accent="amber"
            eyebrow="Output"
            title="Parsed Judge Evaluation"
            subtitle="JSON évalué et persisté après parsing."
          >
            <CodeBlock
              content={parsedEvaluation?.content ?? "No parsed evaluation persisted yet."}
              isJson={parsedEvaluation?.isJson}
              tone="amber"
            />
          </InspectorPanel>

          <InspectorPanel
            accent="slate"
            eyebrow="Raw Output"
            title="Raw Judge Response"
            subtitle="Réponse brute complète du modèle juge."
          >
            <CodeBlock
              content={rawResponse?.content ?? "No raw response persisted yet."}
              isJson={rawResponse?.isJson}
            />
          </InspectorPanel>
        </div>
      </div>
    </div>
  );
}
