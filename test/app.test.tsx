import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/app";
import {
  createInitialAgentState,
  passAgentCurrentPlayer
} from "../src/agent/state";

const agentHook = vi.hoisted(() => ({
  reconnect: vi.fn(),
  useBiddrAgent: vi.fn()
}));

vi.mock("../src/client/use-biddr-agent", () => ({
  useBiddrAgent: agentHook.useBiddrAgent
}));

const SESSION_ID = "1995e44b-4a15-4ed1-8b79-4f0edb9026b4";

describe("Biddr application shell", () => {
  beforeEach(() => {
    agentHook.reconnect.mockReset();
    agentHook.useBiddrAgent.mockReset();
    agentHook.useBiddrAgent.mockReturnValue({
      agent: { state: createInitialAgentState() },
      connectionStatus: "connected",
      reconnect: agentHook.reconnect
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
    expect(screen.getByText("Agent connected")).toBeInTheDocument();
    expect(agentHook.useBiddrAgent).toHaveBeenCalledWith(SESSION_ID);
  });

  it("keeps unfinished auction and chat actions disabled", () => {
    render(<App sessionId={SESSION_ID} />);

    expect(screen.getByRole("button", { name: "Place bid" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
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
      agent: { state: passAgentCurrentPlayer(createInitialAgentState()) },
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
      agent: { state: undefined },
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
      agent: { state: completeState },
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
      agent: { state: createInitialAgentState() },
      connectionStatus: "unavailable",
      reconnect: agentHook.reconnect
    });
    render(<App sessionId={SESSION_ID} />);

    expect(screen.getByRole("status")).toHaveTextContent("Agent unavailable");
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(agentHook.reconnect).toHaveBeenCalledOnce();
  });
});
