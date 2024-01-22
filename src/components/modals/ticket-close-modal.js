const { ModalSubmitInteraction } = require("discord.js");
const { EmbedBuilder } = require("discord.js");
const ExtendedClient = require("../../class/ExtendedClient");
const { createTranscript } = require("discord-html-transcripts");

module.exports = {
  customId: "closeTicketModal",
  /**
   *
   * @param {ExtendedClient} client
   * @param {ModalSubmitInteraction} interaction
   */
  run: async (client, interaction) => {
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
  },
};
