const fs = require("fs");
const path = require("path");
const config = require("../config");

const ensureDataDir = () => {
  if (!fs.existsSync(config.dataDir)) {
    fs.mkdirSync(config.dataDir, { recursive: true });
  }
};

const getDataPath = (fileName) => {
  ensureDataDir();
  return path.join(config.dataDir, fileName);
};

const loadJson = (fileName, defaultValue) => {
  const filePath = getDataPath(fileName);
  if (!fs.existsSync(filePath)) {
    return defaultValue;
  }

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    return defaultValue;
  }
};

const saveJson = (fileName, data) => {
  const filePath = getDataPath(fileName);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
};

module.exports = {
  getDataPath,
  loadJson,
  saveJson,
};
