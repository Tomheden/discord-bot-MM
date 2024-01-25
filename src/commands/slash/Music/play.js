const {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} = require("discord.js");
const ExtendedClient = require("../../../class/ExtendedClient");

module.exports = {
  structure: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Reproduce música en el canal de voz que te encuentres")
    .addStringOption((option) =>
      option
        .setName("cancion")
        .setDescription("Enlace de la canción")
        .setRequired(true)
    ),
  /**
   * @param {ExtendedClient} client
   * @param {ChatInputCommandInteraction} interaction
   */
  run: async (client, interaction) => {
    if (!interaction.member.voice.channel) {
      interaction.reply({
        content: "❌ | Necesitas estar en un canal de voz",
        ephemeral: true,
      });
    } else {
      client.distube.play(
        interaction.member.voice.channel,
        interaction.options.getString("cancion"),
        {
          member: interaction.member,
          textChannel: interaction.channel,
          interaction,
        }
      );
      interaction.reply({
        content: `.`,
        ephemeral: true,
      });
      interaction.deleteReply();
    }
  },
};
