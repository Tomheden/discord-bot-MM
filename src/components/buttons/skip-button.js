const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");

const buildDisabledControls = (paused) =>
  new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("stopButton")
      .setEmoji("<:stop:1199750571633152061>")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(true),
    paused
      ? new ButtonBuilder()
          .setCustomId("resumeButton")
          .setEmoji("<:play:1199750566243483688>")
          .setStyle(ButtonStyle.Success)
          .setDisabled(true)
      : new ButtonBuilder()
          .setCustomId("pauseButton")
          .setEmoji("<:pause:1199750570328719442>")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
    new ButtonBuilder()
      .setCustomId("skipButton")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("<:next:1199750568688746611>")
      .setDisabled(true)
  );

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

    if (queue.songs.length <= 1) {
      queue.stop();
      await interaction.update({
        components: [buildDisabledControls(queue.paused)],
      });
      return;
    }

    await interaction.deferUpdate();
    queue.skip();
  },
};
