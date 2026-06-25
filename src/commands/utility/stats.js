const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { buildUserStatsEmbed } = require("../../services/stats/statsDiscordPresenter");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("stats")
    .setDescription("Muestra las estadisticas de un usuario")
    .addUserOption((option) =>
      option
        .setName("usuario")
        .setDescription("Usuario a consultar")
        .setRequired(false)
    )
    .addBooleanOption((option) =>
      option
        .setName("privado")
        .setDescription("Muestra la respuesta solo para ti")
        .setRequired(false)
    ),
  run: async (client, interaction) => {
    if (!client.stats || !interaction.guild) {
      await interaction.reply({
        content: "Las estadisticas no estan disponibles.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await client.stats.flush();

    const targetUser = interaction.options.getUser("usuario") || interaction.user;
    const isPrivate = interaction.options.getBoolean("privado") || false;
    const embed = await buildUserStatsEmbed({
      repository: client.stats.repository,
      guildId: interaction.guild.id,
      user: targetUser,
    });

    await interaction.reply({
      embeds: [embed],
      flags: isPrivate ? MessageFlags.Ephemeral : undefined,
    });
  },
};
