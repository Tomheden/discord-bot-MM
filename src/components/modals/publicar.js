const { EmbedBuilder, MessageFlags } = require("discord.js");
const config = require("../../config");

module.exports = {
  customId: "publicacionModal",
  run: async (client, interaction) => {
    const title = interaction.fields.getTextInputValue("tituloPublicacion");
    const text = interaction.fields.getTextInputValue("textoPublicacion");

    const role = interaction.guild.roles.cache.get(config.roles.announcements);
    const announcementsChannel = client.channels.cache.get(config.channels.announcements);

    if (!announcementsChannel) {
      await interaction.reply({
        content: "Announcement channel not found.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await announcementsChannel.send(`**NUEVA PUBLICACIÓN** ${role ?? ""}`.trim());
    await announcementsChannel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle(title.toUpperCase())
          .setDescription(text)
          .setColor("#44cad4"),
      ],
    });

    await interaction.reply({
      content: "Anuncio creado.",
      flags: MessageFlags.Ephemeral,
    });
  },
};
