# AI-Assisted Development History

This project uses AI-assisted planning and coding, as encouraged by the
assignment. This file records prompts, outcomes, and consequential decisions in
chronological order. Secrets, machine credentials, hidden system instructions,
and irrelevant local information are intentionally excluded.

The history is updated during development, not reconstructed only at the end.

## Session 1 — Initial product planning

### User prompt

> Optional Assignment: Please share GitHub repo URL for the project here.
>
> We plan to fast track candidates who complete an assignment to build a type of
> AI-powered application on Cloudflare. An AI-powered application should include
> an LLM, workflow or coordination, user input via chat or voice, and memory or
> state. AI-assisted coding is encouraged, but prompt history must be submitted.
>
> I encountered this while applying for a job at Cloudflare. Can we plan to
> develop this using freely available resources?

### AI response summary

The assistant proposed **Biddr AI Copilot**, a stateful cricket-auction simulator
and strategist. It recommended React, TypeScript, a Cloudflare `AIChatAgent`,
Workers AI with Llama 3.3, SQLite-backed Durable Objects, deterministic analysis
tools, and an approval-gated simulated bid. It divided delivery into planning,
foundation, engine, Agent, client, reliability, and deployment phases.

### Decisions retained

- Use fictional data and avoid paid or external services.
- Deploy the UI and Worker together.
- Make deterministic code authoritative for all numerical advice.
- Persist messages, strategy, and auction state.
- Require explicit approval before simulated bid mutation.
- Maintain this prompt-history artifact throughout development.

## Session 2 — Repository discovery and plan validation

### User prompts

> now can you access Biddr AI copilot?

> you know what to do here?

> [Provided the original assignment and previous Codex plan.] Can we somehow
> plan to develop this?

> how much time this can take, overall implementation in terms of hours keeping
> in mind my existing codex plan

### AI response summary

The assistant verified that the local Git repository was empty and configured
with the GitHub remote `Sukhman-123/Biddr-AI-Copilot`. It validated the proposal
against current Cloudflare documentation and estimated 14–20 focused hours for
a strong submission. It recommended using the official Agents starter, current
`@cloudflare/ai-chat` approval APIs, and a separate Agent instance per browser
demo session.

### Decisions retained

- Use a locally persisted random session ID to prevent public reviewers from
  sharing one auction.
- Start from the official Cloudflare Agents project structure.
- Treat free-tier limits as a graceful failure case, not as an assumption.
- Skip Cloudflare Workflows in the MVP because the Agent supplies sufficient
  coordination and direct tool approval.

## Session 3 — Begin phased implementation

### User prompt

> ok, then start with it, we have to focus pointers inside each phase, complete
> all pointers inside a phase then move to next

### AI actions

- Established phase completion gates in `docs/PLAN.md`.
- Created the initial README and explicit acceptance criteria.
- Documented components, state ownership, tool boundaries, safety, failure
  behavior, testing, and rejected alternatives.
- Initialized the prompt history before feature code.

### Phase result

Phase 0 is complete. Phase 1 may begin only after these documents are checked for
internal consistency and repository status is reviewed.

## Session 4 — Phase 1 project foundation

### AI actions

- Verified the current official `cloudflare/agents-starter` integration points.
- Discovered that the machine's Node.js 18 runtime did not meet the current
  Cloudflare scaffolder requirement, then used an isolated Node.js 22 runtime
  without changing the system installation.
- Worked around a scaffolder template-selection/install failure by using the
  canonical public starter repository as the reference source.
- Created the React, Vite, TypeScript, Cloudflare Worker, Agent, Workers AI, and
  SQLite Durable Object foundation.
- Added generated Cloudflare environment types, repository hygiene, Node version
  guidance, ESLint, Vitest, React Testing Library, and deployment scripts.
- Built an accessible responsive Biddr application shell with feature controls
  explicitly disabled until their owning phases are complete.

### Verification result

The combined `npm run check` gate passed:

- ESLint: passed with zero warnings.
- TypeScript: passed with no emitted files.
- Vitest: 2 of 2 component tests passed.
- Vite: Worker and client production builds passed.
- Dependency audit: 0 known vulnerabilities reported at installation time.

### Decisions retained

- Node.js 22 is the documented minimum and is recorded in `.nvmrc`.
- The application uses no remotely loaded font or visual asset.
- The Agent remains a foundation shell until the deterministic engine is built;
  unfinished UI actions remain disabled rather than simulating integration.

