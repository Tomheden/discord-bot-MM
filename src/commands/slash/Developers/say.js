const {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  AttachmentBuilder,
} = require("discord.js");
const ExtendedClient = require("../../../class/ExtendedClient");

module.exports = {
  structure: new SlashCommandBuilder()
    .setName("say")
    .setDescription("Manda un mensaje como el bot.")
    .addStringOption((option) =>
      option
        .setName("mensaje")
        .setDescription("El mensaje a enviar por el bot.")
        .setRequired(true)
    ),
  options: {
    developers: true,
  },
  /**
   * @param {ExtendedClient} client
   * @param {ChatInputCommandInteraction<true>} interaction
   */
  run: async (client, interaction, args) => {
    await interaction.deferReply();

    const msg = interaction.options.getString("mensaje");
    interaction.channels.cache.get(channels.get(id));
  },
};
