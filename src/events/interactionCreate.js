const { Events, MessageFlags } = require("discord.js");

module.exports = {
  event: Events.InteractionCreate,
  run: async (client, interaction) => {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) {
        return;
      }

      try {
        await command.run(client, interaction);
      } catch (error) {
        console.error(error);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: "Command failed.",
            flags: MessageFlags.Ephemeral,
          });
        }
      }

      return;
    }

    if (interaction.isButton()) {
      const handler = client.components.buttons.get(interaction.customId);
      if (!handler) {
        return;
      }

      try {
        await handler.run(client, interaction);
      } catch (error) {
        console.error(error);
      }

      return;
    }

    if (interaction.isModalSubmit()) {
      let handler = client.components.modals.get(interaction.customId);
      if (!handler && interaction.customId.startsWith("sendModal:")) {
        handler = client.components.modals.get("sendModal");
      }

      if (!handler) {
        return;
      }

      try {
        await handler.run(client, interaction);
      } catch (error) {
        console.error(error);
      }
    }
  },
};
