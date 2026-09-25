# ESLint setup

Resolves finding #3 in [architecture-review.md](./architecture-review.md): `npm run lint` could not work.

## The problem

- `package.json` had a `lint` script (`eslint "{src,test}/**/*.ts" --fix`) and `eslint@^9` installed, but **no config file**.
- ESLint 9 only reads flat config (`eslint.config.*`), so the command errored out.
- Nothing could parse TypeScript: `typescript-eslint` and `@eslint/js` were not installed.
- The script always passed `--fix`, so a command named `lint` silently rewrote files.

## What changed

| File | Change |
|---|---|
| `eslint.config.mjs` (new) | Flat config: `@eslint/js` recommended + `typescript-eslint` recommended. Ignores `dist/`, `node_modules/`, `coverage/`, `graphify-out/`. |
| `package.json` devDependencies | Added `@eslint/js` (^9.35.0) and `typescript-eslint` (^8.43.0). |
| `package.json` scripts | `lint` now only checks. New `lint:fix` applies auto-fixes. |
| `package-lock.json` | Updated by `npm install`. |

## Why these choices

- **Flat config (`eslint.config.mjs`)**: the only format ESLint 9 supports. `.mjs` avoids depending on the package's module type.
- **`typescript-eslint` recommended (not type-checked)**: catches common TS mistakes without needing a `tsconfig` project and without slow type-aware linting. `projectService` is off deliberately; enable it later if type-aware rules are wanted.
- **Split `lint` / `lint:fix`**: a check command should never mutate files, so CI and pre-commit can run `lint` safely.
- **Ignoring build output**: linting generated `dist/` code is noise.

## Usage

```bash
npm run lint       # check only; non-zero exit on problems
npm run lint:fix   # apply auto-fixable changes
```

`npm run lint` passes cleanly on the current code.

## Not done (possible follow-ups)

- Prettier and `eslint-config-prettier` for formatting.
- Type-aware rules (`recommendedTypeChecked`) with `projectService: true`.
- Running `npm run lint` in CI and/or a pre-commit hook (husky + lint-staged).
