const { SlashCommandBuilder, MessageFlags } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("leave")
    .setDescription("Desconecta al bot del canal de voz"),
  run: async (client, interaction) => {
    try {
      client.distube.voices.leave(interaction);
      await interaction.reply({
        content: "\u2705 | Desconectando...",
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      console.error(error);
      await interaction.reply({
        content: "\u274C | No pude desconectar al bot.",
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
