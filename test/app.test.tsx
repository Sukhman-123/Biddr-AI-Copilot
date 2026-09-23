import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/app";
import {
  createInitialAgentState,
  passAgentCurrentPlayer
} from "../src/agent/state";

const agentHook = vi.hoisted(() => ({
  advanceLot: vi.fn(),
  passPlayer: vi.fn(),
  reconnect: vi.fn(),
  rememberStrategy: vi.fn(),
  resetDemo: vi.fn(),
  useBiddrAgent: vi.fn()
}));
const chatHook = vi.hoisted(() => ({
  addToolApprovalResponse: vi.fn(),
  clearHistory: vi.fn(),
  regenerate: vi.fn(),
  sendMessage: vi.fn(),
  stop: vi.fn(),
  useAgentChat: vi.fn()
}));

vi.mock("../src/client/use-biddr-agent", () => ({
  useBiddrAgent: agentHook.useBiddrAgent
}));
vi.mock("@cloudflare/ai-chat/react", () => ({
  useAgentChat: chatHook.useAgentChat
}));

const SESSION_ID = "1995e44b-4a15-4ed1-8b79-4f0edb9026b4";

describe("Biddr application shell", () => {
  beforeEach(() => {
    agentHook.advanceLot.mockReset();
    agentHook.advanceLot.mockResolvedValue(undefined);
    agentHook.passPlayer.mockReset();
    agentHook.passPlayer.mockResolvedValue(undefined);
    agentHook.reconnect.mockReset();
    agentHook.rememberStrategy.mockReset();
    agentHook.rememberStrategy.mockResolvedValue(undefined);
    agentHook.resetDemo.mockReset();
    agentHook.resetDemo.mockResolvedValue(undefined);
    agentHook.useBiddrAgent.mockReset();
    agentHook.useBiddrAgent.mockReturnValue({
      agent: {
        state: createInitialAgentState(),
        stub: {
          advanceLot: agentHook.advanceLot,
          passPlayer: agentHook.passPlayer,
          rememberStrategy: agentHook.rememberStrategy,
          resetDemo: agentHook.resetDemo
        }
      },
      connectionStatus: "connected",
      reconnect: agentHook.reconnect
    });
    chatHook.addToolApprovalResponse.mockReset();
    chatHook.clearHistory.mockReset();
    chatHook.regenerate.mockReset();
    chatHook.sendMessage.mockReset();
    chatHook.stop.mockReset();
    chatHook.useAgentChat.mockReset();
    chatHook.useAgentChat.mockReturnValue({
      addToolApprovalResponse: chatHook.addToolApprovalResponse,
      clearHistory: chatHook.clearHistory,
      messages: [],
      regenerate: chatHook.regenerate,
      sendMessage: chatHook.sendMessage,
      stop: chatHook.stop,
      status: "idle",
      isStreaming: false,
      isRecovering: false
    });
  });

  it("introduces the auction workspace and strategy room", () => {
    render(<App sessionId={SESSION_ID} />);

    expect(
      screen.getByRole("heading", { name: "Auction command" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Strategy room" })
    ).toBeInTheDocument();
    expect(screen.getByText("Online")).toBeInTheDocument();
    expect(agentHook.useBiddrAgent).toHaveBeenCalledWith(SESSION_ID);
    expect(
      screen.getByRole("link", { name: "Skip to auction workspace" })
    ).toHaveAttribute("href", "#main");
    expect(screen.getByRole("main")).toHaveAttribute("tabindex", "-1");
  });

  it("opens and closes the persistent mobile strategy room", async () => {
    const user = userEvent.setup();
    render(<App sessionId={SESSION_ID} />);

    const launcher = screen.getByRole("button", {
      name: "Open strategy room"
    });
    const conversation = screen.getByLabelText("Copilot conversation");
    await user.click(launcher);

    expect(launcher).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("dialog", { name: "Strategy room" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Back to auction" }));
    expect(launcher).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByLabelText("Copilot conversation")).toBe(conversation);
  });

  it("enables the connected auction and strategy controls", () => {
    render(<App sessionId={SESSION_ID} />);

    expect(screen.getByRole("button", { name: "Pass player" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Advance lot" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Reset demo" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Save strategy" })).toBeDisabled();
  });

  it("renders the current player and metrics from synchronized Agent state", () => {
    render(<App sessionId={SESSION_ID} />);

    expect(screen.getByText("Live simulation · Bengaluru Comets")).toBeVisible();
    expect(screen.getByText("Lot 01 / 12")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Aarya Sen" })).toBeVisible();
    expect(screen.getByText("₹1.20 Cr")).toBeVisible();
    expect(screen.getByText("₹2.40 Cr")).toBeVisible();
    expect(screen.getByText("₹2.60 Cr")).toBeVisible();
    expect(screen.getByText("₹38.60 Cr")).toBeVisible();
    expect(screen.getByText("7 / 15")).toBeVisible();
    expect(
      screen.getByRole("progressbar", { name: "Fast bowlers: 1 of 3" })
    ).toHaveAttribute("aria-valuenow", "1");
  });

  it("changes the player presentation when synchronized state advances", () => {
    agentHook.useBiddrAgent.mockReturnValue({
      agent: {
        state: passAgentCurrentPlayer(createInitialAgentState()),
        stub: {
          advanceLot: agentHook.advanceLot,
          passPlayer: agentHook.passPlayer,
          rememberStrategy: agentHook.rememberStrategy,
          resetDemo: agentHook.resetDemo
        }
      },
      connectionStatus: "connected",
      reconnect: agentHook.reconnect
    });
    render(<App sessionId={SESSION_ID} />);

    expect(screen.getByText("Lot 02 / 12")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Vivaan Rao" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Aarya Sen" })).toBeNull();
  });

  it("shows a loading presentation until Agent state arrives", () => {
    agentHook.useBiddrAgent.mockReturnValue({
      agent: {
        state: undefined,
        stub: {
          advanceLot: agentHook.advanceLot,
          passPlayer: agentHook.passPlayer,
          rememberStrategy: agentHook.rememberStrategy,
          resetDemo: agentHook.resetDemo
        }
      },
      connectionStatus: "connecting",
      reconnect: agentHook.reconnect
    });
    render(<App sessionId={SESSION_ID} />);

    expect(
      screen.getByRole("status", { name: "Loading auction state" })
    ).toHaveTextContent("Loading auction state");
    expect(screen.getByText("Syncing")).toBeVisible();
  });

  it("shows the completed-auction presentation without an active player", () => {
    const completeState = createInitialAgentState();
    completeState.auction = {
      ...completeState.auction,
      status: "complete",
      currentLotIndex: completeState.auction.playerQueue.length,
      currentBid: null
    };
    agentHook.useBiddrAgent.mockReturnValue({
      agent: {
        state: completeState,
        stub: {
          advanceLot: agentHook.advanceLot,
          passPlayer: agentHook.passPlayer,
          rememberStrategy: agentHook.rememberStrategy,
          resetDemo: agentHook.resetDemo
        }
      },
      connectionStatus: "connected",
      reconnect: agentHook.reconnect
    });
    render(<App sessionId={SESSION_ID} />);

    expect(screen.getAllByText("Auction complete")).toHaveLength(2);
    expect(screen.queryByRole("heading", { name: "Aarya Sen" })).toBeNull();
  });

  it("offers a manual retry after a terminal connection failure", async () => {
    const user = userEvent.setup();
    agentHook.useBiddrAgent.mockReturnValue({
      agent: {
        state: createInitialAgentState(),
        stub: {
          advanceLot: agentHook.advanceLot,
          passPlayer: agentHook.passPlayer,
          rememberStrategy: agentHook.rememberStrategy,
          resetDemo: agentHook.resetDemo
        }
      },
      connectionStatus: "unavailable",
      reconnect: agentHook.reconnect
    });
    render(<App sessionId={SESSION_ID} />);

    expect(screen.getByText("Offline")).toBeVisible();
    expect(
      screen.getByText(/The Agent is unavailable\. Your auction state remains saved/)
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(agentHook.reconnect).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Pass player" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reset demo" })).toBeDisabled();
  });

  it("shows active preferences and saves strategy changes to the Agent", async () => {
    const user = userEvent.setup();
    render(<App sessionId={SESSION_ID} />);

    expect(screen.getByLabelText("Active strategy preferences")).toHaveTextContent(
      "30% reserve"
    );
    expect(screen.getByLabelText("Active strategy preferences")).toHaveTextContent(
      "balanced risk"
    );

    fireEvent.change(screen.getByRole("slider", { name: /Reserve purse/i }), {
      target: { value: "40" }
    });
    await user.click(screen.getByRole("radio", { name: "Aggressive" }));
    await user.click(screen.getByRole("checkbox", { name: "Batter" }));
    await user.click(screen.getByRole("button", { name: "Save strategy" }));

    await waitFor(() =>
      expect(agentHook.rememberStrategy).toHaveBeenCalledWith({
        reservePercent: 40,
        riskTolerance: "aggressive",
        priorityRoles: ["fast-bowler", "all-rounder", "batter"]
      })
    );
    expect(screen.getByText(/Strategy saved/)).toBeVisible();
  });

  it("passes and advances lots through callable Agent operations", async () => {
    const user = userEvent.setup();
    render(<App sessionId={SESSION_ID} />);

    await user.click(screen.getByRole("button", { name: "Pass player" }));
    await waitFor(() => expect(agentHook.passPlayer).toHaveBeenCalledOnce());

    await user.click(screen.getByRole("button", { name: "Advance lot" }));
    await waitFor(() => expect(agentHook.advanceLot).toHaveBeenCalledOnce());
    expect(screen.getByText(/auction has advanced/)).toBeVisible();
  });

  it("supports keyboard activation for primary auction actions", async () => {
    const user = userEvent.setup();
    render(<App sessionId={SESSION_ID} />);

    screen.getByRole("button", { name: "Pass player" }).focus();
    await user.keyboard("{Enter}");

    await waitFor(() => expect(agentHook.passPlayer).toHaveBeenCalledOnce());
  });

  it("requires confirmation before resetting the demo", async () => {
    const user = userEvent.setup();
    render(<App sessionId={SESSION_ID} />);

    await user.click(screen.getByRole("button", { name: "Reset demo" }));
    expect(agentHook.resetDemo).not.toHaveBeenCalled();
    expect(screen.getByRole("group", { name: "Confirm reset" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Confirm reset" }));
    await waitFor(() => expect(agentHook.resetDemo).toHaveBeenCalledOnce());
    expect(screen.getByText(/reset to the starting lineup/)).toBeVisible();
  });

  it("reports callable failures without exposing internal errors", async () => {
    const user = userEvent.setup();
    agentHook.advanceLot.mockRejectedValueOnce(new Error("private RPC detail"));
    render(<App sessionId={SESSION_ID} />);

    await user.click(screen.getByRole("button", { name: "Advance lot" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "could not apply that change"
    );
    expect(screen.queryByText("private RPC detail")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Advance lot" })).toBeEnabled();
  });
});
