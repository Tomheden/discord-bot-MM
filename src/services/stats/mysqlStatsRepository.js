let mysql;

try {
  mysql = require("mysql2/promise");
} catch (error) {
  mysql = null;
}

const { isSnowflake } = require("./statsRepository");

const parseBooleanStorage = (value) => String(value || "").toLowerCase() === "mysql";

const toDate = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const toIsoString = (value = new Date()) => toDate(value).toISOString();
const getDateKey = (value = new Date()) => toIsoString(value).slice(0, 10);
const getHourKey = (value = new Date()) => toDate(value).getUTCHours();

const daysBetweenInclusive = (fromIso, toIso) => {
  if (!fromIso || !toIso) {
    return 0;
  }

  const from = new Date(String(fromIso).slice(0, 10));
  const to = new Date(String(toIso).slice(0, 10));
  const ms = to.getTime() - from.getTime();

  if (Number.isNaN(ms) || ms < 0) {
    return 0;
  }

  return Math.floor(ms / 86400000) + 1;
};

const normalizeDateTime = (value) => {
  if (!value) {
    return null;
  }

  return toDate(value);
};

const normalizeIso = (value) => {
  if (!value) {
    return null;
  }

  return toIsoString(value);
};

const normalizeLimit = (value, fallback = 10, max = 500) => {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, max);
};

const normalizePeriod = (period) => {
  if (!period || period === "all") {
    return null;
  }

  const date = new Date();
  if (period === "day") {
    date.setUTCDate(date.getUTCDate() - 1);
  } else if (period === "week") {
    date.setUTCDate(date.getUTCDate() - 7);
  } else if (period === "month") {
    date.setUTCDate(date.getUTCDate() - 30);
  } else {
    return null;
  }

  return date.toISOString().slice(0, 10);
};

const parseDatabaseUrl = (databaseUrl) => {
  if (!databaseUrl) {
    return {};
  }

  const url = new URL(databaseUrl);

  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
  };
};

const getDatabaseConfig = (options = {}) => {
  const urlConfig = parseDatabaseUrl(options.url || process.env.DATABASE_URL);

  return {
    host:
      options.host ||
      urlConfig.host ||
      process.env.STATS_DB_HOST ||
      process.env.MYSQL_HOST ||
      process.env.DB_HOST,
    port: Number(
      options.port ||
        urlConfig.port ||
        process.env.STATS_DB_PORT ||
        process.env.MYSQL_PORT ||
        process.env.DB_PORT ||
        3306
    ),
    user:
      options.user ||
      urlConfig.user ||
      process.env.STATS_DB_USER ||
      process.env.MYSQL_USER ||
      process.env.DB_USER,
    password:
      options.password ||
      urlConfig.password ||
      process.env.STATS_DB_PASSWORD ||
      process.env.MYSQL_PASSWORD ||
      process.env.DB_PASSWORD,
    database:
      options.database ||
      urlConfig.database ||
      process.env.STATS_DB_NAME ||
      process.env.MYSQL_DATABASE ||
      process.env.DB_NAME,
    connectionLimit: Number(
      options.connectionLimit || process.env.STATS_DB_CONNECTION_LIMIT || 5
    ),
  };
};

class MySqlStatsRepository {
  constructor(options = {}) {
    this.options = options;
    this.pool = null;
  }

