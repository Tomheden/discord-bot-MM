const { ModalBuilder, TextInputBuilder, ActionRowBuilder, TextInputStyle } = require("discord.js");

module.exports = {
  customId: "ticketClose",
  run: async (client, interaction) => {
    const modal = new ModalBuilder()
      .setTitle("Cerrar ticket")
      .setCustomId("closeTicketModal");

    const reason = new TextInputBuilder()
      .setCustomId("closeReasonTicket")
      .setRequired(true)
      .setLabel("Motivo del cierre:")
      .setStyle(TextInputStyle.Paragraph);

    modal.addComponents(new ActionRowBuilder().addComponents(reason));

    await interaction.showModal(modal);
  },
};
