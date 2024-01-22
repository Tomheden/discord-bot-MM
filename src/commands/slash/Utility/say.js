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

module.exports = {
  structure: new SlashCommandBuilder()
    .setName("say")
    .setDescription("Envia un mensaje como el bot")
    .addChannelOption((option) =>
      option
        .setName("canal")
        .setDescription("El canal al que se enviará el mensaje")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("mensaje")
        .setDescription("Contenido del mensaje a enviar")
        .setRequired(true)
    ),
  /**
   * @param {ExtendedClient} client
   * @param {ChatInputCommandInteraction} interaction
   */
  run: async (client, interaction) => {
    const canal = interaction.options.getChannel("canal");
    const mensaje = interaction.options.getString("mensaje");
    await interaction.reply({
      content: "Enviando el mensaje a " + canal.name,
      ephemeral: true,
    });
    canal.send({ content: mensaje });
  },
};
