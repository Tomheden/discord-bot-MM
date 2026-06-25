const fs = require("fs");
const path = require("path");
const { getDataPath } = require("../../utils/storage");

// File-backed repository: owns the versioned stats schema and all read/write queries.
const CURRENT_VERSION = 4;
const DEFAULT_FILE_NAME = "stats.json";

const makeKey = (...parts) => parts.map((part) => String(part)).join(":");

const emptyStatsData = () => {
  const now = new Date().toISOString();

  return {
    version: CURRENT_VERSION,
    meta: {
      created_at: now,
      updated_at: now,
    },
    migrations: [],
    users: {},
    message_stats: {},
    message_channel_stats: {},
    voice_stats: {},
    voice_channel_stats: {},
    active_voice_sessions: {},
    daily_activity: {},
    hourly_activity: {},
    voice_sessions: [],
    minecraft_links: {},
    refresh_runs: [],
    member_sync_runs: [],
  };
};

const isSnowflake = (value) =>
  typeof value === "string" && /^\d{5,25}$/.test(value);

const toIsoString = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }

  return date.toISOString();
};

const getDateKey = (value = new Date()) => toIsoString(value).slice(0, 10);

const getHourKey = (value = new Date()) => {
  const date = new Date(toIsoString(value));

  return String(date.getUTCHours()).padStart(2, "0");
};

const daysBetweenInclusive = (fromIso, toIso) => {
  if (!fromIso || !toIso) {
    return 0;
  }

  const from = new Date(fromIso.slice(0, 10));
  const to = new Date(toIso.slice(0, 10));
  const ms = to.getTime() - from.getTime();

  if (Number.isNaN(ms) || ms < 0) {
    return 0;
  }

  return Math.floor(ms / 86400000) + 1;
};

const normalizeData = (input) => {
  const data = input && typeof input === "object" ? input : emptyStatsData();
  const base = emptyStatsData();

  for (const key of Object.keys(base)) {
    if (data[key] === undefined) {
      data[key] = base[key];
    }
  }

  if (!Number.isInteger(data.version)) {
    data.version = 0;
  }

  if (data.version < 1) {
    data.migrations.push({
      version: 1,
      applied_at: new Date().toISOString(),
      description: "Initial stats file schema",
    });
    data.version = 1;
  }

  if (data.version < 2) {
    data.minecraft_links = data.minecraft_links || {};
    data.migrations.push({
      version: 2,
      applied_at: new Date().toISOString(),
      description: "Add Discord to Minecraft account links",
    });
    data.version = 2;
  }

  if (data.version < 3) {
    data.refresh_runs = data.refresh_runs || [];
    data.migrations.push({
      version: 3,
      applied_at: new Date().toISOString(),
      description: "Add scheduled stats refresh metadata",
    });
    data.version = 3;
  }

  if (data.version < 4) {
    data.member_sync_runs = data.member_sync_runs || [];
    data.migrations.push({
      version: 4,
      applied_at: new Date().toISOString(),
      description: "Add full guild member sync metadata",
    });
    data.version = 4;
  }

  data.meta.updated_at = new Date().toISOString();
  return data;
};

class StatsRepository {
  constructor(options = {}) {
    this.fileName = options.fileName || DEFAULT_FILE_NAME;
    this.filePath = getDataPath(this.fileName);
    this.data = null;
  }

  init() {
    this.data = this.load();
    this.save();
  }

  load() {
    if (!fs.existsSync(this.filePath)) {
      return emptyStatsData();
    }

    try {
      const raw = fs.readFileSync(this.filePath, "utf8");
      return normalizeData(JSON.parse(raw));
    } catch (error) {
      console.error(`[stats] Could not read ${this.fileName}:`, error);
      return emptyStatsData();
    }
  }

