# CLAUDE.md — openclaw-linear

Linear integration plugin for [OpenClaw](https://github.com/nichochar/openclaw). Receives Linear webhook events, routes them through a persistent work queue, and exposes tools for agents to manage issues, comments, projects, teams, relations, and views via the Linear GraphQL API.

## Repo Structure

```text
src/
  index.ts              # Plugin entry point — activate/deactivate, tool registration, webhook routing
  linear-api.ts         # GraphQL client + resolver helpers (resolveTeamId, resolveStateId, etc.)
  webhook-handler.ts    # HTTP handler: HMAC verification, body parsing, duplicate delivery detection
  event-router.ts       # Maps raw Linear webhook payloads to RouterAction objects (wake/notify)
  work-queue.ts         # JSONL-backed persistent inbox queue with mutex, dedup, and recovery
  tools/
    linear-issue-tool.ts    # linear_issue: view/list/create/update/delete
    linear-comment-tool.ts  # linear_comment: list/add/update
    linear-project-tool.ts  # linear_project: list/view/create
    linear-relation-tool.ts # linear_relation: list/add/delete
    linear-team-tool.ts     # linear_team: list/members
    linear-view-tool.ts     # linear_view: list/get/create/update/delete
    queue-tool.ts           # linear_queue: peek/pop/drain/complete
test/
  tools/                # Unit tests per tool — one file per src/tools/ file
  event-router.test.ts
  linear-api.test.ts
  webhook-handler.test.ts
  work-queue.test.ts
  format-consolidated-message.test.ts
documentation/
  LINTING.md
  TESTING.md
```

## Architecture

### Event Flow

```text
Linear webhook → webhook-handler (HMAC verify, dedup)
  → event-router (filter by team/event/agentMapping, map to RouterAction)
    → debouncer (batch window, default 30s)
      → dispatchConsolidatedActions → InboxQueue.enqueue + agent dispatch
```

### Tool → Action Dispatch Pattern

Every tool follows the same shape:

```typescript
export function createFooTool() {
  return {
    name: 'linear_foo',
    description: '...',
    inputSchema: { ... },
    async execute(callId: string, params: Params): Promise<ToolResult> {
      try {
        switch (params.action) {
          case 'list': return jsonResult(await listFoo(params))
          case 'create': return jsonResult(await createFoo(params))
          // ...
        }
      } catch (err) {
        return jsonResult({ error: formatErrorMessage(err) })
      }
    }
  }
}
```

Tools **never throw** — errors are caught and returned as `{ error: string }` inside the `content` array.

### Adding a New Tool

1. Create `src/tools/linear-{name}-tool.ts` following the pattern above
2. Export `create{Name}Tool()` — factory function, no constructor
3. Register in `src/index.ts`: `api.registerTool(create{Name}Tool())`
4. Create `test/tools/linear-{name}-tool.test.ts` — mock `../../src/linear-api.js`, test every action
5. Export the tool name from the tool file (used in test assertions via `tool.name`)

### linear-api.ts Resolvers

All GraphQL mutations go through `graphql<T>(query, variables)`. Resolvers translate human-readable names → Linear UUIDs:

| Resolver | Args | Notes |
|---|---|---|
| `resolveTeamId(team)` | team key (e.g. `"ENG"`) | Case-insensitive match |
| `resolveStateId(teamId, name)` | UUID, state name | Scoped to team |
| `resolveUserId(nameOrEmail)` | display name or email | |
| `resolveLabelIds(teamId, names[])` | UUID, label names | Returns `string[]` |
| `resolveProjectId(name)` | project name | |
| `resolveIssueId(identifier)` | e.g. `"ENG-42"` | Returns internal UUID |

### InboxQueue

JSONL file at `~/.openclaw/extensions/openclaw-linear/queue/inbox.jsonl`. Items have states: `pending → in_progress → (removed)`. Write is atomic (temp file + rename). Mutex serialises all queue ops. Stale `in_progress` items are recovered on startup.

## Code Style

- **Formatter:** Prettier — `singleQuote: true`, `semi: false`, `trailingComma: 'all'`, `printWidth: 120`
- **Linter:** ESLint (see `eslint.config.js`) — zero warnings in CI
- Always run `npm run format:check` and `npm run lint:project` before committing
- TypeScript strict mode; no `any` in production code without an eslint-disable comment

## Testing

- **Runner:** Vitest (`npm test` or `npx vitest run`)
- **Coverage:** `npm run test:coverage` (requires `@vitest/coverage-v8`)
- **Pattern:** Each test file mocks `../../src/linear-api.js` entirely. Tests verify:
  - GraphQL variables passed (the right UUIDs, the right filter vars)
  - Mutation `input` object composition (all resolved IDs present)
  - Error paths return `{ error: "..." }` rather than throwing
- **Do not** test "has correct name" — that's a string literal, not logic
- **Do not** test TypeScript-unreachable branches (e.g. `throw new Error("Unknown action")` after exhaustive switch)
- `src/index.ts` is intentionally low coverage — it requires a full OpenClaw runtime harness

See `documentation/TESTING.md` for full guidance.

## Versioning & Release

- Version lives in `package.json` only
- CI (`check-version.yml`) blocks merging if the version tag already exists on remote
- Bump the version in `package.json` before opening a PR that adds features or fixes bugs
- Publishing is automatic on merge to `main` via `publish.yml`

## What NOT to Do

- Do not import from `openclaw/plugin-sdk` in tests — mock the module boundary at `linear-api.js`
- Do not add new config fields to `resolvePluginConfig` without updating `README.md` config table
- Do not bypass the `InboxQueue` mutex — all queue ops must go through the class methods
- Do not add `dist/` build outputs to git — it's gitignored; CI builds from source
