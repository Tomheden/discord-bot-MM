# discord-bot-MM (rebuild)

Rebuild for Node 24 LTS with slash commands. Features included:

- Tickets (panel, create, close, transcript)
- Message delete/edit logs
- Announcements (publicar)
- Birthdays with daily cron + JSON storage
- Send embed + image commands
- Persistent user stats with local JSON storage and internal REST API

## Requirements

- Node 24.17.0+ LTS

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file:

```env
CLIENT_TOKEN=your_bot_token
CLIENT_ID=your_app_id
# Optional for guild-only deploy
# GUILD_ID=your_guild_id
# GitHub token for transcript uploads
GITHUB_TOKEN=your_github_token
```

3. Deploy slash commands:

```bash
npm run deploy
```

4. Start the bot:

```bash
npm start
```

## Stats

The bot creates `src/data/stats.json` automatically on startup. You can also initialize or migrate it manually:

```bash
npm run stats:init
```

The stats service records metadata only:

- Messages per user, channel, day and hour.
- Voice joins, leaves, sessions, accumulated time and per-channel totals.
- Member join/leave dates when Discord emits those events.
- Slash command counts and last activity timestamps.

Discord commands:

- `/stats usuario:@user` shows stats for a user.
- `/stats privado:true` sends the response only to you.
- Right click a user and run `Apps > Ver stats` to open the profile context command.
- `/link minecraft usuario:Steve` links your Discord account to a Minecraft account.
- `/link ver` shows your current Minecraft link.
- `/link eliminar` removes your Minecraft link.

Writes are buffered in memory and flushed periodically. Configure it with:

```env
STATS_DATA_FILE=stats.json
STATS_FLUSH_INTERVAL_MS=30000
STATS_REFRESH_ENABLED=1
STATS_REFRESH_SCHEDULE=0 */3 * * *
STATS_REFRESH_ACTIVE_WINDOW_DAYS=30
```

`STATS_REFRESH_SCHEDULE` uses cron syntax. The default refresh runs every 3 hours,
updates cached profile metadata for recently active users, stores refresh metadata,
and adds elapsed time for currently open voice sessions.

## Stats API

The internal API uses Express. On Wisp it listens on `0.0.0.0:9793` by default and prints a public test URL on startup.

```env
STATS_API_ENABLED=1
STATS_API_HOST=0.0.0.0
STATS_API_PORT=9793
STATS_API_PUBLIC_URL=https://mundominecraft.wisp.uno
STATS_DEFAULT_GUILD_ID=your_guild_id
STATS_API_KEY=optional-secret
STATS_API_CORS_ORIGIN=https://mundominecraft.wisp.uno
STATS_RATE_LIMIT_WINDOW_MS=60000
STATS_RATE_LIMIT_MAX=120
```

If `STATS_API_KEY` is set, clients must send `x-api-key: <key>` or `Authorization: Bearer <key>`.
Set `STATS_API_CORS_ORIGIN` only when a browser app must call the API directly.

Endpoints:

- `GET /api/health`
- `GET /api/users/:userId/stats?guildId=:guildId`
- `GET /api/users/:userId/activity?guildId=:guildId`
- `GET /api/users/:userId/history?guildId=:guildId`
- `GET /api/users/:userId/link?guildId=:guildId`
- `GET /api/minecraft/:minecraftId/stats?guildId=:guildId`
- `GET /api/minecraft/:minecraftId/activity?guildId=:guildId`
- `GET /api/minecraft/:minecraftId/history?guildId=:guildId`
- `GET /api/minecraft/:minecraftId/link?guildId=:guildId`
- `GET /api/rankings/messages?guildId=:guildId`
- `GET /api/rankings/voice?guildId=:guildId`
- `GET /api/rankings/activity?guildId=:guildId&period=week|month|all`
- `GET /api/guilds/:guildId/stats`

User endpoints can omit `guildId` only when `STATS_DEFAULT_GUILD_ID` is set or the stats file contains one guild.
For Minecraft endpoints, `minecraftId` can be the linked Minecraft UUID or the linked username saved by `/link`.

## Config

Edit `src/config.js` to change channel/role IDs and cron schedule.

## Data

- `src/data/birthdays.json` stores birthdays.
- `src/data/tickets.json` stores ticket category per guild.
- `src/data/stats.json` stores generated stats locally and should not be committed.
