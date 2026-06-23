const { StatsRepository } = require("./statsRepository");

// Buffered service: Discord events enqueue metadata here and disk writes happen in batches.
class StatsService {
  constructor(options = {}) {
    this.repository = options.repository || new StatsRepository(options);
    this.flushIntervalMs = options.flushIntervalMs || 30000;
    this.queue = [];
    this.flushTimer = null;
    this.isFlushing = false;
  }

  init() {
    this.repository.init();

    this.flushTimer = setInterval(() => {
      this.flush();
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

  flush() {
    if (this.isFlushing || this.queue.length === 0) {
      return;
    }

    this.isFlushing = true;
    const events = this.queue.splice(0, this.queue.length);

    try {
      for (const event of events) {
        this.applyEvent(event.type, event.payload);
      }
      this.repository.save();
    } catch (error) {
      this.queue.unshift(...events);
      console.error("[stats] Flush failed:", error);
    } finally {
      this.isFlushing = false;
    }
  }

  shutdown() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    this.flush();
  }

  applyEvent(type, payload) {
    const handlers = {
      message: () => this.repository.recordMessage(payload),
      interaction: () => this.repository.recordInteraction(payload),
      memberJoin: () => this.repository.recordMemberJoin(payload),
      memberLeave: () => this.repository.recordMemberLeave(payload),
      voiceJoin: () => this.repository.recordVoiceJoin(payload),
      voiceLeave: () => this.repository.recordVoiceLeave(payload),
    };

    if (handlers[type]) {
      handlers[type]();
    }
  }
}

const createStatsService = (config = {}) => {
  const statsConfig = config.stats || {};

  return new StatsService({
    fileName: statsConfig.dataFile || process.env.STATS_DATA_FILE || "stats.json",
    flushIntervalMs: Number(
      statsConfig.flushIntervalMs || process.env.STATS_FLUSH_INTERVAL_MS || 30000
    ),
  });
};

module.exports = {
  StatsService,
  createStatsService,
};
