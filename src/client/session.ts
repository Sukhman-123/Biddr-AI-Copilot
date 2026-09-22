export const DEMO_SESSION_STORAGE_KEY = "biddr.demo-session.v1";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type SessionStorage = Pick<Storage, "getItem" | "setItem">;

type DemoSessionOptions = {
  storage?: SessionStorage | null;
  generateId?: () => string;
};

let volatileSessionId: string | null = null;

export function isDemoSessionId(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function getBrowserStorage(): SessionStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function generateDemoSessionId(generateId: () => string): string {
  const sessionId = generateId();
  if (!isDemoSessionId(sessionId)) {
    throw new Error("The demo session generator returned an invalid UUID.");
  }
  return sessionId;
}

export function getOrCreateDemoSessionId(
  options: DemoSessionOptions = {}
): string {
  const storage =
    options.storage === undefined ? getBrowserStorage() : options.storage;
  const generateId = options.generateId ?? (() => crypto.randomUUID());

  if (storage) {
    try {
      const storedSessionId = storage.getItem(DEMO_SESSION_STORAGE_KEY);
      if (isDemoSessionId(storedSessionId)) return storedSessionId;

      const sessionId = generateDemoSessionId(generateId);
      storage.setItem(DEMO_SESSION_STORAGE_KEY, sessionId);
      return sessionId;
    } catch {
      // Storage can be blocked by browser privacy settings. Keep this page
      // stable even when persistence across reloads is unavailable.
    }
  }

  volatileSessionId ??= generateDemoSessionId(generateId);
  return volatileSessionId;
}
