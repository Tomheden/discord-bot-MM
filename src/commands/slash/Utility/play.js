const {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} = require("discord.js");
const ExtendedClient = require("../../../class/ExtendedClient");
const { DisTube } = require("distube");
const { YtDlpPlugin } = require("@distube/yt-dlp");

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
    client.distube = new DisTube(client, {
      leaveOnStop: false,
      emitNewSongOnly: true,
      emitAddSongWhenCreatingQueue: false,
      emitAddListWhenCreatingQueue: false,
      plugins: [new YtDlpPlugin()],
    });
    if (!interaction.member.voice.channel) {
      return interaction.reply({
        content: "✖️ | Necesitas estar en un canal de voz",
        ephemeral: true,
      });
    }
    await client.distube.play(
      interaction.member.voice.channel,
      interaction.options.getString("cancion"),
      {
        member: interaction.member,
        textChannel: interaction.channel,
        interaction,
      }
    );
    await interaction.reply(`✔️ | Añadiendo la canción...`);
  },
};
