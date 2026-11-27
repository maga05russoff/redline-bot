# RedLine Bot

Discord moderation and support bot for one Discord server.

## Requirements
- Node.js 20+
- PostgreSQL 15+
- Discord application and bot created in the Discord Developer Portal

## Setup
1. Copy `.env.example` to `.env`.
2. Configure `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID`, `BOT_OWNER_ID`, and `DATABASE_URL`.
3. Install dependencies: `npm install`.
4. Generate Prisma client: `npm run db:generate`.
5. Apply the schema with `npm run db:migrate` (review the generated migration before applying it).
6. Register commands: `npm run commands:deploy`.
7. Start: `npm run dev` or `npm run build && npm start`.

## Commands
- `/ping`, `/panel` — health check and command overview.
- `/warn`, `/warnings` — warnings and warning history.
- `/kick`, `/ban` — remove or ban a member.
- `/timeout`, `/untimeout` — communication timeout.
- `/ticket panel`, `/ticket close` — private support tickets.
- `/botconfig logs` — set moderation log channel.
- `/botconfig ticket-category` — set ticket category.
- `/botconfig support-role` — set support role.

## Discord permissions
Grant only the permissions the bot needs: View Channels, Send Messages, Embed Links, Read Message History, Manage Channels, Kick Members, Ban Members, Moderate Members, and View Audit Log if you later enable audit-log features. Place the bot's role above roles/members it must moderate. Discord role hierarchy still applies; the bot cannot bypass it.

Enable the **Server Members Intent** in Developer Portal → Bot → Privileged Gateway Intents because the bot fetches guild members for safe moderation hierarchy checks. Message Content intent is not currently required.

## Notes
- Moderation commands also check the acting member's Discord permission.
- The bot protects the server owner and prevents self-targeting.
- Existing roleplay database models are retained for data safety; the new Discord moderation models are added alongside them.
- Never share or commit your bot token or database connection string. If a token is exposed, reset it in the Developer Portal.