  save() {
    if (!this.data) {
      return;
    }

    this.data.meta.updated_at = new Date().toISOString();
    const tmpPath = path.join(
      path.dirname(this.filePath),
      `${path.basename(this.filePath)}.${process.pid}.tmp`
    );

    fs.writeFileSync(tmpPath, JSON.stringify(this.data, null, 2), "utf8");
    fs.renameSync(tmpPath, this.filePath);
  }

  ensureUser({ guildId, userId, username, joinedAt, timestamp }) {
    if (!isSnowflake(guildId) || !isSnowflake(userId)) {
      return null;
    }

    const now = toIsoString(timestamp);
    const key = makeKey(guildId, userId);
    const existing = this.data.users[key];

    if (!existing) {
      this.data.users[key] = {
        guild_id: guildId,
        user_id: userId,
        username: username || null,
        joined_at: joinedAt ? toIsoString(joinedAt) : null,
        left_at: null,
        first_activity_at: now,
        last_activity_at: now,
        command_count: 0,
        minecraft_username: null,
        minecraft_uuid: null,
        minecraft_linked_at: null,
        created_at: now,
        updated_at: now,
      };
      return this.data.users[key];
    }

    if (username) {
      existing.username = username;
    }
    if (joinedAt && !existing.joined_at) {
      existing.joined_at = toIsoString(joinedAt);
    }
    existing.last_activity_at = now;
    existing.updated_at = now;

    return existing;
  }

  linkMinecraftAccount({
    guildId,
    userId,
    username,
    joinedAt,
    minecraftUsername,
    minecraftUuid,
    timestamp,
  }) {
    const now = toIsoString(timestamp);
    const normalizedUuid = String(minecraftUuid || "").replace(/-/g, "").toLowerCase();
    const linkKey = makeKey(guildId, userId);
    const user = this.ensureUser({ guildId, userId, username, joinedAt, timestamp: now });

    if (!user || !/^[a-f0-9]{32}$/.test(normalizedUuid)) {
      return null;
    }

    const link = {
      guild_id: guildId,
      user_id: userId,
      discord_username: username || user.username || null,
      minecraft_username: minecraftUsername,
      minecraft_uuid: normalizedUuid,
      linked_at: now,
      updated_at: now,
    };

    this.data.minecraft_links[linkKey] = link;
    user.minecraft_username = minecraftUsername;
    user.minecraft_uuid = normalizedUuid;
    user.minecraft_linked_at = now;
    user.updated_at = now;

    return link;
  }

  unlinkMinecraftAccount(guildId, userId) {
    const linkKey = makeKey(guildId, userId);
    const user = this.data.users[linkKey];

    delete this.data.minecraft_links[linkKey];

    if (user) {
      user.minecraft_username = null;
      user.minecraft_uuid = null;
      user.minecraft_linked_at = null;
      user.updated_at = new Date().toISOString();
    }
  }

  getMinecraftLink(guildId, userId) {
    return this.data.minecraft_links[makeKey(guildId, userId)] || null;
  }

  findMinecraftLink(guildId, minecraftId) {
    const value = String(minecraftId || "").replace(/-/g, "").toLowerCase();

    return (
      Object.values(this.data.minecraft_links).find((link) => {
        if (link.guild_id !== guildId) {
          return false;
        }

        return (
          link.minecraft_uuid === value ||
          link.minecraft_username?.toLowerCase() === value
        );
      }) || null
    );
  }

  recordMemberJoin({ guildId, userId, username, joinedAt, timestamp }) {
    const user = this.ensureUser({ guildId, userId, username, joinedAt, timestamp });
    if (!user) {
      return;
    }

    user.joined_at = toIsoString(joinedAt || timestamp);
    user.left_at = null;
  }

  recordMemberLeave({ guildId, userId, username, timestamp }) {
    const user = this.ensureUser({ guildId, userId, username, timestamp });
    if (!user) {
      return;
    }

    user.left_at = toIsoString(timestamp);
  }

