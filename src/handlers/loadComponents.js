const fs = require("fs");
const path = require("path");

const loadComponents = (client) => {
  const buttons = new Map();
  const modals = new Map();
  const baseDir = path.join(__dirname, "..", "components");

  const loadDir = (dirPath, target) => {
    if (!fs.existsSync(dirPath)) {
      return;
    }

    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".js")) {
        continue;
      }

      const fullPath = path.join(dirPath, entry.name);
      const component = require(fullPath);

      if (!component || !component.customId || !component.run) {
        continue;
      }

      target.set(component.customId, component);
    }
  };

  loadDir(path.join(baseDir, "buttons"), buttons);
  loadDir(path.join(baseDir, "modals"), modals);

  if (client) {
    client.components = { buttons, modals };
  }

  return { buttons, modals };
};

module.exports = {
  loadComponents,
};
