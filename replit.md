# WUNO WhatsApp UNO Bot

Bot WhatsApp untuk bermain UNO yang menampilkan QR pairing dan status koneksi melalui halaman `/api`.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run db:generate` — generate the local WUNO Prisma client
- `pnpm --filter @workspace/api-server run db:push` — sync the local WUNO SQLite database
- Required runtime env: `DATABASE_URL` (defaults to `file:./data/wuno.db`) and `CHROME_PATH` (defaults to `/repl/tools/bin/chromium`)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM for the workspace API; WUNO uses a local SQLite database through Prisma
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/api-server/src/wuno` — WUNO source adapted from the upstream repository
- `artifacts/api-server/prisma/schema.prisma` — local WUNO SQLite schema
- `artifacts/api-server/src/routes/bot.ts` — pairing-code/status page and JSON status endpoint
- `artifacts/api-server/wuno-assets` — UNO card image assets

## Architecture decisions

- WUNO runs inside the existing API service so its QR page is available at `/api`.
- WUNO uses SQLite locally to keep first-time setup self-contained; no MySQL server is required.
- WhatsApp pairing state is stored by `LocalAuth` in the workspace and survives service restarts.

## Product

Users scan the live QR page with a WhatsApp account, then play UNO through bot commands using the `U#` prefix.

## User preferences

- User requested a ready-to-connect setup for the upstream WUNO WhatsApp UNO bot.

## Gotchas

- Use a dedicated WhatsApp number; the upstream project warns that WhatsApp may block automation accounts.
- Open `/api` to receive the WhatsApp pairing code. The status endpoint is `/api/bot-status`.
- The bot stores player phone numbers and usernames for game state, so the operator is responsible for deletion requests and privacy.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
