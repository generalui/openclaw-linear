# CLAUDE.md — openclaw-linear

OpenClaw plugin that integrates [Linear](https://linear.app) into an AI agent workflow. It receives
Linear webhook events (issues, comments), routes them through a debounced persistent work queue,
and dispatches the agent to triage. The agent uses the plugin's MCP-style tools to read and act on
Linear data — creating issues, leaving comments, managing projects, and so on.

For setup, build, and contribution guidance: see [CONTRIBUTING.md](./CONTRIBUTING.md).
For linting and formatting: see [documentation/LINTING.md](./documentation/LINTING.md).
For testing conventions: see [documentation/TESTING.md](./documentation/TESTING.md).

## Repo Structure

```text
src/
  index.ts              # Plugin entry point — activate/deactivate, tool registration, webhook routing
  linear-api.ts         # GraphQL client + resolver helpers (resolveTeamId, resolveStateId, etc.)
  webhook-handler.ts    # HTTP handler: HMAC verification, body parsing, duplicate delivery detection
  event-router.ts       # Maps raw Linear webhook payloads to RouterAction objects (wake/notify)
  work-queue.ts         # JSONL-backed persistent inbox queue with mutex, dedup, and crash recovery
  tools/
    linear-issue-tool.ts    # linear_issue: view/list/create/update/delete
    linear-comment-tool.ts  # linear_comment: list/add/update
    linear-project-tool.ts  # linear_project: list/view/create
    linear-relation-tool.ts # linear_relation: list/add/delete
    linear-team-tool.ts     # linear_team: list/members
    linear-view-tool.ts     # linear_view: list/get/create/update/delete
    queue-tool.ts           # linear_queue: peek/pop/drain/complete
test/
  tools/                # Unit tests per tool — mirrors src/tools/ one-to-one
  event-router.test.ts
  linear-api.test.ts
  webhook-handler.test.ts
  work-queue.test.ts
  format-consolidated-message.test.ts
documentation/
  CONTRIBUTING.md       # (root-level, symlinked) build, install, PR process
  LINTING.md            # ESLint, Prettier, markdownlint — config and commands
  TESTING.md            # Vitest — structure, commands, writing guidelines
```

## Architecture

### Event Flow

```text
Linear webhook → webhook-handler (HMAC verify, dedup)
  → event-router (filter by team/event/agentMapping → RouterAction)
    → debouncer (batch window, default 30s)
      → dispatchConsolidatedActions → InboxQueue.enqueue + agent dispatch
```

### Tool / Action Dispatch Pattern

Every tool follows the same shape — factory function, action-switched execute, errors always
returned as structured JSON (never thrown):

```typescript
export function createFooTool() {
  return {
    name: 'linear_foo',
    description: '...',
    inputSchema: { ... },
    async execute(_callId: string, params: Params): Promise<ToolResult> {
      try {
        switch (params.action) {
          case 'list':   return jsonResult(await listFoo(params))
          case 'create': return jsonResult(await createFoo(params))
        }
      } catch (err) {
        return jsonResult({ error: formatErrorMessage(err) })
      }
    },
  }
}
```

### Adding a New Tool — Checklist

1. Create `src/tools/linear-{name}-tool.ts` using the pattern above
2. Export `create{Name}Tool()` (factory, not a class)
3. Register in `src/index.ts`: `api.registerTool(create{Name}Tool())`
4. Add `test/tools/linear-{name}-tool.test.ts` — mock `../../src/linear-api.js`, test every action
5. Update `README.md` if the tool has user-facing config implications

### linear-api.ts Resolvers

`graphql<T>(query, variables)` is the base client. Resolvers translate human-readable names → Linear UUIDs
before passing them to mutations:

| Resolver | Signature | Notes |
|---|---|---|
| `resolveTeamId` | `(team: string)` | Team key e.g. `"ENG"`, case-insensitive |
| `resolveStateId` | `(teamId: string, name: string)` | UUID + state name, scoped to team |
| `resolveUserId` | `(nameOrEmail: string)` | Display name or email |
| `resolveLabelIds` | `(teamId: string, names: string[])` | Returns `string[]` |
| `resolveProjectId` | `(name: string)` | Project name |
| `resolveIssueId` | `(identifier: string)` | e.g. `"ENG-42"` → internal UUID |

### InboxQueue

Persistent JSONL file at `~/.openclaw/extensions/openclaw-linear/queue/inbox.jsonl`. Item lifecycle:
`pending → in_progress → (removed)`. Writes are atomic (temp-file + rename). A mutex serialises
all queue operations. Stale `in_progress` items from a previous crash are recovered on `activate`.

## Critical Conventions

### TypeScript Import Paths

Always import with `.js` extensions, not `.ts` — this is an ESM project compiled by `tsc`:

```typescript
import { graphql } from './linear-api.js'   // ✅
import { graphql } from './linear-api.ts'   // ❌
import { graphql } from './linear-api'      // ❌
```

### src/index.ts Coverage

`src/index.ts` is intentionally low on test coverage. It wires into the OpenClaw plugin runtime
(`api.registerTool`, `api.on`, `api.registerHttpRoute`) which requires a full harness to exercise.
Do not add tests for it unless you are building that harness.

### README.md as Config Source of Truth

All user-facing plugin configuration fields are documented in `README.md`. If you add or rename a
config field in `resolvePluginConfig` in `src/index.ts`, update the README config table too.

## What NOT to Do

- Do not import from `openclaw/plugin-sdk` in tests — mock at the `linear-api.js` boundary
- Do not bypass `InboxQueue` methods to write to the queue file directly
- Do not add `dist/` outputs to git — CI builds from source; `dist/` is gitignored
- Do not bump the version in `package.json` on a bug-fix-only branch unless the fix is user-facing
  (CI blocks merging if the tag already exists — an accidental bump blocks the whole branch)