### Phase result

Phase 1 is complete. Phase 2 may begin.

## Session 5 — Phase 2 deterministic auction engine

### User direction

The user required every pointer within a phase to be completed before moving to
the next phase.

### AI actions

- Defined typed players, roles, squads, bids, results, strategy preferences,
  auction state, recommendations, and valuation factors.
- Added twelve fictional auction players and seven fictional retained players.
- Represented currency as whole lakhs to avoid floating-point currency errors.
- Implemented immutable bid, pass, advance, strategy-update, and reset
  transitions.
- Added squad composition, remaining-role supply, positional scarcity, reserve,
  slot-budget, bid-increment, and maximum-bid calculations.
- Kept the deterministic recommendation engine authoritative for
  `BID`/`CAUTION`/`PASS` decisions.
- Added state invariants for purse reconciliation, squad limits, duplicate
  players, active lots, and current-bid ownership.

### Verification result

- ESLint passed with zero warnings.
- TypeScript type-check passed.
- Vitest passed 20 of 20 tests across the application shell and engine suites.
- Tests cover deterministic output, strategy-sensitive advice, currency
  conservation, immutable transitions, invalid bids, invalid state, and complete
  auction progression.

### Phase result

Phase 2 is complete. No Agent or client integration was added during this phase.
Phase 3 may begin after the completed phases are committed and pushed.

## Session 6 — Phase 3, pointer 1: Agent foundation

### User direction

The user clarified that each Phase 3 pointer must be completed, reported, and
explicitly approved before work starts on the next pointer.

### AI actions

- Typed `BiddrCopilotAgent` as `AIChatAgent<Env, BiddrAgentState>`.
- Added a versioned Agent state envelope containing an isolated deterministic
  auction snapshot and a bounded-action ID collection for later guarded writes.
- Kept the existing chat-history cap and resumable-chat recovery configuration.
- Isolated the initial-state factory from Cloudflare runtime imports so it can be
  verified in the standard unit-test environment.

### Verification result

- ESLint passed with zero warnings.
- TypeScript type-check passed.
- Vitest passed 21 of 21 tests, including the new Agent-state isolation test.

### Pointer result

Phase 3 pointer 1 is complete. No Workers AI model or tools were added; work is
paused pending user approval to begin pointer 2.

## Session 7 — Phase 3, pointer 2: Workers AI model

### User approval

The user approved moving from pointer 1 to pointer 2 and requested a commit
message after each completed pointer.

### AI actions

- Configured `workers-ai-provider` against the Worker `AI` binding.
- Selected `@cf/meta/llama-3.3-70b-instruct-fp8-fast` as an exported, testable
  model identifier.
- Enabled Durable Object session affinity for Workers AI prefix-cache routing.
- Replaced the Phase 1 placeholder response with an AI SDK streaming response.
- Added a system prompt that forbids invented auction figures or unconfirmed
  state changes before the typed tool surface is introduced.
- Forwarded chat cancellation to model inference without weakening exact
  optional-property checks.

### Verification result

- Complete `npm run check` gate passed.
- ESLint and TypeScript passed.
- Vitest passed 23 of 23 tests.
- Both the Worker and React production bundles built successfully.

### Pointer result

Phase 3 pointer 2 is complete. Persistent application state and tool definitions
were not added in this pointer. Work is paused pending user approval for pointer
3.

## Session 8 — Phase 3, pointer 3: Persistent auction state

### User approval

The user approved pointer 3 after committing the Workers AI configuration.

### AI actions

- Added validated strategy-preference schemas with strict object handling,
  bounded reserve percentages, enumerated risk tolerance, known roles, and
  duplicate-role rejection.
- Added pure Agent-state transitions for remembering strategy, passing a player,
  advancing a lot, and resetting the demo.
- Added callable Agent methods that apply those transitions and persist them via
  `this.setState()`, which stores and broadcasts Agent state through the
  SQLite-backed Durable Object runtime.
- Kept bid commitment unavailable so no callable method can bypass the future
  human-approval boundary.
- Added serialization and transition tests for strategy, auction progression,
  purse stability, reset behavior, and malformed inputs.

### Verification result

- ESLint and TypeScript passed.
- Vitest passed 27 of 27 tests.
- The callable decorators compiled successfully in both production Worker and
  client builds.

### Pointer result

Phase 3 pointer 3 is complete. Chat message persistence and resumable streaming
remain the next separate pointer. Work is paused pending user approval.
