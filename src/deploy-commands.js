require("dotenv").config();

const { REST, Routes } = require("discord.js");
const config = require("./config");
const { loadCommands } = require("./handlers/loadCommands");

const guildId = process.env.GUILD_ID || "";

const deploy = async () => {
  const token = config.client.token;
  let id = config.client.id || process.env.CLIENT_ID;
  if (!token) {
    console.error("Missing CLIENT_TOKEN.");
    process.exit(1);
  }

  const rest = new REST({ version: "10" }).setToken(token);
  const { commandData } = loadCommands();

  if (!id) {
    const application = await rest.get(Routes.oauth2CurrentApplication());
    id = application.id;
  }

  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(id, guildId), {
      body: commandData,
    });
    console.log(`Deployed ${commandData.length} commands to guild ${guildId}.`);
    return;
  }

  await rest.put(Routes.applicationCommands(id), { body: commandData });
  console.log(`Deployed ${commandData.length} global commands.`);
};

deploy().catch((error) => {
  console.error(error);
  process.exit(1);
});
