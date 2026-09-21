import { describe, expect, it } from "vitest";
import { BIDDR_MODEL_ID, BIDDR_SYSTEM_PROMPT } from "../../src/agent/model";

describe("Workers AI model configuration", () => {
  it("selects the Cloudflare-hosted Llama 3.3 function-calling model", () => {
    expect(BIDDR_MODEL_ID).toBe(
      "@cf/meta/llama-3.3-70b-instruct-fp8-fast"
    );
  });

  it("forbids the model from inventing authoritative auction state", () => {
    expect(BIDDR_SYSTEM_PROMPT).toContain(
      "Auction figures must come from Biddr's deterministic tools"
    );
    expect(BIDDR_SYSTEM_PROMPT).toContain("instead of guessing");
  });
});

