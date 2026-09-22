# Architecture

## Objectives

Biddr must visibly demonstrate AI reasoning, coordinated tool use, chat input,
and durable memory while remaining small enough for a reviewer to understand in
minutes. It must also continue to provide a useful deterministic recommendation
when model inference is unavailable.

## System context

```text
Reviewer browser
  React dashboard + chat
          |
          | Agents WebSocket protocol
          v
Cloudflare Worker
  routeAgentRequest()
          |
          v
BiddrCopilotAgent (one Durable Object per demo session)
  |-- AIChatAgent message persistence and resumable streams
  |-- serialized auction and strategy state
  |-- deterministic TypeScript auction engine
  |-- typed tools with Zod boundaries
  `-- Workers AI binding -> Llama 3.3 70B
```

The compiled React assets and Worker deploy as one Cloudflare application. This
removes cross-origin configuration and a second hosting surface.

## Runtime components

### React client

The client renders the auction state, connects to an Agent, streams chat, and
surfaces tool activity and approval requests. It does not calculate authoritative
valuations or mutate auction state optimistically. Strategy, pass, advance, and
reset controls invoke validated callable Agent methods and wait for synchronized
state. The two-column desktop workspace collapses into touch-friendly stacked
controls without hiding connection or error feedback on small screens.

On first load, it creates a random demo-session identifier and stores it in
`localStorage`. The identifier selects the Agent instance. This prevents public
reviewers from sharing one global auction while preserving a returning browser's
demo. It is not an authentication mechanism.

### Worker router

The Worker routes Agent protocol requests with `routeAgentRequest()`. Static
assets are produced by Vite and deployed with the Worker. Non-Agent API surface
area is kept deliberately small.

### BiddrCopilotAgent

`BiddrCopilotAgent` extends `AIChatAgent`. It owns:

- persisted chat messages and resumable response streams;
- auction state and strategy preferences;
- validated callable operations and model tools;
- Workers AI invocation and deterministic fallback handling.

The Agent is the concurrency boundary. All state-changing operations execute
against one session's Durable Object, avoiding cross-request locking code.

### Deterministic auction engine

The engine is a collection of pure TypeScript functions. It calculates purse
constraints, squad gaps, role scarcity, player value, and bid ceiling. Its
result contains both the decision and transparent factors suitable for display
or LLM explanation.

The LLM cannot override engine invariants. It may choose read tools, request an
analysis, explain a result, remember validated preferences, or propose an
approval-gated action.

### Workers AI

The Agent calls `@cf/meta/llama-3.3-70b-instruct-fp8-fast` through the Workers AI
binding and the Workers AI provider. Responses stream to the client. Model input
contains bounded conversation history and structured tool results. Output and
tool-step counts are capped to protect free-tier usage and latency.

## State design

The MVP uses Agent state for the compact, synchronized application snapshot and
`AIChatAgent`'s built-in SQLite tables for messages.

```ts
type BiddrAgentState = {
  schemaVersion: 1;
  auction: AuctionState;
  processedActionIds: string[];
};
```

`AuctionState` contains the current lot index, team purse, roster, player
statuses, current bid, bid history, event log, and `StrategyPreferences`.
Preferences contain reserve percentage, risk tolerance, and prioritized roles.
The processed action IDs provide a bounded idempotency record for
state-changing approvals.

State is JSON-serializable and replaced through `setState()` so connected
clients receive synchronized updates. If event volume later makes the snapshot
too large, bid history can move to an application SQL table without changing the
public behavior.

## Tool boundary

| Tool | Reads state | Changes state | Approval |
| --- | --- | --- | --- |
| `getAuctionState` | Yes | No | No |
| `getCurrentPlayer` | Yes | No | No |
| `getTeamComposition` | Yes | No | No |
| `listRemainingPlayers` | Yes | No | No |
| `analyzeBid` | Yes | No | No |
| `getStrategy` | Yes | No | No |
| `commitSimulatedBid` | Yes | Yes | Always |

`rememberStrategy`, pass, advance, and reset are validated callable Agent
operations used by the client rather than model tools. Only
`commitSimulatedBid` lets a model-requested operation spend purse.

All tool inputs use strict Zod schemas. State-changing calls revalidate business
rules at execution time; prior analysis is never treated as authorization.

## Primary sequences

### Grounded recommendation

1. Reviewer asks whether to bid on the current player.
2. Agent calls state and analysis tools.
3. The deterministic engine returns a decision, maximum bid, and factors.
4. Llama produces a concise explanation grounded in that result.
5. The client renders streamed text plus the structured recommendation.

### Approval-gated bid

1. Agent proposes a bid using the deterministic ceiling.
2. `commitSimulatedBid` enters the waiting-for-approval state.
3. Client shows the exact amount and its effect on the purse.
4. Rejection records no auction mutation.
5. Approval executes the tool, which rechecks lot, amount, purse, and action ID.
6. Agent state updates and is broadcast to the dashboard.

## Trust and safety boundaries

- Player data is fictional and treated as data, never as instructions.
- There is no arbitrary network-fetch, URL-open, shell, code-execution, payment,
  or external messaging tool.
- The browser cannot directly submit authoritative auction state.
- Tool inputs and outputs, client messages, persisted Agent state, and model
  transcript structure are validated with Zod before use.
- User and assistant transcript text is length-bounded and explicitly framed as
  untrusted data before it reaches the model.
- Bid execution is idempotent and requires current-state validation.
- System instructions explicitly defer numerical authority to the engine.
- Logs and prompt history must not contain account tokens or credentials.

## Failure behavior

| Failure | User-visible behavior |
| --- | --- |
| Workers AI error or daily quota exhausted | Show engine recommendation with deterministic explanatory copy |
| WebSocket disconnect | Display reconnecting state and resume supported streams |
| Invalid tool input | Reject without mutation and return a concise validation message |
| Stale bid proposal | Reject and ask for a fresh analysis of the current lot |
| Duplicate approved action | Return the prior outcome without a second mutation |
| Corrupt/unknown state version | Preserve data, block mutations, and surface a reset option |

## Testing strategy

- Pure engine unit tests cover values, transitions, invariants, and boundaries.
- Worker-pool tests exercise Agent persistence, routing, and tools.
- React tests cover dashboard states, chat composer, approval, errors, and
  keyboard behavior.
- A final deployed smoke test covers isolated sessions, refresh persistence,
  approval/rejection, reset, and model failure fallback.

## Alternatives intentionally rejected

- **External database:** unnecessary because each Agent already has colocated
  SQLite storage.
- **Pages plus a separate Worker:** adds deployment and CORS complexity without
  improving the demo.
- **Cloudflare Workflow for bids:** approval lasts only for an interactive chat
  session; the direct chat-tool approval mechanism is sufficient.
- **LLM-generated valuation:** difficult to test and prone to numerical drift.
- **Real player dataset:** creates licensing, freshness, and attribution work
  unrelated to the assignment's engineering signal.
