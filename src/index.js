require("dotenv").config();

const { Client, GatewayIntentBits, Partials, Events } = require("discord.js");
const config = require("./config");
const { loadCommands } = require("./handlers/loadCommands");
const { loadComponents } = require("./handlers/loadComponents");
const { registerEvents } = require("./handlers/registerEvents");

const createClient = ({ name, token, allowedCategories, allowedEvents }) => {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildVoiceStates,
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User],
  });

  client.config = config;
  client.mode = name;

  loadCommands(client, { allowedCategories });
  loadComponents(client);
  registerEvents(client, { allowedEvents });

  if (!token) {
    console.error(`Missing ${name.toUpperCase()} token in environment.`);
    return null;
  }

  client.login(token);
  return client;
};

if (!config.client.token) {
  console.error("Missing CLIENT_TOKEN in environment.");
  process.exit(1);
}

createClient({
  name: "main",
  token: config.client.token,
  allowedCategories: null,
  allowedEvents: [
    Events.InteractionCreate,
    Events.MessageDelete,
    Events.MessageUpdate,
    Events.ClientReady,
  ],
});

if (config.musicClient?.token) {
  createClient({
    name: "music",
    token: config.musicClient.token,
    allowedCategories: ["music"],
    allowedEvents: [Events.InteractionCreate, Events.ClientReady],
  });
} else {
  console.warn("MUSIC_TOKEN not set; music bot disabled.");
}
