const { ModalSubmitInteraction } = require("discord.js");
const {
  ActionRowBuilder,
  ChannelType,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
} = require("discord.js");
const ticket = require("../../schemas/TicketSchema");
const ExtendedClient = require("../../class/ExtendedClient");

module.exports = {
  customId: "ticketModal",
  /**
   *
   * @param {ExtendedClient} client
   * @param {ModalSubmitInteraction} interaction
   */
  run: async (client, interaction) => {
    const user = interaction.user;
    const data = await ticket.findOne({ guild: interaction.guild.id });
    if (!data)
      return await interaction.reply({
        content:
          "Lo sentimos, parace que has encontrado este mensaje pero el sistema de tickets no esta listo aún",
        ephemeral: true,
      });
    else {
      const why = interaction.fields.getTextInputValue("whyTicket");
      const info = interaction.fields.getTextInputValue("infoTicket");
      const categoria = await interaction.guild.channels.cache.get(
        data.category
      );
      const channel = await interaction.guild.channels.create({
        name: `ticket-${user.id}`,
        type: ChannelType.GuildText,
        topic: `Ticket de usuario: ${user.username}; Motivo: ${why}`,
        parent: categoria,
        permissionOverwrites: [
          {
            id: interaction.guild.id,
            deny: [PermissionsBitField.Flags.ViewChannel],
          },
          {
            id: interaction.user.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
            ],
          },
          {
            id: "624320666644250644",
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
            ],
          },
          {
            id: "624320529699962890",
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
            ],
          },
        ],
      });
      const embed = new EmbedBuilder()
        .setColor("Blurple")
        .setTitle(`🎫 Ticket creado por ${user.username}`)
        .setDescription(
          `Motivo de apertura: ${why}\n\nInformación adicional: ${info}`
        )
        .setTimestamp();
      const button = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("closeTicket")
          .setLabel(`🔒 Cerrar ticket`)
          .setStyle(ButtonStyle.Danger)
      );
      await channel.send({ embeds: [embed], components: [button] });
      await interaction.reply({
        content: `✨ Ticket abierto en ${channel}`,
        ephemeral: true,
      });
    }
  },
};
