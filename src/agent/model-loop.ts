import { selectUnusedToolNames, type ToolStepLike } from "./limits";
import { BIDDR_SYSTEM_PROMPT } from "./model";

export const BIDDR_CHAT_TOOL_NAMES = ["commitSimulatedBid"] as const;

export const BIDDR_TOOL_CONTINUATION_PROMPT =
  "Tool results from earlier steps are already present in this response. Do not request a tool that is no longer available and do not tell the user it is unavailable. Answer directly from completed tool results, or call one of the remaining tools only when additional information is genuinely required.";

export function prepareBiddrModelStep(
  completedSteps: readonly ToolStepLike[],
  systemPrompt = BIDDR_SYSTEM_PROMPT
) {
  const activeTools = selectUnusedToolNames(
    BIDDR_CHAT_TOOL_NAMES,
    completedSteps
  );

  return {
    activeTools,
    ...(completedSteps.length > 0
      ? {
          system: `${systemPrompt}\n\n${BIDDR_TOOL_CONTINUATION_PROMPT}`
        }
      : {}),
    ...(activeTools.length === 0 ? { toolChoice: "none" as const } : {})
  };
}
