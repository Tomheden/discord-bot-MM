require("dotenv").config();

const { REST, Routes } = require("discord.js");
const config = require("../config");
const { StatsRepository } = require("../services/stats/statsRepository");
const {
  MySqlStatsRepository,
  shouldUseMySqlStats,
} = require("../services/stats/mysqlStatsRepository");

const token = config.client.token || process.env.CLIENT_TOKEN;
const guildId = process.env.STATS_DEFAULT_GUILD_ID || process.env.GUILD_ID;
const VIEW_CHANNEL_BIT = 1n << 10n;

const fetchAllMembers = async (rest, guildId) => {
  const members = [];
  let after = "0";

  while (true) {
    const page = await rest.get(Routes.guildMembers(guildId), {
      query: new URLSearchParams({
        limit: "1000",
        after,
      }),
    });

    if (!Array.isArray(page) || page.length === 0) {
      break;
    }

    members.push(...page);
    after = page[page.length - 1].user.id;

    if (page.length < 1000) {
      break;
    }
  }

  return members;
};

const syncChannels = async (repository, rest, guildId) => {
  if (!repository.syncGuildChannel) {
    return 0;
  }

  const channels = await rest.get(Routes.guildChannels(guildId));
  const now = new Date();
  let synced = 0;

  for (const channel of channels || []) {
    await repository.syncGuildChannel({
      guildId,
      channelId: channel.id,
      name: channel.name,
      type: channel.type,
      parentId: channel.parent_id,
      isPublic: isPublicRestChannel(channel, guildId),
      timestamp: now,
    });
    synced += 1;
  }

  return synced;
};

const isPublicRestChannel = (channel, guildId) => {
  const everyoneOverwrite = (channel.permission_overwrites || []).find(
    (overwrite) => overwrite.id === guildId
  );

  if (!everyoneOverwrite?.deny) {
    return true;
  }

  return (BigInt(everyoneOverwrite.deny) & VIEW_CHANNEL_BIT) === 0n;
};

const run = async () => {
  if (!token || !guildId) {
    console.error("Missing CLIENT_TOKEN and GUILD_ID or STATS_DEFAULT_GUILD_ID.");
    process.exit(1);
  }

  const rest = new REST({ version: "10" }).setToken(token);
  const repository = shouldUseMySqlStats(config.stats)
    ? new MySqlStatsRepository(config.stats?.database || {})
    : new StatsRepository({
        fileName: config.stats?.dataFile || process.env.STATS_DATA_FILE || "stats.json",
      });
  await repository.init();

  const syncedChannels = await syncChannels(repository, rest, guildId);
  const members = await fetchAllMembers(rest, guildId);
  const now = new Date();
  let synced = 0;

  for (const member of members) {
    if (member.user?.bot) {
      continue;
    }

    await repository.syncGuildMember({
      guildId,
      userId: member.user.id,
      username: member.user.username,
      joinedAt: member.joined_at,
      timestamp: now,
    });
    synced += 1;
  }

  await repository.recordMemberSyncRun({
    guildId,
    members: synced,
    timestamp: now,
  });
  await repository.save();
  if (repository.close) {
    await repository.close();
  }

  console.log(
    `[stats] Synced ${synced} guild members and ${syncedChannels} channels into stats storage.`
  );
};

run().catch((error) => {
  console.error("[stats] Member sync failed:", error);
  process.exit(1);
});
