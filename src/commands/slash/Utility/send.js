const {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  ActionRowBuilder,
  TextInputStyle,
} = require("discord.js");
const ExtendedClient = require("../../../class/ExtendedClient");
const send = require("../../../schemas/SendSchema");

module.exports = {
  structure: new SlashCommandBuilder()
    .setName("send")
    .setDescription("Envia un mensaje como el bot")
    .addChannelOption((option) =>
      option
        .setName("canal")
        .setDescription("El canal al que se enviará el mensaje")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    ),
  /**
   * @param {ExtendedClient} client
   * @param {ChatInputCommandInteraction} interaction
   */
  run: async (client, interaction) => {
    const canal = interaction.options.getChannel("canal");
    const data = await send.findOne({ guild: interaction.guild.id });

    if (!data) {
      await send.create({
        guild: interaction.guild.id,
        channel: canal.id,
      });
    }
    const modal = new ModalBuilder()
      .setTitle("Enviar un mensaje")
      .setCustomId("mensajeModal");

    const texto = new TextInputBuilder()
      .setCustomId("mensaje")
      .setRequired(true)
      .setLabel("Contenido del mensaje")
      .setStyle(TextInputStyle.Paragraph);

    const one = new ActionRowBuilder().addComponents(texto);

    modal.addComponents(one);
    await interaction.showModal(modal);
  },
};
