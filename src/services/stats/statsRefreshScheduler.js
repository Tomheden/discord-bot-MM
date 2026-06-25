const cron = require("node-cron");

const DEFAULT_SCHEDULE = "0 */3 * * *";
const DEFAULT_ACTIVE_WINDOW_DAYS = 30;
const DEFAULT_MEMBER_SYNC_SCHEDULE = "15 3 * * *";

const parsePositiveInteger = (value, fallback) => {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const getRefreshConfig = (config = {}) => {
  const statsConfig = config.stats || {};
  const refreshConfig = statsConfig.refresh || {};

  return {
    enabled:
      refreshConfig.enabled !== undefined
        ? refreshConfig.enabled
        : process.env.STATS_REFRESH_ENABLED !== "0",
    schedule:
      refreshConfig.schedule || process.env.STATS_REFRESH_SCHEDULE || DEFAULT_SCHEDULE,
    activeWindowDays: parsePositiveInteger(
      refreshConfig.activeWindowDays || process.env.STATS_REFRESH_ACTIVE_WINDOW_DAYS,
      DEFAULT_ACTIVE_WINDOW_DAYS
    ),
  };
};

const getMemberSyncConfig = (config = {}) => {
  const statsConfig = config.stats || {};
  const memberSyncConfig = statsConfig.memberSync || {};

  return {
    enabled:
      memberSyncConfig.enabled !== undefined
        ? memberSyncConfig.enabled
        : process.env.STATS_MEMBER_SYNC_ENABLED !== "0",
    schedule:
      memberSyncConfig.schedule ||
      process.env.STATS_MEMBER_SYNC_SCHEDULE ||
      DEFAULT_MEMBER_SYNC_SCHEDULE,
    runOnStartup:
      memberSyncConfig.runOnStartup !== undefined
        ? memberSyncConfig.runOnStartup
        : process.env.STATS_MEMBER_SYNC_RUN_ON_STARTUP !== "0",
  };
};

const isRecentlyActive = (user, cutoffMs) => {
  if (!user?.last_activity_at) {
    return false;
  }

  return new Date(user.last_activity_at).getTime() >= cutoffMs;
};

const refreshGuildStats = async (client, guild, options) => {
  const now = new Date();
  const cutoffMs = now.getTime() - options.activeWindowDays * 86400000;
  let knownUserIds = [];
  let voiceUserIds = [];

  if (client.stats.repository.getRecentlyActiveUserIds) {
    knownUserIds = await client.stats.repository.getRecentlyActiveUserIds(
      guild.id,
      options.activeWindowDays
    );
    voiceUserIds = await client.stats.repository.getActiveVoiceUserIds(guild.id);
  } else {
    const knownUsers = Object.values(client.stats.repository.data.users).filter(
      (user) => user.guild_id === guild.id && isRecentlyActive(user, cutoffMs)
    );
    knownUserIds = knownUsers.map((user) => user.user_id);

    for (const active of Object.values(client.stats.repository.data.active_voice_sessions)) {
      if (active.guild_id === guild.id) {
        voiceUserIds.push(active.user_id);
      }
    }
  }

  const activeUserIds = new Set([...knownUserIds, ...voiceUserIds]);

  for (const userId of activeUserIds) {
    const member =
      guild.members.cache.get(userId) ||
      (await guild.members.fetch(userId).catch(() => null));

    if (!member || member.user?.bot) {
      continue;
    }

    await client.stats.repository.recordPresenceSnapshot({
      guildId: guild.id,
      userId: member.id,
      username: member.user.username,
      joinedAt: member.joinedAt,
      timestamp: now,
    });
  }

  await client.stats.repository.recordRefreshRun({
    guildId: guild.id,
    activeUsers: activeUserIds.size,
    timestamp: now,
  });

  return activeUserIds.size;
};

const syncGuildMembers = async (client, guild) => {
  const now = new Date();
  const members = await guild.members.fetch();
  let synced = 0;

  for (const member of members.values()) {
    if (member.user?.bot) {
      continue;
    }

    await client.stats.repository.syncGuildMember({
      guildId: guild.id,
      userId: member.id,
      username: member.user.username,
      joinedAt: member.joinedAt,
      timestamp: now,
    });
    synced += 1;
  }

  await client.stats.repository.recordMemberSyncRun({
    guildId: guild.id,
    members: synced,
    timestamp: now,
  });

  return synced;
};

const syncAllGuildMembers = async (client) => {
  let synced = 0;

  for (const guild of client.guilds.cache.values()) {
    synced += await syncGuildMembers(client, guild);
  }

  await client.stats.repository.save();
  console.log(`[stats] Member sync complete. Members synced: ${synced}.`);
};

const registerStatsRefreshCron = (client) => {
  if (!client.stats || client.statsRefreshTask) {
    return;
  }

  const options = getRefreshConfig(client.config);
  if (!options.enabled) {
    return;
  }

  client.statsRefreshTask = cron.schedule(options.schedule, async () => {
    try {
      await client.stats.flush();
      await client.stats.repository.refreshOpenVoiceSessions(new Date());

      let refreshedUsers = 0;
      for (const guild of client.guilds.cache.values()) {
        refreshedUsers += await refreshGuildStats(client, guild, options);
      }

      await client.stats.repository.save();
      console.log(
        `[stats] Refresh complete. Active users refreshed: ${refreshedUsers}.`
      );
    } catch (error) {
      console.error("[stats] Refresh failed:", error);
    }
  });

  console.log(`[stats] Refresh cron registered: ${options.schedule}`);
};

const registerStatsMemberSyncCron = (client) => {
  if (!client.stats || client.statsMemberSyncTask) {
    return;
  }

  const options = getMemberSyncConfig(client.config);
  if (!options.enabled) {
    return;
  }

  const runSync = async () => {
    try {
      await client.stats.flush();
      await syncAllGuildMembers(client);
    } catch (error) {
      console.error("[stats] Member sync failed:", error);
    }
  };

  client.statsMemberSyncTask = cron.schedule(options.schedule, runSync);
  console.log(`[stats] Member sync cron registered: ${options.schedule}`);

  if (options.runOnStartup) {
    setTimeout(runSync, 5000);
  }
};

module.exports = {
  registerStatsMemberSyncCron,
  registerStatsRefreshCron,
  syncAllGuildMembers,
};
