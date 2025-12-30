const { ModalBuilder, TextInputBuilder, ActionRowBuilder, TextInputStyle } = require("discord.js");

module.exports = {
  customId: "ticketCreate",
  run: async (client, interaction) => {
    const modal = new ModalBuilder()
      .setTitle("Open a ticket")
      .setCustomId("ticketModal");

    const why = new TextInputBuilder()
      .setCustomId("whyTicket")
      .setRequired(true)
      .setLabel("¿Con qué necesitas ayuda?")
      .setStyle(TextInputStyle.Paragraph);

    const info = new TextInputBuilder()
      .setCustomId("infoTicket")
      .setRequired(false)
      .setLabel("Información adicional")
      .setStyle(TextInputStyle.Paragraph);

    modal.addComponents(
      new ActionRowBuilder().addComponents(why),
      new ActionRowBuilder().addComponents(info)
    );

    await interaction.showModal(modal);
  },
};
