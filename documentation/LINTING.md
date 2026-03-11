# Linting and Formatting

## Requirements

- [ESLint](https://eslint.org) with TypeScript support

  - Installed automatically via `npm install`.
  - Uses [`typescript-eslint`](https://typescript-eslint.io) with `recommendedTypeChecked` rules.
  - Run manually from the command line:

    ```bash
    npm run lint:project
    ```

  - For VS Code / Cursor, install the
    [ESLint extension](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)
    (`dbaeumer.vscode-eslint`) for inline feedback on save.

- [Prettier](https://prettier.io)

  - Installed automatically via `npm install`.
  - Formats TypeScript and JSON files. Markdown and YAML are excluded.
  - Check formatting:

    ```bash
    npm run format:check
    ```

  - Auto-fix formatting:

    ```bash
    npm run format
    ```

  - For VS Code / Cursor, install the
    [Prettier extension](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)
    (`esbenp.prettier-vscode`) and enable **Format on Save**.

- [markdownlint-cli2](https://github.com/DavidAnson/markdownlint-cli2)

  - `markdownlint-cli2` is included in the [`.tool-versions`](../.tool-versions) file.
    Install via [asdf](https://asdf-vm.com):

    ```bash
    asdf plugin add markdownlint-cli2 https://github.com/paulo-ferraz-oliveira/asdf-markdownlint-cli2
    asdf install
    ```

  - Run manually from the command line:

    ```bash
    npm run lint:markdown
    ```

  - For VS Code / Cursor, install the
    [markdownlint extension](https://marketplace.visualstudio.com/items?itemName=DavidAnson.vscode-markdownlint)
    (`DavidAnson.vscode-markdownlint`) for inline feedback on save.

## Running All Linters

```bash
npm run lint
```

This runs ESLint and markdownlint in parallel. Prettier is checked separately via `npm run format:check`.

In CI, all three run together as the `lint` step of the code-quality workflow.

## Configuration

| Tool | Config file |
|------|-------------|
| ESLint | [`eslint.config.mjs`](../eslint.config.mjs) |
| Prettier | [`.prettierrc`](../.prettierrc) / [`.prettierignore`](../.prettierignore) |
| markdownlint | [`.markdownlint-cli2.jsonc`](../.markdownlint-cli2.jsonc) |

## Continuous Integration

Linting is automatically run in CI/CD via the
[`.github/workflows/code-quality.yml`](../.github/workflows/code-quality.yml)
workflow on pull requests to `main`.
