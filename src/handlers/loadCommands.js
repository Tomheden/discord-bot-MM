const fs = require("fs");
const path = require("path");

const loadCommands = (client, options = {}) => {
  const { allowedCategories } = options;
  const commands = new Map();
  const commandData = [];
  const baseDir = path.join(__dirname, "..", "commands");

  const loadDir = (dirPath) => {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        loadDir(fullPath);
        continue;
      }

      if (!entry.name.endsWith(".js")) {
        continue;
      }
      if (Array.isArray(allowedCategories) && allowedCategories.length > 0) {
        const relativePath = path.relative(baseDir, fullPath);
        const category = relativePath.split(path.sep)[0];

        if (!allowedCategories.includes(category)) {
          continue;
        }
      }

      const command = require(fullPath);
      if (!command || !command.data || !command.run) {
        continue;
      }

      commands.set(command.data.name, command);
      commandData.push(command.data.toJSON());
    }
  };

  if (fs.existsSync(baseDir)) {
    loadDir(baseDir);
  }

  if (client) {
    client.commands = commands;
    client.commandData = commandData;
  }

  return { commands, commandData };
};

module.exports = {
  loadCommands,
};


