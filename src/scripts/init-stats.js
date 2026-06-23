require("dotenv").config();

const config = require("../config");
const { StatsRepository } = require("../services/stats/statsRepository");

// Creates or migrates the local stats file without starting Discord.
const repository = new StatsRepository({
  fileName: config.stats?.dataFile || process.env.STATS_DATA_FILE || "stats.json",
});

repository.init();

console.log(
  `[stats] Initialized ${config.stats?.dataFile || process.env.STATS_DATA_FILE || "stats.json"}`
);
