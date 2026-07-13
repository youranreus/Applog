# AGENTS.md

## Cursor Cloud specific instructions

AppLog is a pnpm + turbo monorepo: `@applog/backend` (NestJS + Fastify + TypeORM/MySQL, port **4000**), `@applog/frontend` (Vue 3 + Vite, port **5173**), and `@applog/common` (shared TS lib built to `dist/`). Standard commands live in `CLAUDE.md`, root `package.json` scripts, and per-package `package.json` (`pnpm be`, `pnpm fe`, `pnpm dev`, `pnpm build`).

### Services / how to run
- **MySQL** must be running before the backend starts: `sudo service mysql start`. Local dev DB is `ware-house` with user `applog`/`applog` (created during setup; persists in the VM snapshot). TypeORM runs with `synchronize: true`, so tables are auto-created on backend boot — no migrations.
- **Backend**: `pnpm be` (nest watch). Listens on a **hardcoded** `4000` in `src/main.ts` — the `PORT` env var is ignored.
- **Frontend**: `pnpm fe` (vite). Talks to the backend via `VITE_API_BASE_URL`.
- The update script only installs deps + builds `@applog/common`; it does not start MySQL or the dev servers.

### Non-obvious env gotchas
- **Backend env**: the tracked `packages/backend/.env` has all values as empty strings (`MYSQL_SERVER=''`, etc.). Because an empty string is a *defined* value, `ConfigService.get(key, default)` returns `''` instead of the code default, so the DB connection breaks with a bare `.env`. Provide overrides via `packages/backend/.env.development.local` (highest non-production priority per `src/utils/const.ts` `ENV_LIST`). This file is intentionally **not committed** (git local-excluded). Minimum keys: `MYSQL_SERVER=127.0.0.1`, `MYSQL_PORT=3306`, `MYSQL_USER=applog`, `MYSQL_PASSWORD=applog`, `MYSQL_DATABASE=ware-house`, `TOKEN_SECRET=<any>`.
- **Frontend env**: the tracked `packages/frontend/.env` uses literal CI placeholders like `VITE_API_BASE_URL='${VITE_API_BASE_URL}'`. Override with `packages/frontend/.env.local` (gitignored via `*.local`) set to `VITE_API_BASE_URL='http://localhost:4000'`, otherwise API calls hit the literal placeholder string.

### Auth scope
- Login and all `@AuthRoles('admin' | 'user')` routes (create/edit posts, pages, dashboard) depend on an **external SSO provider** (`@reus-able/sso-utils`, `SSO_*` env). That provider is not available locally, so those flows can't be exercised without real SSO credentials.
- Public read routes (post/comment/page listing & detail) and **guest comment creation** (`POST /comment`) work without SSO. Guest comments write `authorId = ANONYMOUS_USER_ID` (default `1`), so a `users` row with that id must exist (FK constraint).

### Lint
- `pnpm --filter @applog/frontend run lint` and the backend `lint` script run with `--fix` (they rewrite files). To check without mutating, run the linters directly without `--fix`. `oxlint` currently reports pre-existing findings (unused imports/vars) unrelated to environment setup.
