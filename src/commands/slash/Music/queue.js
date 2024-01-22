const {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} = require("discord.js");
const ExtendedClient = require("../../../class/ExtendedClient");

module.exports = {
  structure: new SlashCommandBuilder()
    .setName("queue")
    .setDescription("Consulta la cola de canciones"),
  /**
   * @param {ExtendedClient} client
   * @param {ChatInputCommandInteraction} interaction
   */
  run: async (client, interaction) => {
    const queue = client.distube.getQueue(interaction);
    if (!queue) return interaction.reply(`❌ | No hay nada sonando ahora`);
    const q = queue.songs
      .slice(0, 11)
      .map(
        (song, i) =>
          `${i === 0 ? "*Sonando*:" : `${i}.`} \`${song.name}\` - \`${
            song.formattedDuration
          }\``
      )
      .join("\n");

    await interaction.reply(
      `📄 | **Lista de las 10 próximas canciones en cola**\n${q}`
    );
  },
};
