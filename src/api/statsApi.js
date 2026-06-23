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

const resolveGuildId = (req, repository, config) => {
  const queryGuildId = req.query.guildId;
  if (queryGuildId) {
    return isSnowflake(queryGuildId) ? queryGuildId : null;
  }

  if (config.defaultGuildId && isSnowflake(config.defaultGuildId)) {
    return config.defaultGuildId;
  }

  const guildIds = repository.getGuildIds();
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

  app.get("/api/users/:userId/stats", (req, res) => {
    const guildId = resolveGuildId(req, repository, config);
    if (!isSnowflake(req.params.userId) || !guildId) {
      res.status(400).json({ error: "Valid userId and guildId are required" });
      return;
    }

    res.json(repository.getUserStats(guildId, req.params.userId));
  });

  app.get("/api/users/:userId/activity", (req, res) => {
    const guildId = resolveGuildId(req, repository, config);
    if (!isSnowflake(req.params.userId) || !guildId) {
      res.status(400).json({ error: "Valid userId and guildId are required" });
      return;
    }

    res.json(repository.getUserActivity(guildId, req.params.userId));
  });

  app.get("/api/users/:userId/history", (req, res) => {
    const guildId = resolveGuildId(req, repository, config);
    if (!isSnowflake(req.params.userId) || !guildId) {
      res.status(400).json({ error: "Valid userId and guildId are required" });
      return;
    }

    res.json(repository.getUserHistory(guildId, req.params.userId));
  });

  app.get("/api/users/:userId/link", (req, res) => {
    const guildId = resolveGuildId(req, repository, config);
    if (!isSnowflake(req.params.userId) || !guildId) {
      res.status(400).json({ error: "Valid userId and guildId are required" });
      return;
    }

    res.json({
      guildId,
      userId: req.params.userId,
      minecraft: repository.getMinecraftLink(guildId, req.params.userId),
    });
  });

  app.get("/api/minecraft/:minecraftId/:view", (req, res) => {
    const { minecraftId, view } = req.params;
    const guildId = resolveGuildId(req, repository, config);

    if (!isMinecraftId(minecraftId) || !guildId) {
      res.status(400).json({ error: "Valid minecraftId and guildId are required" });
      return;
    }

    if (!["stats", "activity", "history", "link"].includes(view)) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const link = repository.findMinecraftLink(guildId, minecraftId);
    if (!link) {
      res.status(404).json({ error: "Minecraft account is not linked" });
      return;
    }

    if (view === "stats") {
      res.json({
        minecraft: link,
        stats: repository.getUserStats(guildId, link.user_id),
      });
      return;
    }

    if (view === "activity") {
      res.json({
        minecraft: link,
        activity: repository.getUserActivity(guildId, link.user_id),
      });
      return;
    }

    if (view === "history") {
      res.json({
        minecraft: link,
        history: repository.getUserHistory(guildId, link.user_id),
      });
      return;
    }

    res.json(link);
  });

  app.get("/api/rankings/:type", (req, res) => {
    const { type } = req.params;
    const guildId = resolveGuildId(req, repository, config);
    const period = req.query.period || "all";

    if (!["messages", "voice", "activity"].includes(type)) {
      res.status(404).json({ error: "Unknown ranking" });
      return;
    }
    if (guildId && !isSnowflake(guildId)) {
      res.status(400).json({ error: "Valid guildId is required" });
      return;
    }
    if (!["all", "week", "month"].includes(period)) {
      res.status(400).json({ error: "Valid period is required" });
      return;
    }

    res.json(repository.getRanking(type, { guildId, period }).slice(0, 100));
  });

  app.get("/api/guilds/:guildId/stats", (req, res) => {
    if (!isSnowflake(req.params.guildId)) {
      res.status(400).json({ error: "Valid guildId is required" });
      return;
    }

    res.json(repository.getGuildStats(req.params.guildId));
  });

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
