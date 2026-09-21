# Biddr AI Copilot

Biddr AI Copilot is a stateful cricket-auction simulator and AI strategist built
for the Cloudflare AI application assignment. A reviewer can run a fictional
auction, ask the copilot for advice grounded in the live auction state, save
strategy preferences, and approve or reject simulated bids proposed by the
agent.

> Project status: Phases 0–2 complete. The documented foundation and tested
> deterministic auction engine are ready for Stateful Agent integration.

## Assignment coverage

| Requirement | Implementation |
| --- | --- |
| LLM | Llama 3.3 70B on Workers AI |
| Workflow and coordination | Cloudflare `AIChatAgent` in a Worker |
| User input | React chat interface with streaming responses |
| Memory and state | SQLite-backed Durable Object per demo session |
| Agent actions | Typed auction tools and an approval-gated bid tool |

## What the demo will show

- A fictional cricket-player auction with a purse, squad composition, current
  player, current bid, remaining players, and bid history.
- A streaming chat copilot that reads live state through tools instead of
  inventing auction figures.
- A deterministic valuation engine that returns `BID`, `CAUTION`, or `PASS`
  and a maximum recommended bid.
- Persistent conversation, auction state, and strategy preferences.
- Explicit approval before a proposed bid changes the simulated auction.
- A deterministic fallback when Workers AI is unavailable or quota-limited.

## Architecture

The React application and Worker are deployed as one Cloudflare project. The
browser connects to a `BiddrCopilotAgent` over the Agents protocol. Each browser
stores a random demo-session identifier locally and therefore receives an
isolated Durable Object. The Agent persists chat messages and application state
in colocated SQLite storage and calls Workers AI when generating explanations.

```text
React + TypeScript UI
        |
        | WebSocket / Agents protocol
        v
BiddrCopilotAgent (AIChatAgent)
        |-- Workers AI / Llama 3.3
        |-- deterministic auction tools
        |-- approval-gated simulated bid
        `-- Durable Object SQLite
              |-- chat messages
              |-- auction state
              `-- strategy preferences
```

The detailed design is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), and the
phase gates are tracked in [docs/PLAN.md](docs/PLAN.md).

## Technology

- React and TypeScript
- Vite with the Cloudflare Vite plugin
- Cloudflare Workers and Agents SDK
- `@cloudflare/ai-chat`
- Workers AI
- SQLite-backed Durable Objects
- Zod
- Vitest and React Testing Library
- Repository-owned CSS and fictional seed data

No external sports API, proprietary player data, authentication provider,
database service, paid template, or paid media asset is required.

## MVP acceptance criteria

The MVP is complete only when all criteria below pass:

1. A reviewer can open the deployed URL without creating an account.
2. The dashboard shows the current player, bid, purse, and squad state.
3. Copilot answers are grounded in the active auction through typed tools.
4. A deterministic engine calculates the decision and maximum recommended bid.
5. Remembered strategy changes a later recommendation.
6. Refreshing or reconnecting preserves chat and auction state for that session.
7. A model-proposed bid requires explicit approval before state changes.
8. Rejecting a proposed bid leaves the auction state unchanged.
9. The dashboard remains useful when Workers AI is unavailable.
10. Reset creates the same known initial demo state.
11. The interface works at mobile and desktop widths and supports keyboard use.
12. Lint, type-check, test, and production-build commands pass.
13. The public repository contains setup, architecture, limitations, and prompt
    history documentation without secrets.
14. A public Cloudflare deployment and GitHub repository URL are available.

## Development

### Prerequisites

- Node.js 22 or newer (`.nvmrc` is included).
- A Cloudflare account when using the remote Workers AI binding.
- Wrangler authentication through `npx wrangler login` or a scoped token in an
  untracked local environment file.

### Commands

```bash
npm install
npm run dev
```

The complete local quality gate is:

```bash
npm run check
```

Individual commands are available as `npm run lint`, `npm run typecheck`,
`npm run test:run`, and `npm run build`. Regenerate binding and runtime types
after changing `wrangler.jsonc` with `npm run cf-typegen`.

## Data and limitations

All names, statistics, teams, bids, and valuations in the demo are fictional.
Biddr provides simulated strategic guidance, not financial, gambling, or
professional sports advice. The first version is intentionally unauthenticated;
session isolation is for demo usability rather than identity or access control.

## AI-assisted development

AI-assisted coding is being used for this project. The sanitized development
transcript and major decisions are recorded in
[docs/PROMPT_HISTORY.md](docs/PROMPT_HISTORY.md).
