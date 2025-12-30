require("dotenv").config();

const { REST, Routes } = require("discord.js");
const config = require("./config");
const { loadCommands } = require("./handlers/loadCommands");

const token = config.client.token;
const clientId = config.client.id || process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID || "";

if (!token || !clientId) {
  console.error("Missing CLIENT_TOKEN or CLIENT_ID in environment.");
  process.exit(1);
}

const rest = new REST({ version: "10" }).setToken(token);
const { commandData } = loadCommands();

const deploy = async () => {
  try {
    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
        body: commandData,
      });
      console.log(`Deployed ${commandData.length} commands to guild ${guildId}.`);
      return;
    }

    await rest.put(Routes.applicationCommands(clientId), { body: commandData });
    console.log(`Deployed ${commandData.length} global commands.`);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

deploy();
