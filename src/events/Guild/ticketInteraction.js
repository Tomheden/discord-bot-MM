const {
  ModalBuilder,
  TextInputBuilder,
  ActionRowBuilder,
  TextInputStyle,
  ChannelType,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
} = require("discord.js");
const ticket = require("../../schemas/TicketSchema");
const { createTranscript } = require("discord-html-transcripts");

module.exports = {
  event: "interactionCreate",
  /**
   *
   * @param {ExtendedClient} client
   * @param {import('discord.js').Interaction} interaction
   * @returns
   */
  run: async (client, interaction) => {
    if (interaction.customId == "ticketCreateSelect") {
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
    } else if (interaction.customId == "ticketModal") {
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
    } else if (interaction.customId == "closeTicket") {
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
    } else if (interaction.customId == "closeTicketModal") {
      var channel = interaction.channel;
      var name = channel.name;
      name = name.replace("ticket-", "");
      const member = await interaction.guild.members.cache.get(name);

      // CREAMOS EL TRANSCRIPT
      const file = await createTranscript(interaction.channel, {
        limit: -1,
        returnBuffer: false,
        filename: `${interaction.channel.name}.html`,
      });

      // LO ALMACENAMOS EN CHAT
      const idCanalTickets = "1113929288413085790";
      const idCanalTranscripts = "1196950588710207488";
      const canalTickets = client.channels.cache.get(idCanalTickets);
      const canalTranscipts = client.channels.cache.get(idCanalTranscripts);
      var msg = await canalTranscipts.send({
        content: "Transcripcion del ticket: ",
        files: [file],
      });

      // Y LO PASAMOS A UNA VARIABLE
      const embed = new EmbedBuilder()
        .setColor("Blurple")
        .setTitle(`🎫 Ticket creado por ${member.user}`)
        .setDescription(
          `**URL: ** https://mahto.id/chat-exporter?url=${
            msg.attachments.first()?.url
          }`
        )
        .setThumbnail(member.displayAvatarURL({ dynamic: true }))
        .setTimestamp();
      canalTickets.send({ embeds: [embed] });

      const reason = interaction.fields.getTextInputValue("closeReasonTicket");
      await interaction.reply({
        content: `🔒 Este ticket se cerrará en unos segundos...`,
      });

      setTimeout(async () => {
        //BORRAMOS EL CANAL
        await channel.delete().catch((err) => {});

        //MANDAMOS DM AL USUARIO
        await member
          .send(
            `📢 Te informamos de que tu ticket de **${interaction.guild.name}** se ha cerrado con motivo de: \`${reason}\``
          )
          .catch((err) => {});
      }, 5000);
    }
  },
};
