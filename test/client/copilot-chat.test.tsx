import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CopilotChat } from "../../src/components/copilot-chat";
import { MAX_USER_MESSAGE_CHARACTERS } from "../../src/agent/limits";

const chatHook = vi.hoisted(() => ({
  addToolApprovalResponse: vi.fn(),
  sendMessage: vi.fn(),
  useAgentChat: vi.fn()
}));

vi.mock("@cloudflare/ai-chat/react", () => ({
  useAgentChat: chatHook.useAgentChat
}));

const agent = {} as Parameters<typeof CopilotChat>[0]["agent"];

const recommendation = {
  playerId: "player-1",
  decision: "BID",
  maximumBidLakh: 420,
  nextBidLakh: 260,
  headroomLakh: 160,
  factors: {
    playerValueLakh: 400,
    nextBidLakh: 260,
    roleTarget: 3,
    roleGap: 2,
    remainingRoleSupply: 4,
    scarcityScore: 0.5,
    needMultiplier: 1.12,
    priorityMultiplier: 1.08,
    riskMultiplier: 1,
    reserveFloorLakh: 1800,
    spendableAboveReserveLakh: 5600,
    openSquadSlots: 8,
    slotBudgetCapLakh: 700,
    rawCeilingLakh: 420
  },
  reasons: [
    "The role is below its squad target.",
    "The next bid remains below the deterministic ceiling."
  ]
};

function mockChat(overrides: Record<string, unknown> = {}) {
  chatHook.useAgentChat.mockReturnValue({
    messages: [],
    addToolApprovalResponse: chatHook.addToolApprovalResponse,
    sendMessage: chatHook.sendMessage,
    status: "idle",
    isStreaming: false,
    isRecovering: false,
    ...overrides
  });
}

