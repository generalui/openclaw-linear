# Testing

## Requirements

- [Vitest](https://vitest.dev) — the test runner used by this project.
  - Installed automatically via `npm install`.
  - No additional setup is required.

## Test Structure

Test files live in the [`test/`](../test/) directory and mirror the structure of `src/`:

- **Unit tests** for core logic: `test/event-router.test.ts`, `test/work-queue.test.ts`, `test/webhook-handler.test.ts`
- **Unit tests** for individual tools: `test/tools/linear-*-tool.test.ts`, `test/tools/queue-tool.test.ts`
- **Integration-style tests** for message formatting: `test/format-consolidated-message.test.ts`
- **API resolver tests**: `test/linear-api.test.ts`

### Naming conventions

- Test files must end with `.test.ts`
- `describe` blocks should group related behaviour
- `it` descriptions should read as plain English sentences

## Running Tests

### All tests

```bash
npm test
```

### With coverage report

```bash
npm run test:coverage
```

### Watch mode (re-runs on file changes)

```bash
npx vitest
```

### A specific file

```bash
npx vitest run test/event-router.test.ts
```

## Writing Tests

- Mock the Linear GraphQL API via `vi.mock('../../src/linear-api.js', ...)` — do not make real API calls in unit tests.
- Use `beforeEach(() => vi.clearAllMocks())` to reset mocks between tests.
- For queue tests, write to a temporary directory and clean up in `afterEach`.
- Test files in `test/` have relaxed ESLint rules (`no-explicit-any` and `no-unsafe-*` are disabled)
  to accommodate vitest's `vi.fn()` typing.

## Continuous Integration

Tests are automatically run in CI/CD via the
[`.github/workflows/code-quality.yml`](../.github/workflows/code-quality.yml)
workflow on pull requests to `main`.
