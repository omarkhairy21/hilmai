# Repository Guidelines

## Project Structure & Module Organization

- `agent/` is the main workspace: `src/bot.ts` initializes the bot and registers handlers, `src/handlers/` contains modular command/callback/message handlers, `src/mastra/agents` defines behaviors, and `src/mastra/tools` contains Supabase/OpenAI integrations. Keep `supabase/schema.sql` and deployment docs (`DEPLOYMENT.md`, Docker assets) synced with runtime changes.
- `web/` hosts the Astro marketing site (`src/pages`, `src/components`, `src/content`); edit it only when copy or assets change.

### Handler Architecture (Modular Design)

- **DO NOT** add command/callback logic directly to `src/bot.ts`. Use the modular handler system in `src/handlers/`.
- Structure: `src/handlers/commands/`, `src/handlers/callbacks/`, `src/handlers/messages/`
- Each handler is a separate file exporting a registration function: `registerXxxHandler(bot, mastra)`
- Central registration happens in `src/handlers/index.ts` via `registerAllHandlers(bot, mastra)`
- Pattern: Extract `userId`, log events, use try-catch, import shared services/utils, reply with `messages.*` templates
- When adding new commands: create new file in `handlers/commands/`, register in `handlers/index.ts`
- When adding new callbacks: create new file in `handlers/callbacks/`, register in `handlers/index.ts`

## Build, Test, and Development Commands

- Daily loop: `cd agent && yarn dev` for hot-reload development with Mastra playground (opens port 4111).
- Release: only when deploying, run `yarn build && yarn start` plus `docker compose up` to mirror prod.

## Coding Style & Naming Conventions

- TypeScript + ES modules, 2-space indentation, camelCase for utilities, PascalCase for agents/tools. Keep Telegram middleware thin and push I/O into tool files.
- Use Pino logger helpers with `[module]` prefixes for grep-friendly output.
- Store secrets exclusively in `agent/.env`; mirror keys in `.env.example` and describe them in `agent/README.md`.

## Testing Guidelines

- Minimum manual coverage: run `yarn bot:dev`, send realistic finance messages (“Spent $45 at Trader Joe’s”), confirm Supabase inserts, and attach the log snippet to your PR.
- Add Vitest suites in `agent/src/__tests__/` for parsers, currency math, and database tools. Mock OpenAI, Supabase, and Telegram SDKs to keep tests deterministic.
- Before shipping Docker or deployment updates, run `yarn build`, `yarn start`, and `docker compose up` to verify env wiring.

## Commit & Pull Request Guidelines

- Keep commit subjects imperative and scoped (“Improve category fallback handling”), mirroring the existing log; separate bot runtime, infra, and marketing changes.
- PRs must include a short summary, testing proof (terminal logs or Telegram transcript), linked issue/roadmap item, and any migration/env updates. Screenshots are only required when `web/` changes.

## Pre-PR Checklist

- Run `yarn tsc --noEmit` for type safety; it’s faster than full builds.
- Format via `yarn format` (Prettier) before pushing.
- Skip `yarn build` unless you are packaging a release or touching deployment scripts.

## Security & Configuration Tips

- Never commit `.env`, Supabase credentials, Telegram tokens, Langfuse keys, or `mastra.db*` logs; scrub archives before sharing.
- Align Cloudflare, Wrangler, and Mastra configs so webhook URLs, Supabase URLs, and project names stay consistent. Rotate exposed keys immediately and update `.env.example` when new configuration is required.

## References

- Mastra agent/workflow patterns: `https://mastra.ai/llms-full.txt` (see agent networks section for how routing agents invoke workflows/tools). Consult this when wiring new workflows into agents so routing logic stays consistent with upstream best practices.
