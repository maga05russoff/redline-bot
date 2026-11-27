# RedLine Bot

Discord-first management bot for RedLine RolePlay. The first release establishes the bot runtime, command registration, PostgreSQL schema, and permission foundations.

## Requirements

- Node.js 20+
- PostgreSQL 15+
- Discord application and bot created in the Discord Developer Portal

## Setup

1. Copy `.env.example` to `.env`.
2. Fill in `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID`, `BOT_OWNER_ID`, and `DATABASE_URL`.
3. Install dependencies: `npm install`
4. Generate Prisma client: `npm run db:generate`
5. Apply database migrations: `npm run db:migrate`
6. Register commands in your test server: `npm run commands:deploy`
7. Start in development: `npm run dev`

Never send your bot token in chat, commit it to Git, or publish it in screenshots. If exposed, reset it in the Discord Developer Portal.

## Initial commands

- `/ping` — checks bot responsiveness.
- `/panel` — displays the RedLine Bot module menu.
- `/org list` — lists organizations currently stored in the database (owner/admin access foundation is being expanded).

## Architecture

- `src/bot`: Discord client, command handlers, events.
- `src/modules`: business domains (organizations, employees, documents, etc.).
- `src/security`: permission checks.
- `src/database`: Prisma client.
- `src/integrations/crmp`: future server-side CRMP adapter boundary.
- `prisma/schema.prisma`: relational data model.

## Important

The bot is not yet connected to a CRMP game server. That integration requires an approved API or server-side module supplied by the game server owner/developer. In-game documents and signatures must be clearly marked as roleplay-only and have no legal force.
