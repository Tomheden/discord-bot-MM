const { StatsRepository } = require("./statsRepository");
const {
  MySqlStatsRepository,
  shouldUseMySqlStats,
} = require("./mysqlStatsRepository");

// Buffered service: Discord events enqueue metadata here and disk writes happen in batches.
class StatsService {
  constructor(options = {}) {
    this.repository = options.repository || new StatsRepository(options);
    this.flushIntervalMs = options.flushIntervalMs || 30000;
    this.queue = [];
    this.flushTimer = null;
    this.isFlushing = false;
  }

  async init() {
    await this.repository.init();

    this.flushTimer = setInterval(() => {
      this.flush().catch((error) => {
        console.error("[stats] Scheduled flush failed:", error);
      });
    }, this.flushIntervalMs);

    if (this.flushTimer.unref) {
      this.flushTimer.unref();
    }
  }

  enqueue(type, payload) {
    if (!type || !payload) {
      return;
    }

    this.queue.push({
      type,
      payload: {
        ...payload,
        timestamp: payload.timestamp || new Date().toISOString(),
      },
    });
  }

  async flush() {
    if (this.isFlushing || this.queue.length === 0) {
      return;
    }

    this.isFlushing = true;
    const events = this.queue.splice(0, this.queue.length);

    try {
      for (const event of events) {
        await this.applyEvent(event.type, event.payload);
      }
      await this.repository.save();
    } catch (error) {
      this.queue.unshift(...events);
      console.error("[stats] Flush failed:", error);
    } finally {
      this.isFlushing = false;
    }
  }

  async shutdown() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    await this.flush();
    if (this.repository.close) {
      await this.repository.close();
    }
  }

  async applyEvent(type, payload) {
    const handlers = {
      message: () => this.repository.recordMessage(payload),
      interaction: () => this.repository.recordInteraction(payload),
      memberJoin: () => this.repository.recordMemberJoin(payload),
      memberLeave: () => this.repository.recordMemberLeave(payload),
      voiceJoin: () => this.repository.recordVoiceJoin(payload),
      voiceLeave: () => this.repository.recordVoiceLeave(payload),
      reaction: () => this.repository.recordReaction?.(payload),
    };

    if (handlers[type]) {
      await handlers[type]();
    }
  }
}

const createStatsService = (config = {}) => {
  const statsConfig = config.stats || {};

  const repository = shouldUseMySqlStats(statsConfig)
    ? new MySqlStatsRepository(statsConfig.database || {})
    : new StatsRepository({
        fileName: statsConfig.dataFile || process.env.STATS_DATA_FILE || "stats.json",
      });

  return new StatsService({
    repository,
    flushIntervalMs: Number(
      statsConfig.flushIntervalMs || process.env.STATS_FLUSH_INTERVAL_MS || 30000
    ),
  });
};

module.exports = {
  StatsService,
  createStatsService,
};
