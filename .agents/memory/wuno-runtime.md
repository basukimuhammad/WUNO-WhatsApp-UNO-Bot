---
name: WUNO runtime constraints
description: Non-obvious runtime constraints when adapting the upstream WUNO WhatsApp bot to the Replit service bundle.
---

The upstream WUNO code assumes source directories are present at runtime. When bundled into the API service, controller discovery must use static imports, and service environment variables must be declared in the artifact's shared service environment so Prisma and Chromium see them before startup.

**Why:** The first bundled runs failed because dynamic directory scanning looked for compiled controller folders and Prisma started without the service database URL.

**How to apply:** Preserve the static controller registry and keep `DATABASE_URL` plus `CHROME_PATH` in the managed service environment when changing the bot runtime.

WhatsApp Web can identify direct messages with `@lid` instead of `@c.us`; group messages continue to use `@g.us`.

**Why:** The upstream DM guard rejected valid private commands after the account was linked through the phone-number pairing flow.

**How to apply:** Treat `@lid` as a direct chat when checking whether a command may run in DM-only mode.