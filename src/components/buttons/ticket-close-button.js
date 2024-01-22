const { ButtonInteraction } = require("discord.js");
const {
  ModalBuilder,
  TextInputBuilder,
  ActionRowBuilder,
  TextInputStyle,
} = require("discord.js");
const ExtendedClient = require("../../class/ExtendedClient");

module.exports = {
  customId: "closeTicket",
  /**
   *
   * @param {ExtendedClient} client
   * @param {ButtonInteraction} interaction
   */
  run: async (client, interaction) => {
    const closeModal = new ModalBuilder()
      .setTitle("Cerrar el ticket")
      .setCustomId("closeTicketModal");

    const reason = new TextInputBuilder()
      .setCustomId("closeReasonTicket")
      .setRequired(true)
      .setPlaceholder("¿Cuál es el motivo por el que cierras el ticket?")
      .setLabel("Proporciona una razón para cerrarlo")
      .setStyle(TextInputStyle.Paragraph);

    const one = new ActionRowBuilder().addComponents(reason);
    closeModal.addComponents(one);
    await interaction.showModal(closeModal);
  },
};
