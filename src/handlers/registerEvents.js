const fs = require("fs");
const path = require("path");

const registerEvents = (client) => {
  const baseDir = path.join(__dirname, "..", "events");

  if (!fs.existsSync(baseDir)) {
    return;
  }

  for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".js")) {
      continue;
    }

    const eventModule = require(path.join(baseDir, entry.name));
    if (!eventModule || !eventModule.event || !eventModule.run) {
      continue;
    }

    if (eventModule.once) {
      client.once(eventModule.event, (...args) => eventModule.run(client, ...args));
    } else {
      client.on(eventModule.event, (...args) => eventModule.run(client, ...args));
    }
  }
};

module.exports = {
  registerEvents,
};