describe("Copilot chat", () => {
  beforeEach(() => {
    chatHook.addToolApprovalResponse.mockReset();
    chatHook.sendMessage.mockReset();
    chatHook.useAgentChat.mockReset();
    mockChat();
  });

  it("submits a trimmed message from the accessible composer", async () => {
    const user = userEvent.setup();
    render(<CopilotChat agent={agent} connectionStatus="connected" />);

    const composer = screen.getByRole("textbox", { name: "Ask the copilot" });
    expect(chatHook.useAgentChat).toHaveBeenCalledWith({
      agent,
      autoContinueAfterToolResult: true,
      resume: true
    });
    expect(screen.getByLabelText("Copilot conversation")).toHaveAttribute(
      "aria-relevant",
      "additions text"
    );
    await user.type(composer, "  How is our purse?  ");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(chatHook.sendMessage).toHaveBeenCalledWith({
      role: "user",
      parts: [{ type: "text", text: "How is our purse?" }]
    });
    expect(composer).toHaveValue("");
    expect(composer).toHaveAttribute(
      "maxlength",
      String(MAX_USER_MESSAGE_CHARACTERS)
    );
  });

  it("supports Enter to send and Shift+Enter for a new line", async () => {
    const user = userEvent.setup();
    render(<CopilotChat agent={agent} connectionStatus="connected" />);
    const composer = screen.getByRole("textbox", { name: "Ask the copilot" });

    await user.type(composer, "First line");
    await user.keyboard("{Shift>}{Enter}{/Shift}");
    expect(composer).toHaveValue("First line\n");
    expect(chatHook.sendMessage).not.toHaveBeenCalled();

    await user.type(composer, "Second line{Enter}");
    expect(chatHook.sendMessage).toHaveBeenCalledWith({
      role: "user",
      parts: [{ type: "text", text: "First line\nSecond line" }]
    });
  });

  it("sends a suggested starter question", async () => {
    const user = userEvent.setup();
    render(<CopilotChat agent={agent} connectionStatus="connected" />);

    await user.click(
      screen.getByRole("button", {
        name: "Which role should we prioritize next?"
      })
    );

    expect(chatHook.sendMessage).toHaveBeenCalledWith({
      role: "user",
      parts: [
        { type: "text", text: "Which role should we prioritize next?" }
      ]
    });
  });

  it("renders persisted and streaming text message parts", () => {
    mockChat({
      messages: [
        {
          id: "user-1",
          role: "user",
          parts: [{ type: "text", text: "Should we bid?" }]
        },
        {
          id: "assistant-1",
          role: "assistant",
          parts: [{ type: "text", text: "BID, with a strict ceiling." }]
        }
      ],
      status: "streaming",
      isStreaming: true
    });
    render(<CopilotChat agent={agent} connectionStatus="connected" />);

    expect(screen.getByText("Should we bid?")).toBeVisible();
    expect(screen.getByText("BID, with a strict ceiling.")).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Biddr is responding"
    );
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("disables submission while disconnected and reports chat errors", async () => {
    const user = userEvent.setup();
    mockChat({ status: "error" });
    render(<CopilotChat agent={agent} connectionStatus="reconnecting" />);

    expect(screen.getByRole("textbox")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "conversation and auction state are saved"
    );
    await user.click(
      screen.getByRole("button", {
        name: "Should we bid on the current player?"
      })
    );
    expect(chatHook.sendMessage).not.toHaveBeenCalled();
  });

  it("renders tool progress and a validated bid recommendation card", () => {
    mockChat({
      messages: [
        {
          id: "assistant-tools",
          role: "assistant",
          parts: [
            {
              type: "tool-getAuctionState",
              toolCallId: "state-1",
              state: "input-available",
              input: {}
            },
            {
              type: "tool-analyzeBid",
              toolCallId: "analysis-1",
              state: "output-available",
              input: {},
              output: recommendation
            }
          ]
        }
      ]
    });
    render(<CopilotChat agent={agent} connectionStatus="connected" />);

    expect(
      screen.getByLabelText("Reading auction state: Working")
    ).toBeVisible();
    expect(
      screen.getByLabelText("Running deterministic bid analysis: Complete")
    ).toBeVisible();
    expect(screen.getByLabelText("BID bid recommendation")).toBeVisible();
    expect(screen.getByText("₹2.60 Cr")).toBeVisible();
    expect(screen.getByText("₹4.20 Cr")).toBeVisible();
    expect(
      screen.getByText("The next bid remains below the deterministic ceiling.")
    ).toBeVisible();
  });

  it("shows safe tool errors and explicit approval-required controls", () => {
    mockChat({
      messages: [
        {
          id: "assistant-actions",
          role: "assistant",
          parts: [
            {
              type: "tool-analyzeBid",
              toolCallId: "analysis-error",
              state: "output-error",
              input: {},
              errorText: "private provider detail"
            },
            {
              type: "tool-commitSimulatedBid",
              toolCallId: "commit-1",
              state: "approval-requested",
              input: { amountLakh: 260 },
              approval: { id: "approval-1" }
            }
          ]
        }
      ]
    });
    render(<CopilotChat agent={agent} connectionStatus="connected" />);

    expect(
      screen.getByLabelText("Running deterministic bid analysis: Failed")
    ).toHaveTextContent("could not complete");
    expect(screen.queryByText("private provider detail")).not.toBeInTheDocument();
    expect(
      screen.getByLabelText("Preparing simulated bid: Approval required")
    ).toHaveTextContent("Confirm ₹2.60 Cr bid?");
    expect(screen.getByRole("button", { name: "Approve bid" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Reject" })).toBeEnabled();
  });

  it.each([
    { buttonName: "Approve bid", approved: true },
    { buttonName: "Reject", approved: false }
  ])("submits an approval decision when choosing $buttonName", async ({
    buttonName,
    approved
  }) => {
    const user = userEvent.setup();
    mockChat({
      messages: [
        {
          id: "assistant-approval",
          role: "assistant",
          parts: [
            {
              type: "tool-commitSimulatedBid",
              toolCallId: "commit-approval",
              state: "approval-requested",
              input: { amountLakh: 260 },
              approval: { id: "approval-choice" }
            }
          ]
        }
      ]
    });
    render(<CopilotChat agent={agent} connectionStatus="connected" />);

    await user.click(screen.getByRole("button", { name: buttonName }));

    expect(chatHook.addToolApprovalResponse).toHaveBeenCalledTimes(1);
    expect(chatHook.addToolApprovalResponse).toHaveBeenCalledWith({
      id: "approval-choice",
      approved
    });
    expect(screen.getByRole("button", { name: /Approving|Rejecting/ })).toBeDisabled();
  });

  it("blocks approval when disconnected", () => {
    mockChat({
      messages: [
        {
          id: "assistant-offline-approval",
          role: "assistant",
          parts: [
            {
              type: "tool-commitSimulatedBid",
              toolCallId: "commit-offline",
              state: "approval-requested",
              input: { amountLakh: 260 },
              approval: { id: "approval-offline" }
            }
          ]
        }
      ]
    });
    render(<CopilotChat agent={agent} connectionStatus="reconnecting" />);

    expect(screen.getByRole("button", { name: "Approve bid" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reject" })).toBeDisabled();
    expect(screen.getByText("Reconnect to the Agent before responding.")).toBeVisible();
  });

  it("recovers when an approval decision cannot be sent", async () => {
    const user = userEvent.setup();
    chatHook.addToolApprovalResponse.mockRejectedValueOnce(
      new Error("socket closed")
    );
    mockChat({
      messages: [
        {
          id: "assistant-failed-approval",
          role: "assistant",
          parts: [
            {
              type: "tool-commitSimulatedBid",
              toolCallId: "commit-failed",
              state: "approval-requested",
              input: { amountLakh: 260 },
              approval: { id: "approval-failed" }
            }
          ]
        }
      ]
    });
    render(<CopilotChat agent={agent} connectionStatus="connected" />);

    await user.click(screen.getByRole("button", { name: "Approve bid" }));

    expect(
      await screen.findByText("Your decision could not be sent. Please try again.")
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Approve bid" })).toBeEnabled();
  });

  it("never offers approval for malformed persisted bid input", () => {
    mockChat({
      messages: [
        {
          id: "assistant-invalid-approval",
          role: "assistant",
          parts: [
            {
              type: "tool-commitSimulatedBid",
              toolCallId: "commit-invalid",
              state: "approval-requested",
              input: { amountLakh: "260" },
              approval: { id: "approval-invalid" }
            }
          ]
        }
      ]
    });
    render(<CopilotChat agent={agent} connectionStatus="connected" />);

    expect(screen.queryByRole("button", { name: "Approve bid" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject" })).toBeEnabled();
    expect(screen.getByRole("alert")).toHaveTextContent("could not be verified");
  });

  it("does not render an unvalidated recommendation payload", () => {
    mockChat({
      messages: [
        {
          id: "assistant-malformed",
          role: "assistant",
          parts: [
            {
              type: "tool-analyzeBid",
              toolCallId: "analysis-malformed",
              state: "output-available",
              input: {},
              output: { decision: "BID", maximumBidLakh: "untrusted" }
            }
          ]
        }
      ]
    });
    render(<CopilotChat agent={agent} connectionStatus="connected" />);

    expect(
      screen.getByLabelText("Running deterministic bid analysis: Complete")
    ).toBeVisible();
    expect(screen.queryByLabelText(/bid recommendation/i)).not.toBeInTheDocument();
  });
});
