# discord-bot-MM (rebuild)

Rebuild for Node 24 LTS with slash commands. Features included:

- Tickets (panel, create, close, transcript)
- Message delete/edit logs
- Announcements (publicar)
- Birthdays with daily cron + JSON storage
- Send embed + image commands
- Persistent user stats with MySQL or local JSON storage and internal REST API

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

Stats can run on MySQL (`STATS_STORAGE=mysql`) or fall back to `src/data/stats.json`.
For Wispbyte/MySQL, configure the database in `.env`:

```env
STATS_STORAGE=mysql
STATS_DB_HOST=your_mysql_host
STATS_DB_PORT=3306
STATS_DB_NAME=your_database
STATS_DB_USER=your_user
STATS_DB_PASSWORD=your_password
```

You can also use `DATABASE_URL=mysql://user:password@host:3306/database`.
Initialize tables without starting Discord:

```bash
npm run stats:init
```

To migrate the previous JSON aggregates into MySQL:

```bash
npm run stats:migrate-json
```

The stats service records metadata only:

- Messages per user, channel, day and hour.
- Voice joins, leaves, sessions, accumulated time and per-channel totals.
- Member join/leave dates when Discord emits those events.
- Slash command counts and last activity timestamps.
- Consecutive active-day streaks.
- Reactions given and received.
- Mentions received and replies sent.
- Server active members per day/week/month, peak hours and channel rankings.

Discord commands:

- `/stats usuario:@user` shows stats for a user.
- `/stats privado:true` sends the response only to you.
- `/rankings tipo:actividad periodo:semana limite:10` shows server rankings.
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
STATS_MEMBER_SYNC_ENABLED=1
STATS_MEMBER_SYNC_SCHEDULE=15 3 * * *
STATS_MEMBER_SYNC_RUN_ON_STARTUP=1
```

`STATS_REFRESH_SCHEDULE` uses cron syntax. The default refresh runs every 3 hours,
updates cached profile metadata for recently active users, stores refresh metadata,
and adds elapsed time for currently open voice sessions.
`STATS_MEMBER_SYNC_SCHEDULE` also uses cron syntax. It loads every non-bot guild
member into `stats.json` daily and also runs shortly after startup by default.

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
- `GET /api/users/:userId/stats`
- `GET /api/users/:userId/activity`
- `GET /api/users/:userId/history`
- `GET /api/users/:userId/link`
- `GET /api/minecraft/:minecraftId/stats`
- `GET /api/minecraft/:minecraftId/activity`
- `GET /api/minecraft/:minecraftId/history`
- `GET /api/minecraft/:minecraftId/link`
- `GET /api/rankings/messages`
- `GET /api/rankings/voice`
- `GET /api/rankings/activity?period=day|week|month|all&limit=100`
- `GET /api/rankings/commands`
- `GET /api/rankings/reactions`
- `GET /api/rankings/mentions`
- `GET /api/rankings/replies`
- `GET /api/rankings/channels?period=day|week|month|all&limit=10&visibility=public|private|all`
- `GET /api/guilds/:guildId/stats`
- `GET /api/guild/stats`

User, Minecraft and ranking endpoints also accept `?guildId=:guildId`. You can omit
it when `STATS_DEFAULT_GUILD_ID` is set or the stats storage contains one guild.
Ranking periods are calendar-based: `day` means today, `week` starts on Monday,
and `month` starts on the first day of the month.
Channel rankings include `channelId`, `channelName` and `channelType` after channel
metadata has been synced. They show public channels by default and exclude
`1051954336231587840`; add more excluded channel IDs with `STATS_EXCLUDED_CHANNEL_IDS`
as a comma-separated env var.

User and Minecraft endpoints return identity data once under `profile` and metrics under
`stats`, `activity` or `history`. Example:

```json
{
  "profile": {
    "guildId": "624320041139044367",
    "userId": "220270620439478272",
    "username": "tomheden",
    "joinedAt": null,
    "minecraft": {
      "username": "Tomheden",
      "uuid": "0ab6544b194347c4b2cf840a60bf09ce",
      "linkedAt": "2026-06-23T13:57:42.414Z"
    }
  },
  "stats": {
    "messages": 4,
    "voiceSeconds": 29205,
    "commands": 38,
    "rank": 3
  }
}
```

The API assumes one configured Discord guild. Set `GUILD_ID` or `STATS_DEFAULT_GUILD_ID`
in the environment so the API can resolve that guild before stats exist.
For Minecraft endpoints, `minecraftId` can be the linked Minecraft UUID or the linked username saved by `/link`.

## Config

Edit `src/config.js` to change channel/role IDs and cron schedule.

## Data

- `src/data/birthdays.json` stores birthdays.
- `src/data/tickets.json` stores ticket category per guild.
- `src/data/stats.json` stores generated stats locally when MySQL is disabled and should not be committed.
