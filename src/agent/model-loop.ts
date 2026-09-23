import { selectUnusedToolNames, type ToolStepLike } from "./limits";
import { BIDDR_SYSTEM_PROMPT } from "./model";
import { BIDDR_MODEL_TOOL_NAMES } from "./tools";

export const BIDDR_TOOL_CONTINUATION_PROMPT = `${BIDDR_SYSTEM_PROMPT}

Tool results from earlier steps are already present in this response. Do not request a tool that is no longer available and do not tell the user it is unavailable. Answer directly from completed tool results, or call one of the remaining tools only when additional information is genuinely required.`;

export function prepareBiddrModelStep(completedSteps: readonly ToolStepLike[]) {
  const activeTools = selectUnusedToolNames(
    BIDDR_MODEL_TOOL_NAMES,
    completedSteps
  );

  return {
    activeTools,
    ...(completedSteps.length > 0
      ? { system: BIDDR_TOOL_CONTINUATION_PROMPT }
      : {}),
    ...(activeTools.length === 0 ? { toolChoice: "none" as const } : {})
  };
}
