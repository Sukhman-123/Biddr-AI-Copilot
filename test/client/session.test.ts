import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEMO_SESSION_STORAGE_KEY,
  getOrCreateDemoSessionId,
  isDemoSessionId
} from "../../src/client/session";

const FIRST_SESSION_ID = "1995e44b-4a15-4ed1-8b79-4f0edb9026b4";
const SECOND_SESSION_ID = "7b622037-1d78-4cc7-aadc-a823ae68f55f";

describe("browser demo session", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("creates and stores a UUID for a fresh browser", () => {
    const sessionId = getOrCreateDemoSessionId({
      storage: localStorage,
      generateId: () => FIRST_SESSION_ID
    });

    expect(sessionId).toBe(FIRST_SESSION_ID);
    expect(localStorage.getItem(DEMO_SESSION_STORAGE_KEY)).toBe(
      FIRST_SESSION_ID
    );
    expect(isDemoSessionId(sessionId)).toBe(true);
  });

  it("reuses the stored identifier after a refresh", () => {
    localStorage.setItem(DEMO_SESSION_STORAGE_KEY, FIRST_SESSION_ID);
    const generateId = vi.fn(() => SECOND_SESSION_ID);

    expect(
      getOrCreateDemoSessionId({ storage: localStorage, generateId })
    ).toBe(FIRST_SESSION_ID);
    expect(generateId).not.toHaveBeenCalled();
  });

  it("gives separate fresh browser stores different identifiers", () => {
    const firstBrowser = new Map<string, string>();
    const secondBrowser = new Map<string, string>();
    const asStorage = (values: Map<string, string>) => ({
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value)
    });

    expect(
      getOrCreateDemoSessionId({
        storage: asStorage(firstBrowser),
        generateId: () => FIRST_SESSION_ID
      })
    ).toBe(FIRST_SESSION_ID);
    expect(
      getOrCreateDemoSessionId({
        storage: asStorage(secondBrowser),
        generateId: () => SECOND_SESSION_ID
      })
    ).toBe(SECOND_SESSION_ID);
  });

  it("replaces malformed stored identifiers", () => {
    localStorage.setItem(DEMO_SESSION_STORAGE_KEY, "../../shared-agent");

    expect(
      getOrCreateDemoSessionId({
        storage: localStorage,
        generateId: () => SECOND_SESSION_ID
      })
    ).toBe(SECOND_SESSION_ID);
    expect(localStorage.getItem(DEMO_SESSION_STORAGE_KEY)).toBe(
      SECOND_SESSION_ID
    );
  });
});
