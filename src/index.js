require("dotenv").config();

const { Client, GatewayIntentBits, Partials } = require("discord.js");
const config = require("./config");
const { loadCommands } = require("./handlers/loadCommands");
const { loadComponents } = require("./handlers/loadComponents");
const { registerEvents } = require("./handlers/registerEvents");

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

loadCommands(client);
loadComponents(client);
registerEvents(client);

if (!config.client.token) {
  console.error("Missing CLIENT_TOKEN in environment.");
  process.exit(1);
}

client.login(config.client.token);