  syncGuildMember({ guildId, userId, username, joinedAt, timestamp }) {
    if (!isSnowflake(guildId) || !isSnowflake(userId)) {
      return null;
    }

    const now = toIsoString(timestamp);
    const key = makeKey(guildId, userId);
    const existing = this.data.users[key];

    if (!existing) {
      this.data.users[key] = {
        guild_id: guildId,
        user_id: userId,
        username: username || null,
        joined_at: joinedAt ? toIsoString(joinedAt) : null,
        left_at: null,
        first_activity_at: null,
        last_activity_at: null,
        command_count: 0,
        minecraft_username: null,
        minecraft_uuid: null,
        minecraft_linked_at: null,
        created_at: now,
        updated_at: now,
      };
      return this.data.users[key];
    }

    if (username) {
      existing.username = username;
    }
    if (joinedAt) {
      existing.joined_at = toIsoString(joinedAt);
    }
    existing.left_at = null;
    existing.updated_at = now;

    return existing;
  }

  recordMemberSyncRun({ guildId, members, timestamp }) {
    this.data.member_sync_runs.push({
      guild_id: guildId,
      members,
      ran_at: toIsoString(timestamp),
    });

    this.data.member_sync_runs = this.data.member_sync_runs.slice(-100);
  }

  recordMessage({ guildId, userId, username, joinedAt, channelId, timestamp }) {
    if (!isSnowflake(channelId)) {
      return;
    }

    const now = toIsoString(timestamp);
    this.ensureUser({ guildId, userId, username, joinedAt, timestamp: now });

    const statsKey = makeKey(guildId, userId);
    const stats = this.data.message_stats[statsKey] || {
      guild_id: guildId,
      user_id: userId,
      total_messages: 0,
      first_message_at: null,
      last_message_at: null,
    };

    stats.total_messages += 1;
    stats.first_message_at = stats.first_message_at || now;
    stats.last_message_at = now;
    this.data.message_stats[statsKey] = stats;

    const channelKey = makeKey(guildId, userId, channelId);
    const channelStats = this.data.message_channel_stats[channelKey] || {
      guild_id: guildId,
      user_id: userId,
      channel_id: channelId,
      total_messages: 0,
      updated_at: now,
    };

    channelStats.total_messages += 1;
    channelStats.updated_at = now;
    this.data.message_channel_stats[channelKey] = channelStats;

    const daily = this.ensureDailyActivity(guildId, userId, now);
    daily.messages += 1;

    const hourly = this.ensureHourlyActivity(guildId, userId, now);
    hourly.messages += 1;
  }

  recordInteraction({ guildId, userId, username, joinedAt, channelId, isCommand, timestamp }) {
    const now = toIsoString(timestamp);
    const user = this.ensureUser({ guildId, userId, username, joinedAt, timestamp: now });
    if (!user) {
      return;
    }

    if (isCommand) {
      user.command_count += 1;
      const daily = this.ensureDailyActivity(guildId, userId, now);
      daily.commands += 1;
    }

    if (isSnowflake(channelId)) {
      const hourly = this.ensureHourlyActivity(guildId, userId, now);
      hourly.interactions += 1;
    }
  }

  recordPresenceSnapshot({ guildId, userId, username, joinedAt, timestamp }) {
    const user = this.ensureUser({ guildId, userId, username, joinedAt, timestamp });
    if (!user) {
      return;
    }

    user.last_activity_at = toIsoString(timestamp);
    user.updated_at = toIsoString(timestamp);
  }

