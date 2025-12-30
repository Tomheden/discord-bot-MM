const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, ActionRowBuilder, TextInputStyle } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("publicar")
    .setDescription("Crea una publicación."),
  run: async (client, interaction) => {
    const modal = new ModalBuilder()
      .setTitle("Create announcement")
      .setCustomId("publicacionModal");

    const titleInput = new TextInputBuilder()
      .setCustomId("tituloPublicacion")
      .setRequired(true)
      .setLabel("Titulo")
      .setStyle(TextInputStyle.Short);

    const textInput = new TextInputBuilder()
      .setCustomId("textoPublicacion")
      .setRequired(true)
      .setLabel("Descripcion")
      .setStyle(TextInputStyle.Paragraph);

    modal.addComponents(
      new ActionRowBuilder().addComponents(titleInput),
      new ActionRowBuilder().addComponents(textInput)
    );

    await interaction.showModal(modal);
  },
};
