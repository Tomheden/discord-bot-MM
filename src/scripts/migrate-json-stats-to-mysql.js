require("dotenv").config();

const fs = require("fs");
const config = require("../config");
const { getDataPath } = require("../utils/storage");
const { MySqlStatsRepository } = require("../services/stats/mysqlStatsRepository");

const toDate = (value) => {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const number = (value) => Math.max(0, Number(value) || 0);

const run = async () => {
  const fileName = config.stats?.dataFile || process.env.STATS_DATA_FILE || "stats.json";
  const filePath = getDataPath(fileName);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Stats JSON not found: ${filePath}`);
  }

  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const repository = new MySqlStatsRepository(config.stats?.database || {});
  await repository.init();

  const pool = repository.pool;
  const counts = {
    users: 0,
    messages: 0,
    messageChannels: 0,
    voice: 0,
    voiceChannels: 0,
    activeVoiceSessions: 0,
    dailyActivity: 0,
    hourlyActivity: 0,
    voiceSessions: 0,
    refreshRuns: 0,
    memberSyncRuns: 0,
  };

  for (const user of Object.values(data.users || {})) {
    await pool.execute(
      `INSERT INTO stats_users (
        guild_id, user_id, username, joined_at, left_at, first_activity_at,
        last_activity_at, command_count, minecraft_username, minecraft_uuid,
        minecraft_linked_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        username = VALUES(username),
        joined_at = VALUES(joined_at),
        left_at = VALUES(left_at),
        first_activity_at = VALUES(first_activity_at),
        last_activity_at = VALUES(last_activity_at),
        command_count = VALUES(command_count),
        minecraft_username = VALUES(minecraft_username),
        minecraft_uuid = VALUES(minecraft_uuid),
        minecraft_linked_at = VALUES(minecraft_linked_at),
        updated_at = VALUES(updated_at)`,
      [
        user.guild_id,
        user.user_id,
        user.username || null,
        toDate(user.joined_at),
        toDate(user.left_at),
        toDate(user.first_activity_at),
        toDate(user.last_activity_at),
        number(user.command_count),
        user.minecraft_username || null,
        user.minecraft_uuid || null,
        toDate(user.minecraft_linked_at),
        toDate(user.created_at) || new Date(),
        toDate(user.updated_at) || new Date(),
      ]
    );
    counts.users += 1;
  }

  for (const link of Object.values(data.minecraft_links || {})) {
    await pool.execute(
      `UPDATE stats_users
       SET minecraft_username = ?, minecraft_uuid = ?, minecraft_linked_at = ?, updated_at = ?
       WHERE guild_id = ? AND user_id = ?`,
      [
        link.minecraft_username || null,
        link.minecraft_uuid || null,
        toDate(link.linked_at),
        toDate(link.updated_at) || new Date(),
        link.guild_id,
        link.user_id,
      ]
    );
  }

  for (const stat of Object.values(data.message_stats || {})) {
    await pool.execute(
      `INSERT INTO message_stats (guild_id, user_id, total_messages, first_message_at, last_message_at)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         total_messages = VALUES(total_messages),
         first_message_at = VALUES(first_message_at),
         last_message_at = VALUES(last_message_at)`,
      [
        stat.guild_id,
        stat.user_id,
        number(stat.total_messages),
        toDate(stat.first_message_at),
        toDate(stat.last_message_at),
      ]
    );
    counts.messages += 1;
  }

  for (const stat of Object.values(data.message_channel_stats || {})) {
    await pool.execute(
      `INSERT INTO message_channel_stats (guild_id, user_id, channel_id, total_messages, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         total_messages = VALUES(total_messages),
         updated_at = VALUES(updated_at)`,
      [
        stat.guild_id,
        stat.user_id,
        stat.channel_id,
        number(stat.total_messages),
        toDate(stat.updated_at) || new Date(),
      ]
    );
    counts.messageChannels += 1;
  }

  for (const stat of Object.values(data.voice_stats || {})) {
    await pool.execute(
      `INSERT INTO voice_stats (
        guild_id, user_id, total_voice_seconds, total_joins,
        total_leaves, last_voice_join_at, total_sessions
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        total_voice_seconds = VALUES(total_voice_seconds),
        total_joins = VALUES(total_joins),
        total_leaves = VALUES(total_leaves),
        last_voice_join_at = VALUES(last_voice_join_at),
        total_sessions = VALUES(total_sessions)`,
      [
        stat.guild_id,
        stat.user_id,
        number(stat.total_voice_seconds),
        number(stat.total_joins),
        number(stat.total_leaves),
        toDate(stat.last_voice_join_at),
        number(stat.total_sessions),
      ]
    );
    counts.voice += 1;
  }

  for (const stat of Object.values(data.voice_channel_stats || {})) {
    await pool.execute(
      `INSERT INTO voice_channel_stats (
        guild_id, user_id, channel_id, total_voice_seconds, total_sessions, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        total_voice_seconds = VALUES(total_voice_seconds),
        total_sessions = VALUES(total_sessions),
        updated_at = VALUES(updated_at)`,
      [
        stat.guild_id,
        stat.user_id,
        stat.channel_id,
        number(stat.total_voice_seconds),
        number(stat.total_sessions),
        toDate(stat.updated_at) || new Date(),
      ]
    );
    counts.voiceChannels += 1;
  }

  for (const active of Object.values(data.active_voice_sessions || {})) {
    await pool.execute(
      `INSERT INTO active_voice_sessions (guild_id, user_id, channel_id, joined_at, counted_seconds, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         channel_id = VALUES(channel_id),
         joined_at = VALUES(joined_at),
         counted_seconds = VALUES(counted_seconds),
         updated_at = VALUES(updated_at)`,
      [
        active.guild_id,
        active.user_id,
        active.channel_id,
        toDate(active.joined_at) || new Date(),
        number(active.counted_seconds),
        toDate(active.updated_at) || new Date(),
      ]
    );
    counts.activeVoiceSessions += 1;
  }

  for (const entry of Object.values(data.daily_activity || {})) {
    await pool.execute(
      `INSERT INTO daily_activity (
        guild_id, user_id, date, messages, voice_seconds, commands,
        reactions_given, reactions_received, mentions_received, replies_sent
      ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, 0)
      ON DUPLICATE KEY UPDATE
        messages = VALUES(messages),
        voice_seconds = VALUES(voice_seconds),
        commands = VALUES(commands)`,
      [
        entry.guild_id,
        entry.user_id,
        entry.date,
        number(entry.messages),
        number(entry.voice_seconds),
        number(entry.commands),
      ]
    );
    counts.dailyActivity += 1;
  }

  for (const entry of Object.values(data.hourly_activity || {})) {
    await pool.execute(
      `INSERT INTO hourly_activity (guild_id, user_id, date, hour, messages, interactions)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         messages = VALUES(messages),
         interactions = VALUES(interactions)`,
      [
        entry.guild_id,
        entry.user_id,
        entry.date,
        Number(entry.hour),
        number(entry.messages),
        number(entry.interactions),
      ]
    );
    counts.hourlyActivity += 1;
  }

  for (const session of data.voice_sessions || []) {
    await pool.execute(
      `INSERT IGNORE INTO voice_sessions (
        guild_id, user_id, channel_id, joined_at, left_at, duration_seconds
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        session.guild_id,
        session.user_id,
        session.channel_id,
        toDate(session.joined_at) || new Date(),
        toDate(session.left_at) || new Date(),
        number(session.duration_seconds),
      ]
    );
    counts.voiceSessions += 1;
  }

  for (const runEntry of data.refresh_runs || []) {
    await pool.execute(
      "INSERT INTO stats_refresh_runs (guild_id, active_users, ran_at) VALUES (?, ?, ?)",
      [
        runEntry.guild_id,
        number(runEntry.active_users),
        toDate(runEntry.ran_at) || new Date(),
      ]
    );
    counts.refreshRuns += 1;
  }

  for (const runEntry of data.member_sync_runs || []) {
    await pool.execute(
      "INSERT INTO stats_member_sync_runs (guild_id, members, ran_at) VALUES (?, ?, ?)",
      [runEntry.guild_id, number(runEntry.members), toDate(runEntry.ran_at) || new Date()]
    );
    counts.memberSyncRuns += 1;
  }

  await repository.close();
  console.log("[stats] JSON stats migrated to MySQL:", counts);
};

run().catch((error) => {
  console.error("[stats] JSON to MySQL migration failed:", error);
  process.exit(1);
});
