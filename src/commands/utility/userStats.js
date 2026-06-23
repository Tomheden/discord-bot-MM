const {
  ApplicationCommandType,
  ContextMenuCommandBuilder,
  MessageFlags,
} = require("discord.js");
const { buildUserStatsEmbed } = require("../../services/stats/statsDiscordPresenter");

module.exports = {
  data: new ContextMenuCommandBuilder()
    .setName("Ver stats")
    .setType(ApplicationCommandType.User),
  run: async (client, interaction) => {
    if (!client.stats || !interaction.guild) {
      await interaction.reply({
        content: "Las estadisticas no estan disponibles.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    client.stats.flush();

    const embed = buildUserStatsEmbed({
      repository: client.stats.repository,
      guildId: interaction.guild.id,
      user: interaction.targetUser,
    });

    await interaction.reply({
      embeds: [embed],
      flags: MessageFlags.Ephemeral,
    });
  },
};
