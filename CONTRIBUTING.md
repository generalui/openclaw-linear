# Contributing

Thanks for your interest in contributing to openclaw-linear!

## Getting Started

1. Fork the repo and clone it locally
2. Install dependencies: `npm install`
3. Build: `npm run build`

## Making Changes

- Create a branch from `main`
- Keep changes focused — one fix or feature per PR
- Follow existing code style and conventions
- Add or update tests if applicable

## Submitting a Pull Request

1. Push your branch to your fork
2. Open a PR against `main`
3. Describe what you changed and why
4. Link any related issues

## Code Quality

This project enforces consistent code style and quality through automated tooling.
All checks run automatically in CI on pull requests to `main`.

- **[Linting and Formatting](documentation/LINTING.md)** — ESLint, Prettier, and markdownlint rules,
  configuration, and how to run them locally.
- **[Testing](documentation/TESTING.md)** — Test structure, how to run tests, and guidelines for
  writing new ones.

To run all checks locally:

```bash
npm run lint        # ESLint + markdownlint
npm run format:check  # Prettier
npm test            # Vitest
```

## Reporting Bugs

Use the [bug report template](https://github.com/nichochar/openclaw-linear/issues/new?template=bug_report.md) and include steps to reproduce.

## Suggesting Features

Open an issue using the [feature request template](https://github.com/nichochar/openclaw-linear/issues/new?template=feature_request.md).

## Code of Conduct

Be kind and constructive. Treat others with respect.
