const {
  ApplicationIntegrationType,
  ApplicationCommandType,
  ContextMenuCommandBuilder,
  InteractionContextType,
  MessageFlags,
} = require("discord.js");
const { buildUserStatsEmbed } = require("../../services/stats/statsDiscordPresenter");

module.exports = {
  data: new ContextMenuCommandBuilder()
    .setName("Ver stats")
    .setType(ApplicationCommandType.User)
    .setDMPermission(false)
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild),
  run: async (client, interaction) => {
    if (!client.stats || !interaction.guild) {
      await interaction.reply({
        content: "Las estadisticas no estan disponibles.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await client.stats.flush();

    const embed = await buildUserStatsEmbed({
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
