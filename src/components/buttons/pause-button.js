const { ButtonInteraction, MessageFlags } = require("discord.js");
const {
  buildControls,
  withLastAction,
} = require("../../services/music/playerMessage");

module.exports = {
  customId: "pauseButton",
  /**
   * @param {import('discord.js').Client} client
   * @param {ButtonInteraction} interaction
   */
  run: async (client, interaction) => {
    const queue = client.distube.getQueue(interaction);
    if (!queue) {
      await interaction.reply({
        content: "\u2716\uFE0F | No hay canciones en la cola",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    queue.pause();
    const embed = withLastAction(
      interaction.message,
      `${interaction.user} ha pausado la cancion`
    );
    await interaction.update({
      embeds: embed ? [embed] : undefined,
      components: [buildControls({ paused: true })],
    });
  },
};
