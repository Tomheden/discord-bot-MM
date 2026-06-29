const express = require("express");
const { isSnowflake } = require("../services/stats/statsRepository");

// Express API for dashboards and external read-only stats consumers.
const isMinecraftId = (value) =>
  typeof value === "string" && /^[A-Za-z0-9_:-]{3,36}$/.test(value);

const normalizeOrigin = (origin) => String(origin || "").replace(/\/$/, "");

const parseCorsOrigins = (value) =>
  String(value || "")
    .split(",")
    .map((origin) => normalizeOrigin(origin.trim()))
    .filter(Boolean);

const createRateLimiter = ({ windowMs, max }) => {
  const buckets = new Map();

  return (req, res, next) => {
    const now = Date.now();
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const bucket = buckets.get(ip) || { count: 0, resetAt: now + windowMs };

    if (bucket.resetAt <= now) {
      bucket.count = 0;
      bucket.resetAt = now + windowMs;
    }

    bucket.count += 1;
    buckets.set(ip, bucket);

    if (bucket.count > max) {
      res.status(429).json({ error: "Too many requests" });
      return;
    }

    next();
  };
};

const asyncRoute = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

const resolveGuildId = async (req, repository, config) => {
  const queryGuildId = req.query.guildId;
  if (queryGuildId) {
    return isSnowflake(queryGuildId) ? queryGuildId : null;
  }

  if (config.defaultGuildId && isSnowflake(config.defaultGuildId)) {
    return config.defaultGuildId;
  }

  const guildIds = await repository.getGuildIds();
  return guildIds.length === 1 ? guildIds[0] : null;
};

const isAuthorized = (req, apiKey) => {
  if (!apiKey) {
    return true;
  }

  const headerKey = req.get("x-api-key");
  const auth = req.get("authorization") || "";
  return headerKey === apiKey || auth === `Bearer ${apiKey}`;
};

const normalizeApiConfig = (config = {}) => ({
  enabled:
    config.enabled !== undefined
      ? config.enabled
      : process.env.STATS_API_ENABLED !== "0",
  host: config.host || process.env.STATS_API_HOST || "0.0.0.0",
  port: Number(config.port || process.env.STATS_API_PORT || 9793),
  apiKey: config.apiKey || process.env.STATS_API_KEY || "",
  publicUrl:
    config.publicUrl ||
    process.env.STATS_API_PUBLIC_URL ||
    "https://mundominecraft.wisp.uno",
  defaultGuildId:
    config.defaultGuildId || process.env.STATS_DEFAULT_GUILD_ID || process.env.GUILD_ID || "",
  rateLimitWindowMs: Number(
    config.rateLimitWindowMs || process.env.STATS_RATE_LIMIT_WINDOW_MS || 60000
  ),
  rateLimitMax: Number(config.rateLimitMax || process.env.STATS_RATE_LIMIT_MAX || 120),
  corsOrigins: parseCorsOrigins(
      config.corsOrigin ||
      config.corsOrigins ||
      process.env.STATS_API_CORS_ORIGIN ||
      "https://mundominecraft.wisp.uno"
  ),
});

const normalizeMinecraftLink = (link) => {
  if (!link) {
    return null;
  }

  const username = link.minecraftUsername || link.minecraft_username;
  const uuid = link.minecraftUuid || link.minecraft_uuid;

  if (!username && !uuid) {
    return null;
  }

  return {
    username: username || null,
    uuid: uuid || null,
    linkedAt: link.linkedAt || link.linked_at || null,
  };
};

const buildProfile = ({ guildId, userId, username, joinedAt, minecraft }, link = null) => {
  const normalizedLink = normalizeMinecraftLink(minecraft || link);
  const rawLink = minecraft || link || {};

  return {
    guildId: guildId || rawLink.guildId || rawLink.guild_id || null,
    userId: userId || rawLink.userId || rawLink.user_id || null,
    username: username || rawLink.discordUsername || rawLink.discord_username || null,
    joinedAt: joinedAt || null,
    minecraft: normalizedLink,
  };
};

