const { readdirSync } = require("fs");
const { log } = require("../functions");
const ExtendedClient = require("../class/ExtendedClient");
const path = require("path");

// Importar el comando de cumpleaños
const birthdayCommandPath = path.join(__dirname, "../commands/slash/Utility/bday.js");
const { registerBirthdayCron } = require(birthdayCommandPath);

/**
 * 
 * @param {ExtendedClient} client 
 */
module.exports = (client) => {
  // Cargar comandos de forma dinámica
  for (const type of readdirSync("./src/commands/")) {
    for (const dir of readdirSync("./src/commands/" + type)) {
      for (const file of readdirSync("./src/commands/" + type + "/" + dir).filter(f => f.endsWith(".js"))) {
        const module = require("../commands/" + type + "/" + dir + "/" + file);

        if (!module) continue;

        if (type === "prefix") {
          if (!module.structure?.name || !module.run) {
            log(
              "Unable to load the command " + file + " due to missing 'structure#name' or/and 'run' properties.",
              "warn"
            );
            continue;
          }

          client.collection.prefixcommands.set(module.structure.name, module);

          if (module.structure.aliases && Array.isArray(module.structure.aliases)) {
            module.structure.aliases.forEach(alias => {
              client.collection.aliases.set(alias, module.structure.name);
            });
          }
        } else {
          if (!module.structure?.name || !module.run) {
            log(
              "Unable to load the command " + file + " due to missing 'structure#name' or/and 'run' properties.",
              "warn"
            );
            continue;
          }

          client.collection.interactioncommands.set(module.structure.name, module);
          client.applicationcommandsArray.push(module.structure);
        }

        log("Loaded new command: " + file, "info");
      }
    }
  }

  // Registrar la tarea cron de cumpleaños después de cargar todos los comandos
  try {
    registerBirthdayCron(client);
    log("Birthday cron job registered successfully.", "info");
  } catch (error) {
    log("Failed to register birthday cron job: " + error.message, "error");
  }
};
