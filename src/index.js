require("dotenv").config();

const { Client, GatewayIntentBits, Partials, Events } = require("discord.js");
const config = require("./config");
const { loadCommands } = require("./handlers/loadCommands");
const { loadComponents } = require("./handlers/loadComponents");
const { registerEvents } = require("./handlers/registerEvents");
const { startStatsApi } = require("./api/statsApi");
const { createStatsService } = require("./services/stats/statsService");

const createClient = ({ token, allowedEvents, statsService }) => {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMessageReactions,
    ],
    partials: [Partials.Channel, Partials.Message, Partials.Reaction, Partials.User],
  });

  client.config = config;
  client.stats = statsService || null;

  loadCommands(client);
  loadComponents(client);
  registerEvents(client, { allowedEvents });

  if (!token) {
    console.error("Missing CLIENT_TOKEN in environment.");
    return null;
  }

  client.login(token);
  return client;
};

const main = async () => {
  if (!config.client.token) {
    console.error("Missing CLIENT_TOKEN in environment.");
    process.exit(1);
  }

  const statsService = createStatsService(config);
  await statsService.init();
  const statsApiServer = startStatsApi(statsService.repository, config.stats?.api || {});

  const shutdown = async () => {
    await statsService.shutdown();

    if (statsApiServer) {
      statsApiServer.close(() => process.exit(0));
      return;
    }

    process.exit(0);
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  createClient({
    token: config.client.token,
    allowedEvents: [
      Events.InteractionCreate,
      Events.MessageCreate,
      Events.MessageDelete,
      Events.MessageUpdate,
      Events.MessageReactionAdd,
      Events.VoiceStateUpdate,
      Events.GuildMemberAdd,
      Events.GuildMemberRemove,
      Events.ClientReady,
    ],
    statsService,
  });
};

main().catch((error) => {
  console.error("[startup] Failed to start bot:", error);
  process.exit(1);
});