  refreshOpenVoiceSessions(timestamp = new Date()) {
    const now = toIsoString(timestamp);

    for (const active of Object.values(this.data.active_voice_sessions)) {
      if (!active?.guild_id || !active?.user_id || !active?.joined_at) {
        continue;
      }

      const statsKey = makeKey(active.guild_id, active.user_id);
      const joinedAtMs = new Date(active.joined_at).getTime();
      const nowMs = new Date(now).getTime();
      const durationSeconds = Math.max(0, Math.floor((nowMs - joinedAtMs) / 1000));
      const alreadyCounted = Math.max(0, active.counted_seconds || 0);
      const deltaSeconds = Math.max(0, durationSeconds - alreadyCounted);

      if (deltaSeconds <= 0) {
        continue;
      }

      const stats = this.data.voice_stats[statsKey] || {
        guild_id: active.guild_id,
        user_id: active.user_id,
        total_voice_seconds: 0,
        total_joins: 0,
        total_leaves: 0,
        last_voice_join_at: active.joined_at,
        total_sessions: 0,
      };
      stats.total_voice_seconds += deltaSeconds;
      this.data.voice_stats[statsKey] = stats;

      const channelKey = makeKey(active.guild_id, active.user_id, active.channel_id);
      const channelStats = this.data.voice_channel_stats[channelKey] || {
        guild_id: active.guild_id,
        user_id: active.user_id,
        channel_id: active.channel_id,
        total_voice_seconds: 0,
        total_sessions: 0,
        updated_at: now,
      };
      channelStats.total_voice_seconds += deltaSeconds;
      channelStats.updated_at = now;
      this.data.voice_channel_stats[channelKey] = channelStats;

      const daily = this.ensureDailyActivity(active.guild_id, active.user_id, now);
      daily.voice_seconds += deltaSeconds;

      active.counted_seconds = durationSeconds;
      active.updated_at = now;
    }
  }

  recordRefreshRun({ guildId, activeUsers, timestamp }) {
    this.data.refresh_runs.push({
      guild_id: guildId,
      active_users: activeUsers,
      ran_at: toIsoString(timestamp),
    });

    this.data.refresh_runs = this.data.refresh_runs.slice(-100);
  }

  recordVoiceJoin({ guildId, userId, username, joinedAt, channelId, timestamp }) {
    if (!isSnowflake(channelId)) {
      return;
    }

    const now = toIsoString(timestamp);
    this.ensureUser({ guildId, userId, username, joinedAt, timestamp: now });

    const statsKey = makeKey(guildId, userId);
    const stats = this.data.voice_stats[statsKey] || {
      guild_id: guildId,
      user_id: userId,
      total_voice_seconds: 0,
      total_joins: 0,
      total_leaves: 0,
      last_voice_join_at: null,
      total_sessions: 0,
    };

    stats.total_joins += 1;
    stats.last_voice_join_at = now;
    this.data.voice_stats[statsKey] = stats;
    this.data.active_voice_sessions[statsKey] = {
      guild_id: guildId,
      user_id: userId,
      channel_id: channelId,
      joined_at: now,
    };
  }

  recordVoiceLeave({ guildId, userId, username, joinedAt, channelId, timestamp }) {
    if (!isSnowflake(channelId)) {
      return;
    }

    const now = toIsoString(timestamp);
    this.ensureUser({ guildId, userId, username, joinedAt, timestamp: now });

    const statsKey = makeKey(guildId, userId);
    const active = this.data.active_voice_sessions[statsKey];
    const joinedAtIso = active?.joined_at || now;
    const durationSeconds = Math.max(
      0,
      Math.floor((new Date(now).getTime() - new Date(joinedAtIso).getTime()) / 1000)
    );
    const alreadyCounted = Math.max(0, active?.counted_seconds || 0);
    const deltaSeconds = Math.max(0, durationSeconds - alreadyCounted);

    const stats = this.data.voice_stats[statsKey] || {
      guild_id: guildId,
      user_id: userId,
      total_voice_seconds: 0,
      total_joins: 0,
      total_leaves: 0,
      last_voice_join_at: null,
      total_sessions: 0,
    };

    stats.total_leaves += 1;
    stats.total_voice_seconds += deltaSeconds;
    stats.total_sessions += durationSeconds > 0 ? 1 : 0;
    this.data.voice_stats[statsKey] = stats;

    const voiceChannelKey = makeKey(guildId, userId, active?.channel_id || channelId);
    const channelStats = this.data.voice_channel_stats[voiceChannelKey] || {
      guild_id: guildId,
      user_id: userId,
      channel_id: active?.channel_id || channelId,
      total_voice_seconds: 0,
      total_sessions: 0,
      updated_at: now,
    };

    channelStats.total_voice_seconds += deltaSeconds;
    channelStats.total_sessions += durationSeconds > 0 ? 1 : 0;
    channelStats.updated_at = now;
    this.data.voice_channel_stats[voiceChannelKey] = channelStats;

    const daily = this.ensureDailyActivity(guildId, userId, now);
    daily.voice_seconds += deltaSeconds;

    this.data.voice_sessions.push({
      guild_id: guildId,
      user_id: userId,
      channel_id: active?.channel_id || channelId,
      joined_at: joinedAtIso,
      left_at: now,
      duration_seconds: durationSeconds,
    });

    delete this.data.active_voice_sessions[statsKey];
  }

