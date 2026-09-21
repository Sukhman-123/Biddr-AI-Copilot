# Implementation Plan

## Delivery strategy

Work proceeds through gated phases. Every checklist item and verification step
in the active phase must be complete before work begins on the next phase. If a
later discovery invalidates an earlier decision, the affected phase is reopened
and documented rather than silently bypassed.

## Fixed MVP scope

### Auction simulator

- Fictional, repository-owned cricket-player dataset.
- Current player, role, base price, current bid, and bid increment.
- User franchise purse, squad composition, and role requirements.
- Remaining players grouped by role.
- Bid history and auction event log.
- Advance, pass, approved bid, and reset actions.

### AI copilot

- Streaming chat responses.
- Suggested starter questions.
- Visible tool status and structured recommendation presentation.
- `BID`, `CAUTION`, or `PASS` recommendation with a maximum bid.
- Remembered budget reserve, risk tolerance, and role priorities.
- Approval or rejection of proposed simulated bids.
- Deterministic fallback copy when model inference fails.

### Explicit non-goals

- Real-money bidding or payments.
- Real players, live sports data, or scraping.
- User accounts, authorization, or multi-tenant security guarantees.
- Voice, mobile apps, notifications, analytics, or external databases.
- A long-running Cloudflare Workflow; the Agent already supplies the required
  coordination for this bounded interactive experience.

## Phase 0 — Planning and documentation

### Deliverables

- [x] Initial `README.md`.
- [x] `docs/PLAN.md` with scope, phase gates, and acceptance criteria.
- [x] `docs/ARCHITECTURE.md` with runtime, state, tools, and failure design.
- [x] `docs/PROMPT_HISTORY.md` initialized before feature code.
- [x] Explicit, testable MVP acceptance criteria.

### Exit condition

- [x] Architecture and scope are documented before feature code begins.
- [x] Every assignment requirement maps to one owned system component.
- [x] Non-goals constrain the implementation to a finishable submission.

## Phase 1 — Project foundation

### Deliverables

- [x] React, Vite, and TypeScript application based on the official Agents
      starter structure.
- [x] Worker entry point and exported `BiddrCopilotAgent`.
- [x] Wrangler configuration with Workers AI binding and a SQLite Durable Object
      migration.
- [x] Cloudflare-compatible generated environment types.
- [x] ESLint, type-check, test, build, and deploy scripts.
- [x] Vitest and React Testing Library configuration.
- [x] Initial accessible, responsive application shell.
- [x] Repository hygiene: `.gitignore`, example environment guidance, and no
      committed credentials.

### Verification gate

- [x] Dependency installation succeeds from a clean checkout.
- [x] `npm run lint` passes.
- [x] `npm run typecheck` passes.
- [x] `npm test -- --run` passes.
- [x] `npm run build` passes.

## Phase 2 — Deterministic auction engine

### Deliverables

- [x] Domain types for players, squads, bids, strategy, and auction state.
- [x] Fictional seed data with enough positional scarcity for meaningful advice.
- [x] Pure transitions for bid, pass, advance, and reset.
- [x] Purse, squad, remaining-role, and bid-history calculations.
- [x] Transparent valuation factors and scarcity score.
- [x] Maximum-bid calculation and `BID`/`CAUTION`/`PASS` decision logic.
- [x] Unit tests for normal, boundary, and invalid transitions.

### Verification gate

- [x] The engine is deterministic for the same state and strategy.
- [x] Purse cannot become negative and invalid bids cannot be committed.
- [x] Recommendation output exposes its numerical factors for explanation.
- [x] Engine unit tests pass independently of Cloudflare and the LLM.

## Phase 3 — Stateful Cloudflare agent

### Deliverables

