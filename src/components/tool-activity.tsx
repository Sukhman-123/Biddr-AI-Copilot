import { getToolName, type DynamicToolUIPart, type ToolUIPart } from "ai";
import { formatLakhAsCrore } from "../client/format";
import { parseBidRecommendation } from "../client/tool-presentation";

type AnyToolPart = ToolUIPart | DynamicToolUIPart;

const TOOL_LABELS: Record<string, string> = {
  getAuctionState: "Reading auction state",
  getCurrentPlayer: "Reading current player",
  getTeamComposition: "Checking squad composition",
  listRemainingPlayers: "Scanning remaining players",
  analyzeBid: "Running deterministic bid analysis",
  getStrategy: "Reading strategy memory",
  commitSimulatedBid: "Preparing simulated bid"
};

function getActivityState(part: AnyToolPart): {
  label: string;
  tone: "active" | "success" | "warning" | "error";
} {
  switch (part.state) {
    case "input-streaming":
    case "input-available":
      return { label: "Working", tone: "active" };
    case "approval-requested":
      return { label: "Approval required", tone: "warning" };
    case "approval-responded":
      return part.approval.approved
        ? { label: "Approved", tone: "active" }
        : { label: "Declined", tone: "warning" };
    case "output-available":
      return { label: "Complete", tone: "success" };
    case "output-error":
      return { label: "Failed", tone: "error" };
    case "output-denied":
      return { label: "Declined", tone: "warning" };
  }
}

function RecommendationCard({ output }: { output: unknown }) {
  const recommendation = parseBidRecommendation(output);
  if (!recommendation) return null;

  return (
    <section
      className="recommendation-card"
      aria-label={`${recommendation.decision} bid recommendation`}
    >
      <div className="recommendation-heading">
        <div>
          <span>Bid recommendation</span>
          <strong>Engine-backed ceiling</strong>
        </div>
        <mark data-decision={recommendation.decision}>
          {recommendation.decision}
        </mark>
      </div>

      <dl className="recommendation-values">
        <div>
          <dt>Next bid</dt>
          <dd>{formatLakhAsCrore(recommendation.nextBidLakh)}</dd>
        </div>
        <div>
          <dt>Maximum bid</dt>
          <dd>{formatLakhAsCrore(recommendation.maximumBidLakh)}</dd>
        </div>
        <div>
          <dt>Headroom</dt>
          <dd>{formatLakhAsCrore(recommendation.headroomLakh)}</dd>
        </div>
        <div>
          <dt>Reserve floor</dt>
          <dd>{formatLakhAsCrore(recommendation.factors.reserveFloorLakh)}</dd>
        </div>
      </dl>

      <div className="recommendation-context">
        <span>Role gap {recommendation.factors.roleGap}</span>
        <span>Supply {recommendation.factors.remainingRoleSupply}</span>
        <span>
          Scarcity {recommendation.factors.scarcityScore.toFixed(2)}
        </span>
      </div>

      {recommendation.reasons.length > 0 ? (
        <ul className="recommendation-reasons">
          {recommendation.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function ToolActivity({ part }: { part: AnyToolPart }) {
  const toolName = getToolName(part);
  const activity = getActivityState(part);
  const label = TOOL_LABELS[toolName] ?? "Using an auction tool";

  return (
    <article
      className="tool-activity"
      data-tone={activity.tone}
      aria-label={`${label}: ${activity.label}`}
    >
      <div className="tool-activity-heading">
        <span className="tool-activity-dot" aria-hidden="true" />
        <strong>{label}</strong>
        <span>{activity.label}</span>
      </div>

      {part.state === "output-error" ? (
        <p role="alert">That auction check could not complete. Please try again.</p>
      ) : null}

      {part.state === "approval-requested" ? (
        <p>The proposed action is waiting for your decision.</p>
      ) : null}

      {toolName === "analyzeBid" && part.state === "output-available" ? (
        <RecommendationCard output={part.output} />
      ) : null}
    </article>
  );
}