  ensureDailyActivity(guildId, userId, timestamp) {
    const date = getDateKey(timestamp);
    const key = makeKey(guildId, userId, date);
    const daily = this.data.daily_activity[key] || {
      guild_id: guildId,
      user_id: userId,
      date,
      messages: 0,
      voice_seconds: 0,
      commands: 0,
    };

    this.data.daily_activity[key] = daily;
    return daily;
  }

  ensureHourlyActivity(guildId, userId, timestamp) {
    const date = getDateKey(timestamp);
    const hour = getHourKey(timestamp);
    const key = makeKey(guildId, userId, date, hour);
    const hourly = this.data.hourly_activity[key] || {
      guild_id: guildId,
      user_id: userId,
      date,
      hour,
      messages: 0,
      interactions: 0,
    };

    this.data.hourly_activity[key] = hourly;
    return hourly;
  }

  getGuildIds() {
    return [...new Set(Object.values(this.data.users).map((user) => user.guild_id))];
  }

  getUserStats(guildId, userId) {
    const userKey = makeKey(guildId, userId);
    const messageStats = this.data.message_stats[userKey] || {};
    const voiceStats = this.data.voice_stats[userKey] || {};
    const totalMessages = messageStats.total_messages || 0;
    const rank = this.getMessageRank(guildId, userId);
    const avgDays = daysBetweenInclusive(
      messageStats.first_message_at,
      messageStats.last_message_at
    );

    return {
      guildId,
      userId,
      username: this.data.users[userKey]?.username || null,
      minecraft: this.getMinecraftLink(guildId, userId),
      messages: totalMessages,
      voiceSeconds: voiceStats.total_voice_seconds || 0,
      joins: voiceStats.total_joins || 0,
      leaves: voiceStats.total_leaves || 0,
      commands: this.data.users[userKey]?.command_count || 0,
      rank,
      firstMessageAt: messageStats.first_message_at || null,
      lastMessageAt: messageStats.last_message_at || null,
      lastVoiceJoinAt: voiceStats.last_voice_join_at || null,
      averageDailyMessages: avgDays > 0 ? Number((totalMessages / avgDays).toFixed(2)) : 0,
      averageVoiceSessionSeconds:
        voiceStats.total_sessions > 0
          ? Math.round((voiceStats.total_voice_seconds || 0) / voiceStats.total_sessions)
          : 0,
    };
  }

  getUserActivity(guildId, userId) {
    const userKey = makeKey(guildId, userId);
    const daily = Object.values(this.data.daily_activity)
      .filter((entry) => entry.guild_id === guildId && entry.user_id === userId)
      .sort((a, b) => a.date.localeCompare(b.date));
    const hourly = Object.values(this.data.hourly_activity)
      .filter((entry) => entry.guild_id === guildId && entry.user_id === userId)
      .sort((a, b) => `${a.date}:${a.hour}`.localeCompare(`${b.date}:${b.hour}`));
    const channels = this.getTopChannels(guildId, userId);

    return {
      guildId,
      userId,
      joinedAt: this.data.users[userKey]?.joined_at || null,
      lastActivityAt: this.data.users[userKey]?.last_activity_at || null,
      daysActive: daily.filter((entry) => entry.messages > 0 || entry.voice_seconds > 0 || entry.commands > 0).length,
      commandCount: this.data.users[userKey]?.command_count || 0,
      topChannels: channels,
      peakHours: this.getPeakHours(guildId, userId),
      daily,
      hourly,
    };
  }