const stripUserIdentity = (payload = {}) => {
  const { guildId, userId, username, minecraft, joinedAt, ...rest } = payload;
  return rest;
};

const formatDailyActivity = (entry) => ({
  date: entry.date,
  messages: entry.messages || 0,
  voiceSeconds: entry.voiceSeconds ?? entry.voice_seconds ?? 0,
  commands: entry.commands || 0,
  reactionsGiven: entry.reactionsGiven ?? entry.reactions_given ?? 0,
  reactionsReceived: entry.reactionsReceived ?? entry.reactions_received ?? 0,
  mentionsReceived: entry.mentionsReceived ?? entry.mentions_received ?? 0,
  repliesSent: entry.repliesSent ?? entry.replies_sent ?? 0,
});

const formatHourlyActivity = (entry) => ({
  date: entry.date,
  hour: entry.hour,
  messages: entry.messages || 0,
  interactions: entry.interactions || 0,
});

const formatUserStatsResponse = (stats, link = null) => ({
  profile: buildProfile(stats, link),
  stats: stripUserIdentity(stats),
});

const formatUserActivityResponse = (activity, profileSource = {}) => {
  const cleanActivity = stripUserIdentity(activity);

  return {
    profile: buildProfile({
      ...profileSource,
      guildId: profileSource.guildId || activity.guildId,
      userId: profileSource.userId || activity.userId,
      joinedAt: profileSource.joinedAt || activity.joinedAt,
    }),
    activity: {
      ...cleanActivity,
      daily: (cleanActivity.daily || []).map(formatDailyActivity),
      hourly: (cleanActivity.hourly || []).map(formatHourlyActivity),
    },
  };
};

const formatMessageChannel = (entry) => ({
  channelId: entry.channelId || entry.channel_id,
  channelName: entry.channelName || entry.channel_name || null,
  channelType: entry.channelType || entry.channel_type || null,
  messages: entry.messages ?? entry.total_messages ?? 0,
});

const formatVoiceChannel = (entry) => ({
  channelId: entry.channelId || entry.channel_id,
  channelName: entry.channelName || entry.channel_name || null,
  channelType: entry.channelType || entry.channel_type || null,
  voiceSeconds: entry.voiceSeconds ?? entry.total_voice_seconds ?? 0,
  sessions: entry.sessions ?? entry.total_sessions ?? 0,
});

const formatVoiceSession = (entry) => ({
  channelId: entry.channelId || entry.channel_id,
  joinedAt: entry.joinedAt || entry.joined_at || null,
  leftAt: entry.leftAt || entry.left_at || null,
  durationSeconds: entry.durationSeconds ?? entry.duration_seconds ?? 0,
});

const formatUserHistoryResponse = (history, profileSource = {}) => ({
  profile: buildProfile({
    ...profileSource,
    guildId: profileSource.guildId || history.guildId,
    userId: profileSource.userId || history.userId,
  }),
  history: {
    daily: (history.daily || []).map(formatDailyActivity),
    messageChannels: (history.messageChannels || []).map(formatMessageChannel),
    voiceChannels: (history.voiceChannels || []).map(formatVoiceChannel),
    voiceSessions: (history.voiceSessions || []).map(formatVoiceSession),
  },
});

const formatRankingEntry = (entry) => {
  const { rank, guildId, userId, username, minecraft, ...metrics } = entry;

  return {
    rank,
    profile: buildProfile({ guildId, userId, username, minecraft }),
    metrics,
  };
};

const formatLinkResponse = (link, source = {}) => ({
  profile: buildProfile(source, link),
});

const normalizeChannelVisibility = (value) => {
  const visibility = value || "public";

  return ["public", "private", "all"].includes(visibility) ? visibility : null;
};

