# Repository Guidelines

## Project Structure & Module Organization
Source lives under `src/`, grouped by concern: `actions/` for workflow handlers, `integrations/` for third-party clients, `services/` for core business logic, plus `routes/`, `middleware/`, and `utils/`. Shared scripts and one-off jobs belong in `scripts/`, API docs in `docs/`, and compiled output in `dist/` (avoid editing generated files). Tests sit in `tests/` for integration coverage, with colocated unit specs in `src/**/*.test.ts` and end-to-end suites under `e2e-tests/tests/`.

## Build, Test, and Development Commands
Install dependencies with `npm install`. Run the hot-reloading server via `npm run dev`; use `npm run start` for the production entry-point. Compile TypeScript with `npm run build` (emits to `dist/`), or dry-run type checks using `npm run build:check`. Execute the Jest suite with `npm test`. For linting and auto-fixes, run `npm run lint` (safe to stage only the intentional changes afterward).

## Coding Style & Naming Conventions
TypeScript is the default language. Prettier enforces two-space indentation, trailing semicolons, and single quotes (`.prettierrc`). ESLint extends `@typescript-eslint` and Prettier; fix warnings before pushing. Prefer PascalCase for classes, camelCase for functions and variables, and SCREAMING_SNAKE_CASE for constants. Module filenames should stay kebab-case (`task-service.ts`) to match existing patterns. Use async/await for asynchronous flows and keep controller methods thin, delegating to services.

## Testing Guidelines
We run Jest with `ts-jest` and `babel-jest`, targeting Node (`jest.config.js`). Name specs `*.test.ts` and place them alongside the code or under `tests/` when exercising multiple modules. `npm test` writes coverage reports to `coverage/`; aim to maintain or improve module coverage when touching critical services. When adding database-heavy tests, prefer in-memory Mongo setups as shown in existing specs.

## Commit & Pull Request Guidelines
Commit messages follow the conventional prefix used in history (`feat:`, `refactor:`, `fix:`). Keep subjects imperative and under 72 characters, elaborating in the body when needed. Before opening a PR, ensure lint, build, and tests succeed locally, update docs for API changes, and link relevant GitHub issues. Include screenshots or sample payloads when modifying external integrations to aid reviewers.

## Environment & Configuration Tips
Copy `.env.example` to `.env` and fill provider keys before local runs; never commit secrets. The app expects Node.js 18+, access to MongoDB, and any third-party API keys referenced in `scripts/` and `integrations/`. Use `nodemon.json` for tweaking local reload behavior without altering production settings.
