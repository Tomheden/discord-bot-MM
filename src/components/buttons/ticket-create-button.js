const { ButtonInteraction } = require("discord.js");
const {
  ModalBuilder,
  TextInputBuilder,
  ActionRowBuilder,
  TextInputStyle,
} = require("discord.js");
const ExtendedClient = require("../../class/ExtendedClient");

module.exports = {
  customId: "ticketCreateSelect",
  /**
   *
   * @param {ExtendedClient} client
   * @param {ButtonInteraction} interaction
   */
  run: async (client, interaction) => {
    const modal = new ModalBuilder()
      .setTitle("Crea un ticket")
      .setCustomId("ticketModal");

    const why = new TextInputBuilder()
      .setCustomId("whyTicket")
      .setRequired(true)
      .setPlaceholder("Explica por qué quieres contactar con el staff")
      .setLabel("¿Con qué podemos ayudarte?")
      .setStyle(TextInputStyle.Paragraph);

    const info = new TextInputBuilder()
      .setCustomId("infoTicket")
      .setRequired(false)
      .setPlaceholder("Puedes dejar esto en blanco")
      .setLabel("Proporciona cualquier info adicional")
      .setStyle(TextInputStyle.Paragraph);

    const one = new ActionRowBuilder().addComponents(why);
    const two = new ActionRowBuilder().addComponents(info);

    modal.addComponents(one, two);
    await interaction.showModal(modal);
  },
};
