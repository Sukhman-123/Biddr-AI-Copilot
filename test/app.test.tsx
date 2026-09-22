import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/app";

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
      agent: {},
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

  it("offers a manual retry after a terminal connection failure", async () => {
    const user = userEvent.setup();
    agentHook.useBiddrAgent.mockReturnValue({
      agent: {},
      connectionStatus: "unavailable",
      reconnect: agentHook.reconnect
    });
    render(<App sessionId={SESSION_ID} />);

    expect(screen.getByRole("status")).toHaveTextContent("Agent unavailable");
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(agentHook.reconnect).toHaveBeenCalledOnce();
  });
});