  async init() {
    if (!mysql) {
      throw new Error("mysql2 is required for STATS_STORAGE=mysql. Run npm install mysql2.");
    }

    const dbConfig = getDatabaseConfig(this.options.database || this.options);

    for (const key of ["host", "user", "database"]) {
      if (!dbConfig[key]) {
        throw new Error(`Missing MySQL stats config: ${key}`);
      }
    }

    this.pool = mysql.createPool({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      database: dbConfig.database,
      waitForConnections: true,
      connectionLimit: dbConfig.connectionLimit,
      charset: "utf8mb4",
      timezone: "Z",
      dateStrings: false,
      namedPlaceholders: false,
    });

    await this.ensureSchema();
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  async save() {
    return undefined;
  }

  async ensureSchema() {
    const statements = [
      `CREATE TABLE IF NOT EXISTS stats_users (
        guild_id VARCHAR(25) NOT NULL,
        user_id VARCHAR(25) NOT NULL,
        username VARCHAR(100) NULL,
        joined_at DATETIME(3) NULL,
        left_at DATETIME(3) NULL,
        first_activity_at DATETIME(3) NULL,
        last_activity_at DATETIME(3) NULL,
        command_count INT UNSIGNED NOT NULL DEFAULT 0,
        minecraft_username VARCHAR(16) NULL,
        minecraft_uuid CHAR(32) NULL,
        minecraft_linked_at DATETIME(3) NULL,
        created_at DATETIME(3) NOT NULL,
        updated_at DATETIME(3) NOT NULL,
        PRIMARY KEY (guild_id, user_id),
        KEY idx_stats_users_guild_last_activity (guild_id, last_activity_at),
        KEY idx_stats_users_minecraft (guild_id, minecraft_uuid)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS message_stats (
        guild_id VARCHAR(25) NOT NULL,
        user_id VARCHAR(25) NOT NULL,
        total_messages BIGINT UNSIGNED NOT NULL DEFAULT 0,
        first_message_at DATETIME(3) NULL,
        last_message_at DATETIME(3) NULL,
        PRIMARY KEY (guild_id, user_id),
        KEY idx_message_stats_guild_total (guild_id, total_messages)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS message_channel_stats (
        guild_id VARCHAR(25) NOT NULL,
        user_id VARCHAR(25) NOT NULL,
        channel_id VARCHAR(25) NOT NULL,
        total_messages BIGINT UNSIGNED NOT NULL DEFAULT 0,
        updated_at DATETIME(3) NOT NULL,
        PRIMARY KEY (guild_id, user_id, channel_id),
        KEY idx_message_channel_guild_channel (guild_id, channel_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS voice_stats (
        guild_id VARCHAR(25) NOT NULL,
        user_id VARCHAR(25) NOT NULL,
        total_voice_seconds BIGINT UNSIGNED NOT NULL DEFAULT 0,
        total_joins BIGINT UNSIGNED NOT NULL DEFAULT 0,
        total_leaves BIGINT UNSIGNED NOT NULL DEFAULT 0,
        last_voice_join_at DATETIME(3) NULL,
        total_sessions BIGINT UNSIGNED NOT NULL DEFAULT 0,
        PRIMARY KEY (guild_id, user_id),
        KEY idx_voice_stats_guild_total (guild_id, total_voice_seconds)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS voice_channel_stats (
        guild_id VARCHAR(25) NOT NULL,
        user_id VARCHAR(25) NOT NULL,
        channel_id VARCHAR(25) NOT NULL,
        total_voice_seconds BIGINT UNSIGNED NOT NULL DEFAULT 0,
        total_sessions BIGINT UNSIGNED NOT NULL DEFAULT 0,
        updated_at DATETIME(3) NOT NULL,
        PRIMARY KEY (guild_id, user_id, channel_id),
        KEY idx_voice_channel_guild_channel (guild_id, channel_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS active_voice_sessions (
        guild_id VARCHAR(25) NOT NULL,
        user_id VARCHAR(25) NOT NULL,
        channel_id VARCHAR(25) NOT NULL,
        joined_at DATETIME(3) NOT NULL,
        counted_seconds BIGINT UNSIGNED NOT NULL DEFAULT 0,
        updated_at DATETIME(3) NOT NULL,
        PRIMARY KEY (guild_id, user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS voice_sessions (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        guild_id VARCHAR(25) NOT NULL,
        user_id VARCHAR(25) NOT NULL,
        channel_id VARCHAR(25) NOT NULL,
        joined_at DATETIME(3) NOT NULL,
        left_at DATETIME(3) NOT NULL,
        duration_seconds BIGINT UNSIGNED NOT NULL DEFAULT 0,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_voice_session_legacy (guild_id, user_id, channel_id, joined_at, left_at),
        KEY idx_voice_sessions_user (guild_id, user_id, left_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS daily_activity (
        guild_id VARCHAR(25) NOT NULL,
        user_id VARCHAR(25) NOT NULL,
        date DATE NOT NULL,
        messages BIGINT UNSIGNED NOT NULL DEFAULT 0,
        voice_seconds BIGINT UNSIGNED NOT NULL DEFAULT 0,
        commands BIGINT UNSIGNED NOT NULL DEFAULT 0,
        reactions_given BIGINT UNSIGNED NOT NULL DEFAULT 0,
        reactions_received BIGINT UNSIGNED NOT NULL DEFAULT 0,
        mentions_received BIGINT UNSIGNED NOT NULL DEFAULT 0,
        replies_sent BIGINT UNSIGNED NOT NULL DEFAULT 0,
        PRIMARY KEY (guild_id, user_id, date),
        KEY idx_daily_activity_guild_date (guild_id, date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS hourly_activity (
        guild_id VARCHAR(25) NOT NULL,
        user_id VARCHAR(25) NOT NULL,
        date DATE NOT NULL,
        hour TINYINT UNSIGNED NOT NULL,
        messages BIGINT UNSIGNED NOT NULL DEFAULT 0,
        interactions BIGINT UNSIGNED NOT NULL DEFAULT 0,
        PRIMARY KEY (guild_id, user_id, date, hour),
        KEY idx_hourly_activity_guild_hour (guild_id, hour)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS channel_daily_activity (
        guild_id VARCHAR(25) NOT NULL,
        channel_id VARCHAR(25) NOT NULL,
        date DATE NOT NULL,
        messages BIGINT UNSIGNED NOT NULL DEFAULT 0,
        voice_seconds BIGINT UNSIGNED NOT NULL DEFAULT 0,
        reactions BIGINT UNSIGNED NOT NULL DEFAULT 0,
        PRIMARY KEY (guild_id, channel_id, date),
        KEY idx_channel_daily_guild_date (guild_id, date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS social_stats (
        guild_id VARCHAR(25) NOT NULL,
        user_id VARCHAR(25) NOT NULL,
        reactions_given BIGINT UNSIGNED NOT NULL DEFAULT 0,
        reactions_received BIGINT UNSIGNED NOT NULL DEFAULT 0,
        mentions_received BIGINT UNSIGNED NOT NULL DEFAULT 0,
        replies_sent BIGINT UNSIGNED NOT NULL DEFAULT 0,
        updated_at DATETIME(3) NOT NULL,
        PRIMARY KEY (guild_id, user_id),
        KEY idx_social_stats_guild_reactions (guild_id, reactions_given, reactions_received)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS member_events (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        guild_id VARCHAR(25) NOT NULL,
        user_id VARCHAR(25) NOT NULL,
        event_type ENUM('join','leave') NOT NULL,
        happened_at DATETIME(3) NOT NULL,
        PRIMARY KEY (id),
        KEY idx_member_events_guild_time (guild_id, happened_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS stats_refresh_runs (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        guild_id VARCHAR(25) NOT NULL,
        active_users INT UNSIGNED NOT NULL DEFAULT 0,
        ran_at DATETIME(3) NOT NULL,
        PRIMARY KEY (id),
        KEY idx_refresh_runs_guild_time (guild_id, ran_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS stats_member_sync_runs (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        guild_id VARCHAR(25) NOT NULL,
        members INT UNSIGNED NOT NULL DEFAULT 0,
        ran_at DATETIME(3) NOT NULL,
        PRIMARY KEY (id),
        KEY idx_member_sync_runs_guild_time (guild_id, ran_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    ];

    for (const statement of statements) {
      await this.pool.execute(statement);
    }
  }

  async ensureUser({ guildId, userId, username, joinedAt, timestamp }) {
    if (!isSnowflake(guildId) || !isSnowflake(userId)) {
      return null;
    }

    const now = normalizeDateTime(timestamp);

    await this.pool.execute(
      `INSERT INTO stats_users (
        guild_id, user_id, username, joined_at, left_at, first_activity_at,
        last_activity_at, command_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, NULL, ?, ?, 0, ?, ?)
      ON DUPLICATE KEY UPDATE
        username = COALESCE(VALUES(username), username),
        joined_at = COALESCE(joined_at, VALUES(joined_at)),
        first_activity_at = COALESCE(first_activity_at, VALUES(first_activity_at)),
        last_activity_at = VALUES(last_activity_at),
        updated_at = VALUES(updated_at)`,
      [
        guildId,
        userId,
        username || null,
        normalizeDateTime(joinedAt),
        now,
        now,
        now,
        now,
      ]
    );

    const [rows] = await this.pool.execute(
      "SELECT * FROM stats_users WHERE guild_id = ? AND user_id = ? LIMIT 1",
      [guildId, userId]
    );

    return rows[0] || null;
  }

  async syncGuildMember({ guildId, userId, username, joinedAt, timestamp }) {
    if (!isSnowflake(guildId) || !isSnowflake(userId)) {
      return null;
    }

    const now = normalizeDateTime(timestamp);

    await this.pool.execute(
      `INSERT INTO stats_users (
        guild_id, user_id, username, joined_at, left_at, first_activity_at,
        last_activity_at, command_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, NULL, NULL, NULL, 0, ?, ?)
      ON DUPLICATE KEY UPDATE
        username = COALESCE(VALUES(username), username),
        joined_at = COALESCE(VALUES(joined_at), joined_at),
        left_at = NULL,
        updated_at = VALUES(updated_at)`,
      [guildId, userId, username || null, normalizeDateTime(joinedAt), now, now]
    );

    return this.getUserRow(guildId, userId);
  }

  async getUserRow(guildId, userId) {
    const [rows] = await this.pool.execute(
      "SELECT * FROM stats_users WHERE guild_id = ? AND user_id = ? LIMIT 1",
      [guildId, userId]
    );

    return rows[0] || null;
  }

  async recordMemberJoin({ guildId, userId, username, joinedAt, timestamp }) {
    await this.ensureUser({ guildId, userId, username, joinedAt, timestamp });

    const now = normalizeDateTime(joinedAt || timestamp);
    await this.pool.execute(
      `UPDATE stats_users
       SET joined_at = ?, left_at = NULL, updated_at = ?
       WHERE guild_id = ? AND user_id = ?`,
      [now, now, guildId, userId]
    );
    await this.pool.execute(
      "INSERT INTO member_events (guild_id, user_id, event_type, happened_at) VALUES (?, ?, 'join', ?)",
      [guildId, userId, now]
    );
  }

  async recordMemberLeave({ guildId, userId, username, timestamp }) {
    await this.ensureUser({ guildId, userId, username, timestamp });

    const now = normalizeDateTime(timestamp);
    await this.pool.execute(
      `UPDATE stats_users SET left_at = ?, updated_at = ? WHERE guild_id = ? AND user_id = ?`,
      [now, now, guildId, userId]
    );
    await this.pool.execute(
      "INSERT INTO member_events (guild_id, user_id, event_type, happened_at) VALUES (?, ?, 'leave', ?)",
      [guildId, userId, now]
    );
  }

  async recordMessage({
    guildId,
    userId,
    username,
    joinedAt,
    channelId,
    timestamp,
    mentionedUsers = [],
    replyUserId,
  }) {
    if (!isSnowflake(channelId)) {
      return;
    }

    const now = normalizeDateTime(timestamp);
    const date = getDateKey(now);
    const hour = getHourKey(now);

    await this.ensureUser({ guildId, userId, username, joinedAt, timestamp: now });
    await this.pool.execute(
      `INSERT INTO message_stats (guild_id, user_id, total_messages, first_message_at, last_message_at)
       VALUES (?, ?, 1, ?, ?)
       ON DUPLICATE KEY UPDATE
         total_messages = total_messages + 1,
         first_message_at = COALESCE(first_message_at, VALUES(first_message_at)),
         last_message_at = VALUES(last_message_at)`,
      [guildId, userId, now, now]
    );
    await this.pool.execute(
      `INSERT INTO message_channel_stats (guild_id, user_id, channel_id, total_messages, updated_at)
       VALUES (?, ?, ?, 1, ?)
       ON DUPLICATE KEY UPDATE total_messages = total_messages + 1, updated_at = VALUES(updated_at)`,
      [guildId, userId, channelId, now]
    );
    await this.incrementDaily(guildId, userId, date, { messages: 1 });
    await this.incrementHourly(guildId, userId, date, hour, { messages: 1 });
    await this.incrementChannelDaily(guildId, channelId, date, { messages: 1 });

    const uniqueMentions = new Map();
    for (const mentioned of mentionedUsers) {
      const mentionId = typeof mentioned === "string" ? mentioned : mentioned?.id;
      if (isSnowflake(mentionId) && mentionId !== userId) {
        uniqueMentions.set(mentionId, mentioned);
      }
    }

    for (const [mentionId, mentioned] of uniqueMentions) {
      await this.ensureUser({
        guildId,
        userId: mentionId,
        username: mentioned?.username || null,
        timestamp: now,
      });
      await this.incrementSocial(guildId, mentionId, { mentions_received: 1 }, now);
      await this.incrementDaily(guildId, mentionId, date, { mentions_received: 1 });
    }

    if (isSnowflake(replyUserId) && replyUserId !== userId) {
      await this.incrementSocial(guildId, userId, { replies_sent: 1 }, now);
      await this.incrementDaily(guildId, userId, date, { replies_sent: 1 });
    }
  }

  async recordInteraction({ guildId, userId, username, joinedAt, isCommand, timestamp }) {
    const now = normalizeDateTime(timestamp);
    const user = await this.ensureUser({ guildId, userId, username, joinedAt, timestamp: now });
    if (!user || !isCommand) {
      return;
    }

    await this.pool.execute(
      `UPDATE stats_users
       SET command_count = command_count + 1, updated_at = ?
       WHERE guild_id = ? AND user_id = ?`,
      [now, guildId, userId]
    );
    await this.incrementDaily(guildId, userId, getDateKey(now), { commands: 1 });
    await this.incrementHourly(guildId, userId, getDateKey(now), getHourKey(now), {
      interactions: 1,
    });
  }

  async recordReaction({
    guildId,
    userId,
    username,
    joinedAt,
    channelId,
    messageAuthorId,
    timestamp,
  }) {
    if (!isSnowflake(guildId) || !isSnowflake(userId)) {
      return;
    }

    const now = normalizeDateTime(timestamp);
    const date = getDateKey(now);

    await this.ensureUser({ guildId, userId, username, joinedAt, timestamp: now });
    await this.incrementSocial(guildId, userId, { reactions_given: 1 }, now);
    await this.incrementDaily(guildId, userId, date, { reactions_given: 1 });
    await this.incrementHourly(guildId, userId, date, getHourKey(now), { interactions: 1 });

    if (isSnowflake(channelId)) {
      await this.incrementChannelDaily(guildId, channelId, date, { reactions: 1 });
    }

    if (isSnowflake(messageAuthorId) && messageAuthorId !== userId) {
      await this.incrementSocial(guildId, messageAuthorId, { reactions_received: 1 }, now);
      await this.incrementDaily(guildId, messageAuthorId, date, { reactions_received: 1 });
    }
  }

  async recordPresenceSnapshot({ guildId, userId, username, joinedAt, timestamp }) {
    const user = await this.ensureUser({ guildId, userId, username, joinedAt, timestamp });
    if (!user) {
      return;
    }

    const now = normalizeDateTime(timestamp);
    await this.pool.execute(
      "UPDATE stats_users SET last_activity_at = ?, updated_at = ? WHERE guild_id = ? AND user_id = ?",
      [now, now, guildId, userId]
    );
  }

  async recordVoiceJoin({ guildId, userId, username, joinedAt, channelId, timestamp }) {
    if (!isSnowflake(channelId)) {
      return;
    }

    const now = normalizeDateTime(timestamp);
    await this.ensureUser({ guildId, userId, username, joinedAt, timestamp: now });
    await this.pool.execute(
      `INSERT INTO voice_stats (
        guild_id, user_id, total_voice_seconds, total_joins, total_leaves,
        last_voice_join_at, total_sessions
      ) VALUES (?, ?, 0, 1, 0, ?, 0)
      ON DUPLICATE KEY UPDATE
        total_joins = total_joins + 1,
        last_voice_join_at = VALUES(last_voice_join_at)`,
      [guildId, userId, now]
    );
    await this.pool.execute(
      `INSERT INTO active_voice_sessions (guild_id, user_id, channel_id, joined_at, counted_seconds, updated_at)
       VALUES (?, ?, ?, ?, 0, ?)
       ON DUPLICATE KEY UPDATE
         channel_id = VALUES(channel_id),
         joined_at = VALUES(joined_at),
         counted_seconds = 0,
         updated_at = VALUES(updated_at)`,
      [guildId, userId, channelId, now, now]
    );
  }

  async recordVoiceLeave({ guildId, userId, username, joinedAt, channelId, timestamp }) {
    if (!isSnowflake(channelId)) {
      return;
    }

    const now = normalizeDateTime(timestamp);
    await this.ensureUser({ guildId, userId, username, joinedAt, timestamp: now });

    const [rows] = await this.pool.execute(
      "SELECT * FROM active_voice_sessions WHERE guild_id = ? AND user_id = ? LIMIT 1",
      [guildId, userId]
    );
    const active = rows[0] || null;
    const joinedAtDate = normalizeDateTime(active?.joined_at || now);
    const activeChannelId = active?.channel_id || channelId;
    const durationSeconds = Math.max(
      0,
      Math.floor((now.getTime() - joinedAtDate.getTime()) / 1000)
    );
    const alreadyCounted = Math.max(0, Number(active?.counted_seconds) || 0);
    const deltaSeconds = Math.max(0, durationSeconds - alreadyCounted);

    await this.pool.execute(
      `INSERT INTO voice_stats (
        guild_id, user_id, total_voice_seconds, total_joins, total_leaves,
        last_voice_join_at, total_sessions
      ) VALUES (?, ?, ?, 0, 1, NULL, ?)
      ON DUPLICATE KEY UPDATE
        total_voice_seconds = total_voice_seconds + VALUES(total_voice_seconds),
        total_leaves = total_leaves + 1,
        total_sessions = total_sessions + VALUES(total_sessions)`,
      [guildId, userId, deltaSeconds, durationSeconds > 0 ? 1 : 0]
    );
    await this.pool.execute(
      `INSERT INTO voice_channel_stats (
        guild_id, user_id, channel_id, total_voice_seconds, total_sessions, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        total_voice_seconds = total_voice_seconds + VALUES(total_voice_seconds),
        total_sessions = total_sessions + VALUES(total_sessions),
        updated_at = VALUES(updated_at)`,
      [guildId, userId, activeChannelId, deltaSeconds, durationSeconds > 0 ? 1 : 0, now]
    );
    await this.incrementDaily(guildId, userId, getDateKey(now), { voice_seconds: deltaSeconds });
    await this.incrementChannelDaily(guildId, activeChannelId, getDateKey(now), {
      voice_seconds: deltaSeconds,
    });
    await this.pool.execute(
      `INSERT IGNORE INTO voice_sessions (
        guild_id, user_id, channel_id, joined_at, left_at, duration_seconds
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [guildId, userId, activeChannelId, joinedAtDate, now, durationSeconds]
    );
    await this.pool.execute(
      "DELETE FROM active_voice_sessions WHERE guild_id = ? AND user_id = ?",
      [guildId, userId]
    );
  }

  async refreshOpenVoiceSessions(timestamp = new Date()) {
    const now = normalizeDateTime(timestamp);
    const [rows] = await this.pool.execute("SELECT * FROM active_voice_sessions");

    for (const active of rows) {
      const joinedAt = normalizeDateTime(active.joined_at);
      const durationSeconds = Math.max(
        0,
        Math.floor((now.getTime() - joinedAt.getTime()) / 1000)
      );
      const alreadyCounted = Math.max(0, Number(active.counted_seconds) || 0);
      const deltaSeconds = Math.max(0, durationSeconds - alreadyCounted);

      if (deltaSeconds <= 0) {
        continue;
      }

      await this.pool.execute(
        `INSERT INTO voice_stats (
          guild_id, user_id, total_voice_seconds, total_joins, total_leaves,
          last_voice_join_at, total_sessions
        ) VALUES (?, ?, ?, 0, 0, ?, 0)
        ON DUPLICATE KEY UPDATE total_voice_seconds = total_voice_seconds + VALUES(total_voice_seconds)`,
        [active.guild_id, active.user_id, deltaSeconds, joinedAt]
      );
      await this.pool.execute(
        `INSERT INTO voice_channel_stats (
          guild_id, user_id, channel_id, total_voice_seconds, total_sessions, updated_at
        ) VALUES (?, ?, ?, ?, 0, ?)
        ON DUPLICATE KEY UPDATE
          total_voice_seconds = total_voice_seconds + VALUES(total_voice_seconds),
          updated_at = VALUES(updated_at)`,
        [active.guild_id, active.user_id, active.channel_id, deltaSeconds, now]
      );
      await this.incrementDaily(active.guild_id, active.user_id, getDateKey(now), {
        voice_seconds: deltaSeconds,
      });
      await this.incrementChannelDaily(active.guild_id, active.channel_id, getDateKey(now), {
        voice_seconds: deltaSeconds,
      });
      await this.pool.execute(
        `UPDATE active_voice_sessions
         SET counted_seconds = ?, updated_at = ?
         WHERE guild_id = ? AND user_id = ?`,
        [durationSeconds, now, active.guild_id, active.user_id]
      );
    }
  }

  async recordRefreshRun({ guildId, activeUsers, timestamp }) {
    await this.pool.execute(
      "INSERT INTO stats_refresh_runs (guild_id, active_users, ran_at) VALUES (?, ?, ?)",
      [guildId, Number(activeUsers) || 0, normalizeDateTime(timestamp)]
    );
  }

  async recordMemberSyncRun({ guildId, members, timestamp }) {
    await this.pool.execute(
      "INSERT INTO stats_member_sync_runs (guild_id, members, ran_at) VALUES (?, ?, ?)",
      [guildId, Number(members) || 0, normalizeDateTime(timestamp)]
    );
  }

  async incrementDaily(guildId, userId, date, increments) {
    await this.pool.execute(
      `INSERT INTO daily_activity (
        guild_id, user_id, date, messages, voice_seconds, commands,
        reactions_given, reactions_received, mentions_received, replies_sent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        messages = messages + VALUES(messages),
        voice_seconds = voice_seconds + VALUES(voice_seconds),
        commands = commands + VALUES(commands),
        reactions_given = reactions_given + VALUES(reactions_given),
        reactions_received = reactions_received + VALUES(reactions_received),
        mentions_received = mentions_received + VALUES(mentions_received),
        replies_sent = replies_sent + VALUES(replies_sent)`,
      [
        guildId,
        userId,
        date,
        increments.messages || 0,
        increments.voice_seconds || 0,
        increments.commands || 0,
        increments.reactions_given || 0,
        increments.reactions_received || 0,
        increments.mentions_received || 0,
        increments.replies_sent || 0,
      ]
    );
  }

  async incrementHourly(guildId, userId, date, hour, increments) {
    await this.pool.execute(
      `INSERT INTO hourly_activity (guild_id, user_id, date, hour, messages, interactions)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         messages = messages + VALUES(messages),
         interactions = interactions + VALUES(interactions)`,
      [guildId, userId, date, hour, increments.messages || 0, increments.interactions || 0]
    );
  }

  async incrementChannelDaily(guildId, channelId, date, increments) {
    await this.pool.execute(
      `INSERT INTO channel_daily_activity (guild_id, channel_id, date, messages, voice_seconds, reactions)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         messages = messages + VALUES(messages),
         voice_seconds = voice_seconds + VALUES(voice_seconds),
         reactions = reactions + VALUES(reactions)`,
      [
        guildId,
        channelId,
        date,
        increments.messages || 0,
        increments.voice_seconds || 0,
        increments.reactions || 0,
      ]
    );
  }

  async incrementSocial(guildId, userId, increments, timestamp) {
    const now = normalizeDateTime(timestamp);
    await this.pool.execute(
      `INSERT INTO social_stats (
        guild_id, user_id, reactions_given, reactions_received,
        mentions_received, replies_sent, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        reactions_given = reactions_given + VALUES(reactions_given),
        reactions_received = reactions_received + VALUES(reactions_received),
        mentions_received = mentions_received + VALUES(mentions_received),
        replies_sent = replies_sent + VALUES(replies_sent),
        updated_at = VALUES(updated_at)`,
      [
        guildId,
        userId,
        increments.reactions_given || 0,
        increments.reactions_received || 0,
        increments.mentions_received || 0,
        increments.replies_sent || 0,
        now,
      ]
    );
  }

  async getGuildIds() {
    const [rows] = await this.pool.execute("SELECT DISTINCT guild_id FROM stats_users");
    return rows.map((row) => row.guild_id);
  }

  async getMinecraftLink(guildId, userId) {
    const [rows] = await this.pool.execute(
      `SELECT guild_id, user_id, username AS discord_username, minecraft_username,
        minecraft_uuid, minecraft_linked_at AS linked_at, updated_at
       FROM stats_users
       WHERE guild_id = ? AND user_id = ? AND minecraft_uuid IS NOT NULL
       LIMIT 1`,
      [guildId, userId]
    );

    return rows[0] || null;
  }

  async findMinecraftLink(guildId, minecraftId) {
    const value = String(minecraftId || "").replace(/-/g, "").toLowerCase();
    const [rows] = await this.pool.execute(
      `SELECT guild_id, user_id, username AS discord_username, minecraft_username,
        minecraft_uuid, minecraft_linked_at AS linked_at, updated_at
       FROM stats_users
       WHERE guild_id = ?
         AND minecraft_uuid IS NOT NULL
         AND (minecraft_uuid = ? OR LOWER(minecraft_username) = ?)
       LIMIT 1`,
      [guildId, value, value]
    );

    return rows[0] || null;
  }

  async linkMinecraftAccount({
    guildId,
    userId,
    username,
    joinedAt,
    minecraftUsername,
    minecraftUuid,
    timestamp,
  }) {
    const normalizedUuid = String(minecraftUuid || "").replace(/-/g, "").toLowerCase();
    if (!/^[a-f0-9]{32}$/.test(normalizedUuid)) {
      return null;
    }

    const now = normalizeDateTime(timestamp);
    await this.ensureUser({ guildId, userId, username, joinedAt, timestamp: now });
    await this.pool.execute(
      `UPDATE stats_users
       SET minecraft_username = ?, minecraft_uuid = ?, minecraft_linked_at = ?, updated_at = ?
       WHERE guild_id = ? AND user_id = ?`,
      [minecraftUsername, normalizedUuid, now, now, guildId, userId]
    );

    return this.getMinecraftLink(guildId, userId);
  }

  async unlinkMinecraftAccount(guildId, userId) {
    await this.pool.execute(
      `UPDATE stats_users
       SET minecraft_username = NULL, minecraft_uuid = NULL, minecraft_linked_at = NULL, updated_at = ?
       WHERE guild_id = ? AND user_id = ?`,
      [new Date(), guildId, userId]
    );
  }

  async getUserStats(guildId, userId) {
    const [rows] = await this.pool.execute(
      `SELECT
        u.guild_id, u.user_id, u.username, u.command_count, u.joined_at,
        u.minecraft_username, u.minecraft_uuid, u.minecraft_linked_at,
        COALESCE(m.total_messages, 0) AS total_messages,
        m.first_message_at, m.last_message_at,
        COALESCE(v.total_voice_seconds, 0) AS total_voice_seconds,
        COALESCE(v.total_joins, 0) AS total_joins,
        COALESCE(v.total_leaves, 0) AS total_leaves,
        COALESCE(v.total_sessions, 0) AS total_sessions,
        v.last_voice_join_at,
        COALESCE(s.reactions_given, 0) AS reactions_given,
        COALESCE(s.reactions_received, 0) AS reactions_received,
        COALESCE(s.mentions_received, 0) AS mentions_received,
        COALESCE(s.replies_sent, 0) AS replies_sent
       FROM stats_users u
       LEFT JOIN message_stats m ON m.guild_id = u.guild_id AND m.user_id = u.user_id
       LEFT JOIN voice_stats v ON v.guild_id = u.guild_id AND v.user_id = u.user_id
       LEFT JOIN social_stats s ON s.guild_id = u.guild_id AND s.user_id = u.user_id
       WHERE u.guild_id = ? AND u.user_id = ?
       LIMIT 1`,
      [guildId, userId]
    );
    const row = rows[0] || {};
    const totalMessages = Number(row.total_messages) || 0;
    const avgDays = daysBetweenInclusive(row.first_message_at, row.last_message_at);
    const rank = await this.getMessageRank(guildId, userId);

    return {
      guildId,
      userId,
      username: row.username || null,
      minecraft: row.minecraft_uuid
        ? {
            guild_id: guildId,
            user_id: userId,
            minecraft_username: row.minecraft_username,
            minecraft_uuid: row.minecraft_uuid,
            linked_at: normalizeIso(row.minecraft_linked_at),
          }
        : null,
      messages: totalMessages,
      voiceSeconds: Number(row.total_voice_seconds) || 0,
      joins: Number(row.total_joins) || 0,
      leaves: Number(row.total_leaves) || 0,
      commands: Number(row.command_count) || 0,
      reactionsGiven: Number(row.reactions_given) || 0,
      reactionsReceived: Number(row.reactions_received) || 0,
      mentionsReceived: Number(row.mentions_received) || 0,
      repliesSent: Number(row.replies_sent) || 0,
      rank,
      firstMessageAt: normalizeIso(row.first_message_at),
      lastMessageAt: normalizeIso(row.last_message_at),
      joinedAt: normalizeIso(row.joined_at),
      lastVoiceJoinAt: normalizeIso(row.last_voice_join_at),
      averageDailyMessages: avgDays > 0 ? Number((totalMessages / avgDays).toFixed(2)) : 0,
      averageVoiceSessionSeconds:
        Number(row.total_sessions) > 0
          ? Math.round((Number(row.total_voice_seconds) || 0) / Number(row.total_sessions))
          : 0,
    };
  }

  async getUserActivity(guildId, userId) {
    const [dailyRows] = await this.pool.execute(
      `SELECT date, messages, voice_seconds, commands, reactions_given,
        reactions_received, mentions_received, replies_sent
       FROM daily_activity
       WHERE guild_id = ? AND user_id = ?
       ORDER BY date ASC`,
      [guildId, userId]
    );
    const [hourlyRows] = await this.pool.execute(
      `SELECT date, LPAD(hour, 2, '0') AS hour, messages, interactions
       FROM hourly_activity
       WHERE guild_id = ? AND user_id = ?
       ORDER BY date ASC, hour ASC`,
      [guildId, userId]
    );
    const user = await this.getUserRow(guildId, userId);
    const daily = dailyRows.map((row) => ({
      date: getDateKey(row.date),
      messages: Number(row.messages) || 0,
      voice_seconds: Number(row.voice_seconds) || 0,
      commands: Number(row.commands) || 0,
      reactions_given: Number(row.reactions_given) || 0,
      reactions_received: Number(row.reactions_received) || 0,
      mentions_received: Number(row.mentions_received) || 0,
      replies_sent: Number(row.replies_sent) || 0,
    }));

    return {
      guildId,
      userId,
      joinedAt: normalizeIso(user?.joined_at),
      lastActivityAt: normalizeIso(user?.last_activity_at),
      daysActive: daily.filter((entry) => this.isActiveDailyEntry(entry)).length,
      activeStreak: this.calculateActiveStreak(daily),
      commandCount: Number(user?.command_count) || 0,
      topChannels: await this.getTopChannels(guildId, userId),
      peakHours: await this.getPeakHours(guildId, userId),
      daily,
      hourly: hourlyRows.map((row) => ({
        date: getDateKey(row.date),
        hour: row.hour,
        messages: Number(row.messages) || 0,
        interactions: Number(row.interactions) || 0,
      })),
    };
  }

  async getUserHistory(guildId, userId) {
    const [messageChannels] = await this.pool.execute(
      `SELECT channel_id, total_messages
       FROM message_channel_stats
       WHERE guild_id = ? AND user_id = ?
       ORDER BY total_messages DESC`,
      [guildId, userId]
    );
    const [voiceChannels] = await this.pool.execute(
      `SELECT channel_id, total_voice_seconds, total_sessions
       FROM voice_channel_stats
       WHERE guild_id = ? AND user_id = ?
       ORDER BY total_voice_seconds DESC`,
      [guildId, userId]
    );
    const [voiceSessions] = await this.pool.execute(
      `SELECT guild_id, user_id, channel_id, joined_at, left_at, duration_seconds
       FROM voice_sessions
       WHERE guild_id = ? AND user_id = ?
       ORDER BY left_at DESC
       LIMIT 100`,
      [guildId, userId]
    );

    return {
      guildId,
      userId,
      daily: (await this.getUserActivity(guildId, userId)).daily,
      messageChannels: messageChannels.map((row) => ({
        guild_id: guildId,
        user_id: userId,
        channel_id: row.channel_id,
        total_messages: Number(row.total_messages) || 0,
      })),
      voiceChannels: voiceChannels.map((row) => ({
        guild_id: guildId,
        user_id: userId,
        channel_id: row.channel_id,
        total_voice_seconds: Number(row.total_voice_seconds) || 0,
        total_sessions: Number(row.total_sessions) || 0,
      })),
      voiceSessions: voiceSessions.map((row) => ({
        guild_id: row.guild_id,
        user_id: row.user_id,
        channel_id: row.channel_id,
        joined_at: normalizeIso(row.joined_at),
        left_at: normalizeIso(row.left_at),
        duration_seconds: Number(row.duration_seconds) || 0,
      })),
    };
  }

  async getRanking(type, options = {}) {
    const { guildId, period } = options;
    const startDate = normalizePeriod(period);
    const dailyFilter = startDate ? "AND date >= ?" : "";
    const params = startDate ? [guildId, startDate, guildId] : [guildId, guildId];
    const [rows] = await this.pool.execute(
      `SELECT
        u.guild_id, u.user_id, u.username, u.command_count,
        u.joined_at, u.minecraft_username, u.minecraft_uuid, u.minecraft_linked_at,
        COALESCE(m.total_messages, 0) AS messages,
        COALESCE(v.total_voice_seconds, 0) AS voice_seconds,
        COALESCE(s.reactions_given, 0) AS reactions_given,
        COALESCE(s.reactions_received, 0) AS reactions_received,
        COALESCE(s.mentions_received, 0) AS mentions_received,
        COALESCE(s.replies_sent, 0) AS replies_sent,
        COALESCE(d.activity_score, 0) AS activity_score
       FROM stats_users u
       LEFT JOIN message_stats m ON m.guild_id = u.guild_id AND m.user_id = u.user_id
       LEFT JOIN voice_stats v ON v.guild_id = u.guild_id AND v.user_id = u.user_id
       LEFT JOIN social_stats s ON s.guild_id = u.guild_id AND s.user_id = u.user_id
       LEFT JOIN (
         SELECT guild_id, user_id,
           SUM(messages + commands * 2 + FLOOR(voice_seconds / 60) + reactions_given + replies_sent * 2) AS activity_score
         FROM daily_activity
         WHERE guild_id = ? ${dailyFilter}
         GROUP BY guild_id, user_id
       ) d ON d.guild_id = u.guild_id AND d.user_id = u.user_id
       WHERE u.guild_id = ?`,
      params
    );

    const entries = rows.map((row) => ({
      guildId: row.guild_id,
      userId: row.user_id,
      username: row.username,
      joinedAt: normalizeIso(row.joined_at),
      minecraft: row.minecraft_uuid
        ? {
            guild_id: row.guild_id,
            user_id: row.user_id,
            minecraft_username: row.minecraft_username,
            minecraft_uuid: row.minecraft_uuid,
            linked_at: normalizeIso(row.minecraft_linked_at),
          }
        : null,
      messages: Number(row.messages) || 0,
      voiceSeconds: Number(row.voice_seconds) || 0,
      commands: Number(row.command_count) || 0,
      reactionsGiven: Number(row.reactions_given) || 0,
      reactionsReceived: Number(row.reactions_received) || 0,
      mentionsReceived: Number(row.mentions_received) || 0,
      repliesSent: Number(row.replies_sent) || 0,
      activityScore: Number(row.activity_score) || 0,
    }));

    const sorters = {
      messages: (a, b) => b.messages - a.messages,
      voice: (a, b) => b.voiceSeconds - a.voiceSeconds,
      activity: (a, b) => b.activityScore - a.activityScore,
      commands: (a, b) => b.commands - a.commands,
      reactions: (a, b) =>
        b.reactionsGiven + b.reactionsReceived - (a.reactionsGiven + a.reactionsReceived),
      mentions: (a, b) => b.mentionsReceived - a.mentionsReceived,
      replies: (a, b) => b.repliesSent - a.repliesSent,
    };

    return entries
      .sort(sorters[type] || sorters.activity)
      .map((entry, index) => ({ rank: index + 1, ...entry }));
  }

  async getMessageRank(guildId, userId) {
    const [rows] = await this.pool.execute(
      `SELECT user_id
       FROM message_stats
       WHERE guild_id = ?
       ORDER BY total_messages DESC`,
      [guildId]
    );
    const index = rows.findIndex((entry) => entry.user_id === userId);

    return index >= 0 ? index + 1 : null;
  }

  async getTopChannels(guildId, userId) {
    const [rows] = await this.pool.execute(
      `SELECT channel_id, SUM(messages) AS messages, SUM(voice_seconds) AS voice_seconds
       FROM (
         SELECT channel_id, total_messages AS messages, 0 AS voice_seconds
         FROM message_channel_stats
         WHERE guild_id = ? AND user_id = ?
         UNION ALL
         SELECT channel_id, 0 AS messages, total_voice_seconds AS voice_seconds
         FROM voice_channel_stats
         WHERE guild_id = ? AND user_id = ?
       ) channel_totals
       GROUP BY channel_id
       ORDER BY (SUM(messages) + SUM(voice_seconds) / 60) DESC
       LIMIT 10`,
      [guildId, userId, guildId, userId]
    );

    return rows.map((row) => ({
      channelId: row.channel_id,
      messages: Number(row.messages) || 0,
      voiceSeconds: Number(row.voice_seconds) || 0,
    }));
  }

  async getPeakHours(guildId, userId = null) {
    const userFilter = userId ? "AND user_id = ?" : "";
    const params = userId ? [guildId, userId] : [guildId];
    const [rows] = await this.pool.execute(
      `SELECT LPAD(hour, 2, '0') AS hour, SUM(messages) AS messages, SUM(interactions) AS interactions
       FROM hourly_activity
       WHERE guild_id = ? ${userFilter}
       GROUP BY hour
       ORDER BY (SUM(messages) + SUM(interactions)) DESC
       LIMIT 5`,
      params
    );

    return rows.map((row) => ({
      hour: row.hour,
      messages: Number(row.messages) || 0,
      interactions: Number(row.interactions) || 0,
    }));
  }

  async getGuildChannels(guildId, options = {}) {
    const period = options.period || "all";
    const limit = normalizeLimit(options.limit, 100, 500);
    const startDate = normalizePeriod(period);

    if (startDate) {
      const [rows] = await this.pool.execute(
        `SELECT channel_id, SUM(messages) AS messages, SUM(voice_seconds) AS voice_seconds,
          SUM(reactions) AS reactions
         FROM channel_daily_activity
         WHERE guild_id = ? AND date >= ?
         GROUP BY channel_id
         ORDER BY (SUM(messages) + SUM(voice_seconds) / 60 + SUM(reactions)) DESC
         LIMIT ?`,
        [guildId, startDate, limit]
      );

      return rows.map((row, index) => ({
        rank: index + 1,
        channelId: row.channel_id,
        messages: Number(row.messages) || 0,
        voiceSeconds: Number(row.voice_seconds) || 0,
        reactions: Number(row.reactions) || 0,
      }));
    }

    const [rows] = await this.pool.execute(
      `SELECT channel_id, SUM(messages) AS messages, SUM(voice_seconds) AS voice_seconds
       FROM (
         SELECT channel_id, total_messages AS messages, 0 AS voice_seconds
         FROM message_channel_stats
         WHERE guild_id = ?
         UNION ALL
         SELECT channel_id, 0 AS messages, total_voice_seconds AS voice_seconds
         FROM voice_channel_stats
         WHERE guild_id = ?
       ) channel_totals
       GROUP BY channel_id
       ORDER BY (SUM(messages) + SUM(voice_seconds) / 60) DESC
       LIMIT ?`,
      [guildId, guildId, limit]
    );

    return rows.map((row, index) => ({
      rank: index + 1,
      channelId: row.channel_id,
      messages: Number(row.messages) || 0,
      voiceSeconds: Number(row.voice_seconds) || 0,
      reactions: 0,
    }));
  }

  async getGuildStats(guildId) {
    const [[userTotals]] = await this.pool.execute(
      `SELECT
        COUNT(*) AS users,
        SUM(CASE WHEN left_at IS NULL THEN 1 ELSE 0 END) AS total_members
       FROM stats_users
       WHERE guild_id = ?`,
      [guildId]
    );
    const [[messageTotals]] = await this.pool.execute(
      "SELECT COALESCE(SUM(total_messages), 0) AS total_messages FROM message_stats WHERE guild_id = ?",
      [guildId]
    );
    const [[voiceTotals]] = await this.pool.execute(
      "SELECT COALESCE(SUM(total_voice_seconds), 0) AS total_voice_seconds FROM voice_stats WHERE guild_id = ?",
      [guildId]
    );
    const activePredicate =
      "(messages > 0 OR voice_seconds > 0 OR commands > 0 OR reactions_given > 0 OR replies_sent > 0)";
    const [[activeDay]] = await this.pool.execute(
      `SELECT COUNT(DISTINCT user_id) AS total
       FROM daily_activity
       WHERE guild_id = ? AND date >= ? AND ${activePredicate}`,
      [guildId, normalizePeriod("day")]
    );
    const [[activeWeek]] = await this.pool.execute(
      `SELECT COUNT(DISTINCT user_id) AS total
       FROM daily_activity
       WHERE guild_id = ? AND date >= ? AND ${activePredicate}`,
      [guildId, normalizePeriod("week")]
    );
    const [[activeMonth]] = await this.pool.execute(
      `SELECT COUNT(DISTINCT user_id) AS total
       FROM daily_activity
       WHERE guild_id = ? AND date >= ? AND ${activePredicate}`,
      [guildId, normalizePeriod("month")]
    );
    const [dailyRows] = await this.pool.execute(
      `SELECT date, SUM(messages) AS messages, SUM(voice_seconds) AS voice_seconds,
        SUM(commands) AS commands, SUM(reactions_given) AS reactions_given,
        SUM(replies_sent) AS replies_sent
       FROM daily_activity
       WHERE guild_id = ?
       GROUP BY date
       ORDER BY date ASC`,
      [guildId]
    );
    const [memberEvents] = await this.pool.execute(
      `SELECT DATE(happened_at) AS date, event_type, COUNT(*) AS total
       FROM member_events
       WHERE guild_id = ?
       GROUP BY DATE(happened_at), event_type
       ORDER BY date ASC`,
      [guildId]
    );

    return {
      guildId,
      users: Number(userTotals.users) || 0,
      totalMembers: Number(userTotals.total_members) || 0,
      activeMembers: {
        day: Number(activeDay.total) || 0,
        week: Number(activeWeek.total) || 0,
        month: Number(activeMonth.total) || 0,
      },
      totalMessages: Number(messageTotals.total_messages) || 0,
      totalVoiceSeconds: Number(voiceTotals.total_voice_seconds) || 0,
      topUsers: (await this.getRanking("activity", { guildId })).slice(0, 10),
      daily: dailyRows.map((row) => ({
        date: getDateKey(row.date),
        messages: Number(row.messages) || 0,
        voiceSeconds: Number(row.voice_seconds) || 0,
        commands: Number(row.commands) || 0,
        reactionsGiven: Number(row.reactions_given) || 0,
        repliesSent: Number(row.replies_sent) || 0,
      })),
      peakHours: await this.getPeakHours(guildId),
      channels: await this.getGuildChannels(guildId),
      memberEvents: memberEvents.map((row) => ({
        date: getDateKey(row.date),
        type: row.event_type,
        total: Number(row.total) || 0,
      })),
      minecraftLinks: await this.getMinecraftLinks(guildId),
    };
  }

  async getMinecraftLinks(guildId) {
    const [rows] = await this.pool.execute(
      `SELECT guild_id, user_id, username AS discord_username, minecraft_username,
        minecraft_uuid, minecraft_linked_at AS linked_at
       FROM stats_users
       WHERE guild_id = ? AND minecraft_uuid IS NOT NULL`,
      [guildId]
    );

    return rows.map((row) => ({
      ...row,
      linked_at: normalizeIso(row.linked_at),
    }));
  }

  async getRecentlyActiveUserIds(guildId, activeWindowDays) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - activeWindowDays);

    const [rows] = await this.pool.execute(
      `SELECT user_id
       FROM stats_users
       WHERE guild_id = ? AND last_activity_at >= ?`,
      [guildId, date]
    );

    return rows.map((row) => row.user_id);
  }

  async getActiveVoiceUserIds(guildId) {
    const [rows] = await this.pool.execute(
      "SELECT user_id FROM active_voice_sessions WHERE guild_id = ?",
      [guildId]
    );

    return rows.map((row) => row.user_id);
  }

  isActiveDailyEntry(entry) {
    return (
      entry.messages > 0 ||
      entry.voice_seconds > 0 ||
      entry.commands > 0 ||
      entry.reactions_given > 0 ||
      entry.replies_sent > 0
    );
  }

  calculateActiveStreak(daily) {
    const activeDates = new Set(
      daily.filter((entry) => this.isActiveDailyEntry(entry)).map((entry) => entry.date)
    );
    if (activeDates.size === 0) {
      return 0;
    }

    const sorted = [...activeDates].sort();
    let cursor = new Date(sorted[sorted.length - 1]);
    let streak = 0;

    while (activeDates.has(cursor.toISOString().slice(0, 10))) {
      streak += 1;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }

    return streak;
  }
}

const shouldUseMySqlStats = (statsConfig = {}) =>
  parseBooleanStorage(statsConfig.storage || process.env.STATS_STORAGE) ||
  Boolean(process.env.DATABASE_URL || process.env.STATS_DB_HOST);

module.exports = {
  MySqlStatsRepository,
  shouldUseMySqlStats,
  getDatabaseConfig,
  normalizeLimit,
  normalizePeriod,
};
