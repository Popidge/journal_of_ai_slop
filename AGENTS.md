# AGENTS.md

Project guidance for agentic coding assistants in this repository.

## Project Snapshot

- Stack: Astro (with React integration), TypeScript, Tailwind CSS 4, Convex backend.
- Package manager: pnpm (`pnpm-lock.yaml` is present).
- Frontend code: `src/`.
- Backend code: `convex/`.
- Generated Convex files: `convex/_generated/` (never edit manually).
- TS path alias: `@/*` -> `src/*`.

## Setup

- Install deps: `pnpm install`
- Run full dev (frontend + backend): `pnpm run dev`
- Frontend only: `pnpm run dev:frontend`
- Backend only: `pnpm run dev:backend`
- Production preview: `pnpm run preview`

## Environment Variables

Expected values used by app/runtime:

- `PUBLIC_CONVEX_URL`
- `OPENROUTER_API_KEY`
- `CONTENT_SAFETY_ENDPOINT`
- `CONTENT_SAFETY_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM`
- `SITE_URL`
  Optional toggles:
- `CONTENT_SAFETY_TEST`
- `SLOPBOT_DEBUG_MODE`

## Build, Lint, and Test

### Build

- `pnpm run build`
- This runs the `build` script from `package.json`, currently `astro build`.

### Lint / Typecheck

- `pnpm run lint`
- This runs `tsc` and `eslint . --ext ts,tsx --max-warnings 0`.

### Current Test State

- No `test` script exists in `package.json`.
- No committed `*.test.*` / `*.spec.*` files were found.
- Current quality gate is effectively `pnpm run lint`.

### Running One Test (Important)

- Currently unavailable (no test runner configured yet).
- If Vitest gets added:
  - Single file: `pnpm vitest run path/to/file.test.ts`
  - Single test by name: `pnpm vitest run path/to/file.test.ts -t "name"`
- If Jest gets added:
  - Single file: `pnpm jest path/to/file.test.ts`
  - Single test by name: `pnpm jest path/to/file.test.ts -t "name"`

### Convex Operations

- Start backend runtime: `pnpm run dev:backend`
- Run migration example used in repo: `npx convex action call internal.migrations.ecoModeMigration`
- Deploy backend: `npx convex deploy`

## Formatting and General Style

- Use TypeScript for new code unless a file clearly requires JS.
- 2-space indentation.
- Double quotes.
- Semicolons on statements.
- Keep ESM imports/exports.
- Preserve existing file style; avoid reformat-only diffs.
- `.prettierrc` is `{}` (default Prettier behavior).

## ESLint and Static Analysis Rules

Configured in `eslint.config.js`:

- Lint scope is `**/*.{ts,tsx}`.
- React hooks rules are enabled.
- `react-refresh/only-export-components` is warning-level.
- `@typescript-eslint/no-unused-vars` is warning-level; `_`-prefixed vars/args are ignored.
- `@typescript-eslint/ban-ts-comment` is error-level.
- Explicit `any` is currently allowed by config.
- `no-unsafe-*` TS rules are intentionally relaxed.

## Type Safety Conventions

- TS `strict` is enabled in app/node/convex configs.
- `noUnusedLocals`, `noUnusedParameters`, and `noFallthroughCasesInSwitch` are enabled.
- Prefer narrowing unknown/nullable values before use.
- Prefer explicit types for exported helpers when inference is unclear.
- Use generated Convex id types (`Id<"table">`) for document IDs.

## Imports and Module Boundaries

- Preferred import order:
  1. third-party packages
  2. generated Convex API/types
  3. local modules
- Use `import type` for type-only imports when practical.
- Frontend-internal imports should prefer `@/` alias.
- Do not manually edit `convex/_generated/*`.

## Naming Conventions

- React components: PascalCase (`SubmitPaper`, `PaperDetail`).
- Hooks: `useX` camelCase (`useEcoMode`).
- Functions/variables: camelCase.
- Constants: UPPER_SNAKE_CASE when genuinely constant.
- Keep Convex function names descriptive and action-oriented.

## Error Handling

- Validate early at boundaries (forms, HTTP handlers, Convex actions/mutations).
- Use `try/catch` around external I/O and integration calls.
- Prefer fail-closed handling for moderation/safety-sensitive paths.
- Return safe, user-readable messages for expected failures.
- Log structured context (`paperId`, model, status) and never log secrets.

## React/UI Practices

- Use functional components and hooks.
- Keep state local first; lift to context only when truly shared.
- Maintain accessibility basics (labels, semantic elements, sensible `aria-*`).
- Preserve established visual system and CSS variable usage.
- Avoid introducing unrelated UI frameworks or architecture shifts.

## Convex Practices

- Use `query`, `mutation`, `action`, `internalQuery`, `internalMutation`, `internalAction` from `./_generated/server`.
- Always provide Convex `args` and `returns` validators.
- Use `v.null()` for functions that return null.
- Keep schema changes centralized in `convex/schema.ts`.
- Prefer indexed lookups (`withIndex`) instead of broad scans/filter logic.
- Use `ctx.runQuery` / `ctx.runMutation` / `ctx.runAction` with function refs.
- Do not use `ctx.db` inside Convex actions.
- Files with Node runtime actions should start with `"use node"`.

## Cursor Rules Incorporated

Found rule source: `.cursor/rules/convex_rules.mdc`.
Apply these when editing Convex code:

- Use the new object-style Convex function declarations.
- Include validators for all args and returns.
- Register HTTP endpoints in `convex/http.ts` with `httpAction`.
- Use correct public vs internal function registration.
- Favor schema indexes and `withIndex` over query-time filters.
- Use typed `Id` values and strict typing for records/arrays.
- Use `crons.interval` or `crons.cron` for scheduling.
- Reference cron/internal targets via `internal.*` function refs.
- Use system-table metadata access patterns for storage metadata.

## Copilot Rules Status

- `.github/copilot-instructions.md` is not present.
- No repository-level Copilot instruction file was found.

## Safe Change Checklist

- Keep changes scoped to the requested task.
- Do not commit secrets (`.env*`, API keys, credentials).
- Do not edit generated files unless regeneration is explicitly intended.
- Prefer additive/refactoring-safe edits over broad rewrites.
- If tests are introduced later, add `test` scripts and update single-test commands here.
