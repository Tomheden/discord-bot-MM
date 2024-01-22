const {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} = require("discord.js");
const ExtendedClient = require("../../../class/ExtendedClient");

module.exports = {
  structure: new SlashCommandBuilder()
    .setName("skip")
    .setDescription("Salta la canción actual"),
  /**
   * @param {ExtendedClient} client
   * @param {ChatInputCommandInteraction} interaction
   */
  run: async (client, interaction) => {
    const queue = client.distube.getQueue(message);
    if (!queue)
      return interction.channel.send(`❌ | No hay nada sonando ahora mismo`);
    try {
      if (queue.songs.length <= 1) {
        interaction.reply(
          `❌ | No hay más canciones para saltar, parando la actual...`
        );
        queue.stop();
      } else {
        const song = await queue.skip();
        interaction.reply(`✔️ | Saltando la canción...`);
      }
    } catch (e) {
      interaction.reply(`❌ | ${e}`);
    }
  },
};
