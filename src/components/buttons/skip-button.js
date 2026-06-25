const { ButtonInteraction, MessageFlags } = require("discord.js");
const {
  buildControls,
  withLastAction,
} = require("../../services/music/playerMessage");

module.exports = {
  customId: "skipButton",
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

    const embed = withLastAction(
      interaction.message,
      `${interaction.user} ha saltado la cancion actual.`
    );
    if (queue.songs.length <= 1) {
      queue.stop();
      await interaction.update({
        embeds: embed ? [embed] : undefined,
        components: [buildControls({ paused: queue.paused, disabled: true })],
      });
      return;
    }

    await interaction.update({
      embeds: embed ? [embed] : undefined,
      components: [buildControls({ paused: queue.paused, disabled: true })],
    });
    await queue.skip();
  },
};
