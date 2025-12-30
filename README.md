# discord-bot-MM (rebuild)

Rebuild for Node 24 with slash commands. Features included:

- Tickets (panel, create, close, transcript)
- Message delete/edit logs
- Announcements (publicar)
- Birthdays with daily cron + JSON storage
- Send embed + image commands

## Requirements

- Node 24+

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

## Config

Edit `src/config.js` to change channel/role IDs and cron schedule.

## Data

- `src/data/birthdays.json` stores birthdays.
- `src/data/tickets.json` stores ticket category per guild.