- [x] `BiddrCopilotAgent` implemented with `AIChatAgent`.
- [x] Workers AI provider configured for the selected Llama model.
- [x] Persistent auction state and strategy preferences.
- [x] Persistent chat messages and resumable streaming.
- [x] Typed, Zod-validated read and analysis tools.
- [x] Bounded tool loop and output limits.
- [x] Approval-gated `commitSimulatedBid` tool.
- [x] Deterministic fallback for inference errors and exhausted quota.
- [x] Agent-level tests for tools, state mutation, and approval behavior.

### Verification gate

- [x] Model-visible numbers originate from tools or deterministic results.
- [x] Only an approved mutation can spend purse or add a player.
- [x] Strategy and auction state survive Agent reconstruction.
- [x] Tool input failures return safe, useful errors.

## Phase 4 — Client integration

### Deliverables

- [ ] Stable per-browser demo-session identifier.
- [ ] Live Agent connection and reconnect behavior.
- [ ] Auction dashboard and current-player presentation.
- [ ] Streaming chat, suggested prompts, and accessible composer.
- [ ] Tool activity and structured recommendation cards.
- [ ] Approval and rejection controls.
- [ ] Strategy-memory controls and visible active preferences.
- [ ] Advance and reset interactions.
- [ ] Responsive mobile and desktop layouts.

### Verification gate

- [ ] Two fresh browsers do not share auction state.
- [ ] Refresh preserves the current browser's state and chat.
- [ ] Loading, streaming, empty, error, approval, and fallback states render.
- [ ] Primary flows are keyboard accessible.

## Phase 5 — Reliability and safety

### Deliverables

- [ ] Zod validation at every untrusted boundary.
- [ ] Message length and tool-step limits.
- [ ] Prompt separates instructions from untrusted auction content.
- [ ] No arbitrary URL, generic fetch, code execution, or external-write tool.
- [ ] Defensive state invariants and idempotent approval handling.
- [ ] Friendly network, model, quota, and reconnect errors.
- [ ] Expanded unit, Agent integration, and component tests.
- [ ] Accessibility and responsive-layout review.

### Verification gate

- [ ] Malformed inputs cannot mutate state.
- [ ] Replaying an approved request cannot double-spend the purse.
- [ ] The app remains navigable and informative without model availability.
- [ ] All automated checks pass together.

## Phase 6 — Deployment and submission

### Deliverables

- [ ] Public `workers.dev` deployment.
- [ ] Public GitHub repository.
- [ ] Final README with setup, usage, architecture, and limitations.
- [ ] Architecture diagram and screenshots.
- [ ] Two-minute reviewer demo script.
- [ ] Complete sanitized prompt history.
- [ ] Clean-clone installation and build verification.

### Verification gate

- [ ] A logged-out reviewer can complete the primary flow at the public URL.
- [ ] Deployment uses only documented Cloudflare bindings.
- [ ] Repository contains no credentials or local-only generated files.
- [ ] Every MVP acceptance criterion below is evidenced.

## MVP acceptance criteria

| ID | Criterion | Planned evidence |
| --- | --- | --- |
| AC-01 | Public demo requires no account | Logged-out smoke test |
| AC-02 | Dashboard reflects live auction state | Component and Agent test |
| AC-03 | Copilot reads state through tools | Tool-call integration test |
| AC-04 | Engine owns the recommendation math | Unit tests and source docs |
| AC-05 | Remembered strategy affects advice | Before/after integration test |
| AC-06 | Refresh preserves state and chat | Reconnect smoke test |
| AC-07 | Proposed bid requires approval | Approval integration test |
| AC-08 | Rejection causes no mutation | State snapshot test |
| AC-09 | Deterministic fallback remains useful | Forced model-failure test |
| AC-10 | Reset restores known seed state | Engine unit test |
| AC-11 | Mobile, desktop, and keyboard flows work | Manual accessibility review |
| AC-12 | All repository checks pass | CI/local command output |
| AC-13 | Documentation and prompt history are safe | Final repository review |
| AC-14 | Public GitHub and Cloudflare URLs exist | Submission smoke test |