  getUserHistory(guildId, userId) {
    return {
      guildId,
      userId,
      daily: this.getUserActivity(guildId, userId).daily,
      messageChannels: Object.values(this.data.message_channel_stats)
        .filter((entry) => entry.guild_id === guildId && entry.user_id === userId)
        .sort((a, b) => b.total_messages - a.total_messages),
      voiceChannels: Object.values(this.data.voice_channel_stats)
        .filter((entry) => entry.guild_id === guildId && entry.user_id === userId)
        .sort((a, b) => b.total_voice_seconds - a.total_voice_seconds),
      voiceSessions: this.data.voice_sessions
        .filter((entry) => entry.guild_id === guildId && entry.user_id === userId)
        .slice(-100)
        .reverse(),
    };
  }

  getRanking(type, options = {}) {
    const { guildId, period } = options;
    const users = Object.values(this.data.users).filter((user) => !guildId || user.guild_id === guildId);

    const entries = users.map((user) => {
      const stats = this.getUserStats(user.guild_id, user.user_id);
      const activityScore = this.getActivityScore(user.guild_id, user.user_id, period);

      return {
        guildId: user.guild_id,
        userId: user.user_id,
        username: user.username,
        joinedAt: user.joined_at || null,
        minecraft: this.getMinecraftLink(user.guild_id, user.user_id),
        messages: stats.messages,
        voiceSeconds: stats.voiceSeconds,
        commands: stats.commands,
        reactionsGiven: 0,
        reactionsReceived: 0,
        mentionsReceived: 0,
        repliesSent: 0,
        activityScore,
      };
    });

    const sorters = {
      messages: (a, b) => b.messages - a.messages,
      voice: (a, b) => b.voiceSeconds - a.voiceSeconds,
      activity: (a, b) => b.activityScore - a.activityScore,
    };

    return entries
      .sort(sorters[type] || sorters.activity)
      .map((entry, index) => ({ rank: index + 1, ...entry }));
  }

  getMessageRank(guildId, userId) {
    const ranking = Object.values(this.data.message_stats)
      .filter((entry) => entry.guild_id === guildId)
      .sort((a, b) => b.total_messages - a.total_messages);
    const index = ranking.findIndex((entry) => entry.user_id === userId);

    return index >= 0 ? index + 1 : null;
  }

  getActivityScore(guildId, userId, period) {
    const startDate = this.getPeriodStart(period);

    return Object.values(this.data.daily_activity)
      .filter((entry) => {
        if (entry.guild_id !== guildId || entry.user_id !== userId) {
          return false;
        }
        return !startDate || entry.date >= startDate;
      })
      .reduce(
        (total, entry) =>
          total + entry.messages + entry.commands * 2 + Math.floor(entry.voice_seconds / 60),
        0
      );
  }

