import {
  getToolName,
  type DynamicToolUIPart,
  type ToolUIPart
} from "ai";

type AnyToolPart = ToolUIPart | DynamicToolUIPart;

export function isProminentToolActivity(part: AnyToolPart): boolean {
  const toolName = getToolName(part);

  return (
    part.state === "approval-requested" ||
    part.state === "approval-responded" ||
    part.state === "output-error" ||
    part.state === "output-denied" ||
    toolName === "commitSimulatedBid" ||
    (toolName === "analyzeBid" && part.state === "output-available")
  );
}
