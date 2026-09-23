import { ArrowRightIcon, CaretDownIcon } from "@phosphor-icons/react";
import { useRef, useState } from "react";
import {
  getToolName,
  type ChatAddToolApproveResponseFunction,
  type DynamicToolUIPart,
  type ToolUIPart
} from "ai";
import { formatLakhAsCrore } from "../client/format";
import {
  parseBidRecommendation,
  parseSimulatedBidInput
} from "../client/tool-presentation";

export type AnyToolPart = ToolUIPart | DynamicToolUIPart;

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

export function ToolActivityGroup({ parts }: { parts: AnyToolPart[] }) {
  if (parts.length === 0) return null;

  const activities = parts.map((part) => {
    const activity = getActivityState(part);

    return {
      id: part.toolCallId,
      toolLabel: TOOL_LABELS[getToolName(part)] ?? "Using an auction tool",
      statusLabel: activity.label,
      tone: activity.tone
    };
  });
  const working = activities.some((activity) => activity.tone === "active");
  const summary = working ? "Checking auction context" : "Auction context checked";

  return (
    <details className="tool-activity-group" data-tone={working ? "active" : "success"}>
      <summary>
        <span className="tool-activity-dot" aria-hidden="true" />
        <strong>{summary}</strong>
        <span>
          {activities.length} {activities.length === 1 ? "check" : "checks"}
        </span>
        <CaretDownIcon size={13} aria-hidden="true" />
      </summary>
      <ul>
        {activities.map((activity) => (
          <li
            key={activity.id}
            data-tone={activity.tone}
            aria-label={`${activity.toolLabel}: ${activity.statusLabel}`}
          >
            <span className="tool-activity-detail-dot" aria-hidden="true" />
            <span>{activity.toolLabel}</span>
            <strong>{activity.statusLabel}</strong>
          </li>
        ))}
      </ul>
    </details>
  );
}

function RecommendationCard({
  output,
  actionDisabled,
  onPrepareBid
}: {
  output: unknown;
  actionDisabled: boolean;
  onPrepareBid: ((amountLakh: number) => void) | undefined;
}) {
  const recommendation = parseBidRecommendation(output);
  if (!recommendation) return null;
  const bidToCeilingPercent =
    recommendation.maximumBidLakh > 0
      ? Math.min(
          100,
          Math.max(
            0,
            (recommendation.nextBidLakh / recommendation.maximumBidLakh) * 100
          )
        )
      : 0;

  return (
    <section
      className="recommendation-card"
      data-decision={recommendation.decision}
      aria-label={`${recommendation.decision} bid recommendation`}
    >
      <div className="recommendation-heading">
        <span>Engine recommendation</span>
        <mark data-decision={recommendation.decision}>
          {recommendation.decision}
        </mark>
      </div>

      <div className="recommendation-primary">
        <span>Maximum safe bid</span>
        <strong>{formatLakhAsCrore(recommendation.maximumBidLakh)}</strong>
        <small>
          Next bid
          <span>{formatLakhAsCrore(recommendation.nextBidLakh)}</span>
        </small>
      </div>

      <div
        className="recommendation-scale"
        role="progressbar"
        aria-label="Next bid compared with maximum safe bid"
        aria-valuemin={0}
        aria-valuemax={recommendation.maximumBidLakh}
        aria-valuenow={recommendation.nextBidLakh}
      >
        <span style={{ width: `${bidToCeilingPercent}%` }} />
      </div>
      <div className="recommendation-scale-labels" aria-hidden="true">
        <span>Next bid</span>
        <span>Safe ceiling</span>
      </div>

      <dl className="recommendation-values">
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
        <div className="recommendation-why">
          <strong>Why this call</strong>
          <ul className="recommendation-reasons">
            {recommendation.reasons.slice(0, 3).map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {recommendation.decision === "BID" ? (
        <button
          className="recommendation-action"
          type="button"
          disabled={actionDisabled || !onPrepareBid}
          onClick={() => onPrepareBid?.(recommendation.nextBidLakh)}
        >
          Prepare {formatLakhAsCrore(recommendation.nextBidLakh)} bid
          <ArrowRightIcon size={15} weight="bold" aria-hidden="true" />
        </button>
      ) : null}
    </section>
  );
}

function ApprovalControls({
  part,
  disabled,
  onRespond
}: {
  part: AnyToolPart & { state: "approval-requested" };
  disabled: boolean;
  onRespond: ChatAddToolApproveResponseFunction | undefined;
}) {
  const input = parseSimulatedBidInput(part.input);
  const decidingRef = useRef(false);
  const [decision, setDecision] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState(false);

  const respond = async (approved: boolean) => {
    if (disabled || !onRespond || decidingRef.current) return;

    decidingRef.current = true;
    setDecision(approved ? "approve" : "reject");
    setError(false);

    try {
      await onRespond({ id: part.approval.id, approved });
    } catch {
      decidingRef.current = false;
      setDecision(null);
      setError(true);
    }
  };

  const controlsDisabled = disabled || !onRespond || decision !== null;

  return (
    <section className="approval-panel" aria-label="Simulated bid approval">
      {input ? (
        <>
          <strong>Confirm {formatLakhAsCrore(input.amountLakh)} bid?</strong>
          <p>
            Approval spends purse and adds the current player to your simulated
            squad. Rejection leaves the auction unchanged.
          </p>
        </>
      ) : (
        <p role="alert">
          The proposed bid details could not be verified. Reject this request
          and ask Biddr to prepare it again.
        </p>
      )}

      <div className="approval-actions">
        {input ? (
          <button
            className="button button-primary"
            type="button"
            disabled={controlsDisabled}
            onClick={() => void respond(true)}
          >
            {decision === "approve" ? "Approving…" : "Approve bid"}
          </button>
        ) : null}
        <button
          className="button button-secondary"
          type="button"
          disabled={controlsDisabled}
          onClick={() => void respond(false)}
        >
          {decision === "reject" ? "Rejecting…" : "Reject"}
        </button>
      </div>

      {disabled ? (
        <small>Reconnect to the Agent before responding.</small>
      ) : null}
      {error ? (
        <small className="approval-error" role="alert">
          Your decision could not be sent. Please try again.
        </small>
      ) : null}
    </section>
  );
}

export function ToolActivity({
  part,
  approvalDisabled = false,
  actionDisabled = false,
  onApprovalResponse,
  onPrepareBid
}: {
  part: AnyToolPart;
  approvalDisabled?: boolean;
  actionDisabled?: boolean;
  onApprovalResponse?: ChatAddToolApproveResponseFunction;
  onPrepareBid?: (amountLakh: number) => void;
}) {
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

      {part.state === "approval-requested" &&
      toolName === "commitSimulatedBid" ? (
        <ApprovalControls
          part={part}
          disabled={approvalDisabled}
          onRespond={onApprovalResponse}
        />
      ) : part.state === "approval-requested" ? (
        <p>This tool cannot be approved from the auction interface.</p>
      ) : null}

      {toolName === "commitSimulatedBid" &&
      ((part.state === "approval-responded" && !part.approval.approved) ||
        part.state === "output-denied") ? (
        <p>Bid rejected. No auction state was changed.</p>
      ) : null}

      {toolName === "commitSimulatedBid" &&
      part.state === "approval-responded" &&
      part.approval.approved ? (
        <p>Bid approved. Applying the auction update…</p>
      ) : null}

      {toolName === "analyzeBid" && part.state === "output-available" ? (
        <RecommendationCard
          output={part.output}
          actionDisabled={actionDisabled}
          onPrepareBid={onPrepareBid}
        />
      ) : null}
    </article>
  );
}