  getGuildStats(guildId) {
    const users = Object.values(this.data.users).filter((user) => user.guild_id === guildId);
    const dailyTotals = new Map();

    for (const entry of Object.values(this.data.daily_activity)) {
      if (entry.guild_id !== guildId) {
        continue;
      }

      const current = dailyTotals.get(entry.date) || {
        date: entry.date,
        messages: 0,
        voiceSeconds: 0,
        commands: 0,
      };

      current.messages += entry.messages;
      current.voiceSeconds += entry.voice_seconds;
      current.commands += entry.commands;
      dailyTotals.set(entry.date, current);
    }

    return {
      guildId,
      users: users.length,
      totalMessages: Object.values(this.data.message_stats)
        .filter((entry) => entry.guild_id === guildId)
        .reduce((total, entry) => total + entry.total_messages, 0),
      totalVoiceSeconds: Object.values(this.data.voice_stats)
        .filter((entry) => entry.guild_id === guildId)
        .reduce((total, entry) => total + entry.total_voice_seconds, 0),
      topUsers: this.getRanking("activity", { guildId }).slice(0, 10),
      daily: [...dailyTotals.values()].sort((a, b) => a.date.localeCompare(b.date)),
      channels: this.getGuildChannels(guildId),
      minecraftLinks: Object.values(this.data.minecraft_links).filter(
        (entry) => entry.guild_id === guildId
      ),
    };
  }

  getTopChannels(guildId, userId) {
    const messageChannels = Object.values(this.data.message_channel_stats)
      .filter((entry) => entry.guild_id === guildId && entry.user_id === userId)
      .map((entry) => ({
        channelId: entry.channel_id,
        messages: entry.total_messages,
        voiceSeconds: 0,
      }));
    const byChannel = new Map(messageChannels.map((entry) => [entry.channelId, entry]));

    for (const entry of Object.values(this.data.voice_channel_stats)) {
      if (entry.guild_id !== guildId || entry.user_id !== userId) {
        continue;
      }

      const current = byChannel.get(entry.channel_id) || {
        channelId: entry.channel_id,
        messages: 0,
        voiceSeconds: 0,
      };
      current.voiceSeconds += entry.total_voice_seconds;
      byChannel.set(entry.channel_id, current);
    }

    return [...byChannel.values()]
      .sort((a, b) => b.messages + b.voiceSeconds / 60 - (a.messages + a.voiceSeconds / 60))
      .slice(0, 10);
  }

  getPeakHours(guildId, userId) {
    const totals = new Map();

    for (const entry of Object.values(this.data.hourly_activity)) {
      if (entry.guild_id !== guildId || entry.user_id !== userId) {
        continue;
      }

      const current = totals.get(entry.hour) || {
        hour: entry.hour,
        messages: 0,
        interactions: 0,
      };
      current.messages += entry.messages;
      current.interactions += entry.interactions;
      totals.set(entry.hour, current);
    }

    return [...totals.values()]
      .sort((a, b) => b.messages + b.interactions - (a.messages + a.interactions))
      .slice(0, 5);
  }

  getGuildChannels(guildId) {
    const channels = new Map();

    for (const entry of Object.values(this.data.message_channel_stats)) {
      if (entry.guild_id !== guildId) {
        continue;
      }
      const current = channels.get(entry.channel_id) || {
        channelId: entry.channel_id,
        messages: 0,
        voiceSeconds: 0,
      };
      current.messages += entry.total_messages;
      channels.set(entry.channel_id, current);
    }

    for (const entry of Object.values(this.data.voice_channel_stats)) {
      if (entry.guild_id !== guildId) {
        continue;
      }
      const current = channels.get(entry.channel_id) || {
        channelId: entry.channel_id,
        messages: 0,
        voiceSeconds: 0,
      };
      current.voiceSeconds += entry.total_voice_seconds;
      channels.set(entry.channel_id, current);
    }

    return [...channels.values()].sort(
      (a, b) => b.messages + b.voiceSeconds / 60 - (a.messages + a.voiceSeconds / 60)
    );
  }

  getPeriodStart(period) {
    if (!period || period === "all") {
      return null;
    }

    const date = new Date();
    if (period === "week") {
      date.setUTCDate(date.getUTCDate() - 7);
    } else if (period === "month") {
      date.setUTCDate(date.getUTCDate() - 30);
    } else {
      return null;
    }

    return date.toISOString().slice(0, 10);
  }
}

module.exports = {
  StatsRepository,
  isSnowflake,
};