const createStatsApp = (repository, config) => {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "32kb" }));
  app.use((req, res, next) => {
    res.setHeader("Cache-Control", "no-store");

    const requestOrigin = normalizeOrigin(req.get("origin"));
    const allowedOrigin = config.corsOrigins.includes(requestOrigin)
      ? requestOrigin
      : config.corsOrigins[0];

    if (allowedOrigin) {
      res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, x-api-key");
    }

    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }

    next();
  });
  app.use(
    createRateLimiter({
      windowMs: config.rateLimitWindowMs,
      max: config.rateLimitMax,
    })
  );
  app.use((req, res, next) => {
    if (!isAuthorized(req, config.apiKey)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    next();
  });

  app.get("/api/health", (req, res) => {
    res.json({ ok: true });
  });

  app.get("/api/users/:userId/stats", asyncRoute(async (req, res) => {
    const guildId = await resolveGuildId(req, repository, config);
    if (!isSnowflake(req.params.userId) || !guildId) {
      res.status(400).json({ error: "Valid userId and configured guild are required" });
      return;
    }

    const stats = await repository.getUserStats(guildId, req.params.userId);
    res.json(formatUserStatsResponse(stats));
  }));

  app.get("/api/users/:userId/activity", asyncRoute(async (req, res) => {
    const guildId = await resolveGuildId(req, repository, config);
    if (!isSnowflake(req.params.userId) || !guildId) {
      res.status(400).json({ error: "Valid userId and configured guild are required" });
      return;
    }

    const [stats, activity] = await Promise.all([
      repository.getUserStats(guildId, req.params.userId),
      repository.getUserActivity(guildId, req.params.userId),
    ]);
    res.json(formatUserActivityResponse(activity, stats));
  }));

  app.get("/api/users/:userId/history", asyncRoute(async (req, res) => {
    const guildId = await resolveGuildId(req, repository, config);
    if (!isSnowflake(req.params.userId) || !guildId) {
      res.status(400).json({ error: "Valid userId and configured guild are required" });
      return;
    }

    const [stats, history] = await Promise.all([
      repository.getUserStats(guildId, req.params.userId),
      repository.getUserHistory(guildId, req.params.userId),
    ]);
    res.json(formatUserHistoryResponse(history, stats));
  }));

  app.get("/api/users/:userId/link", asyncRoute(async (req, res) => {
    const guildId = await resolveGuildId(req, repository, config);
    if (!isSnowflake(req.params.userId) || !guildId) {
      res.status(400).json({ error: "Valid userId and configured guild are required" });
      return;
    }

    res.json(
      formatLinkResponse(await repository.getMinecraftLink(guildId, req.params.userId), {
        guildId,
        userId: req.params.userId,
      })
    );
  }));

  app.get("/api/minecraft/:minecraftId/:view", asyncRoute(async (req, res) => {
    const { minecraftId, view } = req.params;
    const guildId = await resolveGuildId(req, repository, config);

    if (!isMinecraftId(minecraftId) || !guildId) {
      res.status(400).json({ error: "Valid minecraftId and configured guild are required" });
      return;
    }

    if (!["stats", "activity", "history", "link"].includes(view)) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const link = await repository.findMinecraftLink(guildId, minecraftId);
    if (!link) {
      res.status(404).json({ error: "Minecraft account is not linked" });
      return;
    }

    if (view === "stats") {
      const stats = await repository.getUserStats(guildId, link.user_id);
      res.json(formatUserStatsResponse(stats, link));
      return;
    }

    if (view === "activity") {
      const [stats, activity] = await Promise.all([
        repository.getUserStats(guildId, link.user_id),
        repository.getUserActivity(guildId, link.user_id),
      ]);
      res.json(formatUserActivityResponse(activity, { ...stats, minecraft: link }));
      return;
    }

    if (view === "history") {
      const [stats, history] = await Promise.all([
        repository.getUserStats(guildId, link.user_id),
        repository.getUserHistory(guildId, link.user_id),
      ]);
      res.json(formatUserHistoryResponse(history, { ...stats, minecraft: link }));
      return;
    }

    res.json(formatLinkResponse(link));
  }));

  app.get("/api/rankings/:type", asyncRoute(async (req, res) => {
    const { type } = req.params;
    const guildId = await resolveGuildId(req, repository, config);
    const period = req.query.period || "all";
    const limit = Number(req.query.limit || 100);
    const visibility = normalizeChannelVisibility(req.query.visibility);

    if (type === "channels") {
      if (!guildId) {
        res.status(400).json({ error: "Configured guild is required" });
        return;
      }
      if (!["all", "day", "week", "month"].includes(period)) {
        res.status(400).json({ error: "Valid period is required" });
        return;
      }
      if (!visibility) {
        res.status(400).json({ error: "Valid visibility is required" });
        return;
      }

      res.json(await repository.getGuildChannels(guildId, { period, limit, visibility }));
      return;
    }

    if (
      !["messages", "voice", "activity", "commands", "reactions", "mentions", "replies"].includes(
        type
      )
    ) {
      res.status(404).json({ error: "Unknown ranking" });
      return;
    }
    if (!guildId) {
      res.status(400).json({ error: "Configured guild is required" });
      return;
    }
    if (!["all", "day", "week", "month"].includes(period)) {
      res.status(400).json({ error: "Valid period is required" });
      return;
    }

    const normalizedLimit = Math.min(Math.max(Number.isInteger(limit) ? limit : 100, 1), 500);
    const ranking = await repository.getRanking(type, { guildId, period });
    res.json(ranking.slice(0, normalizedLimit).map(formatRankingEntry));
  }));

  app.get("/api/rankings/channels", asyncRoute(async (req, res) => {
    const guildId = await resolveGuildId(req, repository, config);
    const period = req.query.period || "all";
    const limit = Number(req.query.limit || 10);
    const visibility = normalizeChannelVisibility(req.query.visibility);

    if (!guildId) {
      res.status(400).json({ error: "Configured guild is required" });
      return;
    }
    if (!["all", "day", "week", "month"].includes(period)) {
      res.status(400).json({ error: "Valid period is required" });
      return;
    }
    if (!visibility) {
      res.status(400).json({ error: "Valid visibility is required" });
      return;
    }

    res.json(await repository.getGuildChannels(guildId, { period, limit, visibility }));
  }));

  app.get("/api/guilds/:guildId/stats", asyncRoute(async (req, res) => {
    if (!isSnowflake(req.params.guildId)) {
      res.status(400).json({ error: "Valid guildId is required" });
      return;
    }

    res.json(await repository.getGuildStats(req.params.guildId));
  }));

  app.get("/api/guild/stats", asyncRoute(async (req, res) => {
    const guildId = await resolveGuildId(req, repository, config);
    if (!guildId) {
      res.status(400).json({ error: "Configured guild is required" });
      return;
    }

    res.json(await repository.getGuildStats(guildId));
  }));

  app.use((req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  app.use((error, req, res, next) => {
    console.error("[stats-api] Request failed:", error);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
};

const startStatsApi = (repository, config = {}) => {
  const apiConfig = normalizeApiConfig(config);

  if (apiConfig.enabled === false) {
    return null;
  }

  const app = createStatsApp(repository, apiConfig);
  const server = app.listen(apiConfig.port, apiConfig.host, () => {
    const baseUrl = `http://${apiConfig.host}:${apiConfig.port}`;
    const publicUrl = normalizeOrigin(apiConfig.publicUrl);
    console.log(`[stats-api] Express listening on ${baseUrl}`);
    console.log(`[stats-api] Test URL: ${baseUrl}/api/health`);
    console.log(`[stats-api] Public URL: ${publicUrl}/api/health`);
  });

  return server;
};

module.exports = {
  createStatsApp,
  startStatsApi,
};
