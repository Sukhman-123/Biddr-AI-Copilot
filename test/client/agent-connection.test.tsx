import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BIDDR_AGENT_CLASS_NAME,
  useBiddrAgent
} from "../../src/client/use-biddr-agent";

const agentSdk = vi.hoisted(() => ({
  reconnect: vi.fn(),
  useAgent: vi.fn()
}));

vi.mock("agents/react", () => ({ useAgent: agentSdk.useAgent }));

const SESSION_ID = "1995e44b-4a15-4ed1-8b79-4f0edb9026b4";

describe("Biddr Agent connection", () => {
  beforeEach(() => {
    agentSdk.reconnect.mockReset();
    agentSdk.useAgent.mockReset();
    agentSdk.useAgent.mockReturnValue({ reconnect: agentSdk.reconnect });
  });

  it("addresses the Agent with the stable browser session identifier", () => {
    renderHook(() => useBiddrAgent(SESSION_ID));

    expect(agentSdk.useAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: BIDDR_AGENT_CLASS_NAME,
        name: SESSION_ID
      })
    );
  });

  it("reports automatic disconnect and reconnect transitions", () => {
    const { result } = renderHook(() => useBiddrAgent(SESSION_ID));
    const options = agentSdk.useAgent.mock.calls[0]?.[0];
    if (!options) throw new Error("Agent options were not captured.");

    expect(result.current.connectionStatus).toBe("connecting");
    act(() => options.onOpen());
    expect(result.current.connectionStatus).toBe("connected");
    act(() =>
      options.onClose(
        new CloseEvent("close", { code: 1006, reason: "network lost" })
      )
    );
    expect(result.current.connectionStatus).toBe("reconnecting");
    act(() => options.onOpen());
    expect(result.current.connectionStatus).toBe("connected");
  });

  it("surfaces terminal failures and supports manual retry", () => {
    const { result } = renderHook(() => useBiddrAgent(SESSION_ID));
    const options = agentSdk.useAgent.mock.calls[0]?.[0];
    if (!options) throw new Error("Agent options were not captured.");

    act(() => options.onConnectionError(new Error("terminal")));
    act(() =>
      options.onClose(
        new CloseEvent("close", { code: 4001, reason: "terminal" })
      )
    );
    expect(result.current.connectionStatus).toBe("unavailable");

    act(() => result.current.reconnect());
    expect(agentSdk.reconnect).toHaveBeenCalledOnce();
    expect(result.current.connectionStatus).toBe("connecting");
  });
});
