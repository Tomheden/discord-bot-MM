require("dotenv").config();

const { REST, Routes } = require("discord.js");
const config = require("./config");
const { loadCommands } = require("./handlers/loadCommands");

const guildId = process.env.GUILD_ID || "";
const target = (process.env.BOT_TARGET || "main").toLowerCase();
const targets = target === "all" ? ["main", "music"] : [target];

const targetConfigs = {
  main: {
    name: "main",
    token: config.client.token,
    id: config.client.id || process.env.CLIENT_ID,
    allowedCategories: null,
  },
  music: {
    name: "music",
    token: config.musicClient.token,
    id: config.musicClient.id || process.env.MUSIC_CLIENT_ID,
    allowedCategories: ["music"],
  },
};

const deployForTarget = async (targetName) => {
  const configForTarget = targetConfigs[targetName];
  if (!configForTarget) {
    console.error(`Unknown BOT_TARGET: ${targetName}`);
    process.exit(1);
  }

  const { token, id, allowedCategories, name } = configForTarget;
  if (!token || !id) {
    console.error(`Missing token or client id for ${name} bot.`);
    process.exit(1);
  }

  const rest = new REST({ version: "10" }).setToken(token);
  const { commandData } = loadCommands(null, { allowedCategories });

  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(id, guildId), {
      body: commandData,
    });
    console.log(
      `Deployed ${commandData.length} ${name} commands to guild ${guildId}.`
    );
    return;
  }

  await rest.put(Routes.applicationCommands(id), { body: commandData });
  console.log(`Deployed ${commandData.length} ${name} global commands.`);
};

const deploy = async () => {
  try {
    for (const targetName of targets) {
      await deployForTarget(targetName);
    }
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

deploy();
