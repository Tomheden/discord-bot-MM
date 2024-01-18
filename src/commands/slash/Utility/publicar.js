const {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  ActionRowBuilder,
  TextInputStyle,
} = require("discord.js");
const ExtendedClient = require("../../../class/ExtendedClient");

module.exports = {
  structure: new SlashCommandBuilder()
    .setName("publicar")
    .setDescription("Crea una publicación o un anuncio"),
  /**
   * @param {ExtendedClient} client
   * @param {ChatInputCommandInteraction} interaction
   */
  run: async (client, interaction) => {
    const modal = new ModalBuilder()
      .setTitle("Crear una publicación")
      .setCustomId("publicacionModal");

    const titulo = new TextInputBuilder()
      .setCustomId("tituloPublicacion")
      .setRequired(true)
      .setLabel("Título de la publicación")
      .setStyle(TextInputStyle.Short);

    const texto = new TextInputBuilder()
      .setCustomId("textoPublicacion")
      .setRequired(true)
      .setPlaceholder("Contenido de la noticia")
      .setLabel("Breve descripción del evento/publicación")
      .setStyle(TextInputStyle.Paragraph);

    const one = new ActionRowBuilder().addComponents(titulo);
    const two = new ActionRowBuilder().addComponents(texto);

    modal.addComponents(one, two);
    await interaction.showModal(modal);
  },
};
