require("dotenv").config();

const config = require("../config");
const { StatsRepository } = require("../services/stats/statsRepository");
const {
  MySqlStatsRepository,
  shouldUseMySqlStats,
} = require("../services/stats/mysqlStatsRepository");

// Creates or migrates the configured stats storage without starting Discord.
const run = async () => {
  const repository = shouldUseMySqlStats(config.stats)
    ? new MySqlStatsRepository(config.stats?.database || {})
    : new StatsRepository({
        fileName: config.stats?.dataFile || process.env.STATS_DATA_FILE || "stats.json",
      });

  await repository.init();
  await repository.save();

  if (repository.close) {
    await repository.close();
  }

  console.log(
    shouldUseMySqlStats(config.stats)
      ? "[stats] Initialized MySQL stats schema."
      : `[stats] Initialized ${config.stats?.dataFile || process.env.STATS_DATA_FILE || "stats.json"}`
  );
};

run().catch((error) => {
  console.error("[stats] Init failed:", error);
  process.exit(1);
});
