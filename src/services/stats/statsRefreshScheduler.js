const cron = require("node-cron");

const DEFAULT_SCHEDULE = "0 */3 * * *";
const DEFAULT_ACTIVE_WINDOW_DAYS = 30;

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

const isRecentlyActive = (user, cutoffMs) => {
  if (!user?.last_activity_at) {
    return false;
  }

  return new Date(user.last_activity_at).getTime() >= cutoffMs;
};

const refreshGuildStats = async (client, guild, options) => {
  const now = new Date();
  const cutoffMs = now.getTime() - options.activeWindowDays * 86400000;
  const knownUsers = Object.values(client.stats.repository.data.users).filter(
    (user) => user.guild_id === guild.id && isRecentlyActive(user, cutoffMs)
  );
  const activeUserIds = new Set(knownUsers.map((user) => user.user_id));

  for (const active of Object.values(client.stats.repository.data.active_voice_sessions)) {
    if (active.guild_id === guild.id) {
      activeUserIds.add(active.user_id);
    }
  }

  for (const userId of activeUserIds) {
    const member =
      guild.members.cache.get(userId) ||
      (await guild.members.fetch(userId).catch(() => null));

    if (!member || member.user?.bot) {
      continue;
    }

    client.stats.repository.recordPresenceSnapshot({
      guildId: guild.id,
      userId: member.id,
      username: member.user.username,
      joinedAt: member.joinedAt,
      timestamp: now,
    });
  }

  client.stats.repository.recordRefreshRun({
    guildId: guild.id,
    activeUsers: activeUserIds.size,
    timestamp: now,
  });

  return activeUserIds.size;
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
      client.stats.flush();
      client.stats.repository.refreshOpenVoiceSessions(new Date());

      let refreshedUsers = 0;
      for (const guild of client.guilds.cache.values()) {
        refreshedUsers += await refreshGuildStats(client, guild, options);
      }

      client.stats.repository.save();
      console.log(
        `[stats] Refresh complete. Active users refreshed: ${refreshedUsers}.`
      );
    } catch (error) {
      console.error("[stats] Refresh failed:", error);
    }
  });

  console.log(`[stats] Refresh cron registered: ${options.schedule}`);
};

module.exports = {
  registerStatsRefreshCron,
};
