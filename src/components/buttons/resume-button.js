const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");

const buildControls = (paused) =>
  new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("stopButton")
      .setEmoji("<:stop:1199750571633152061>")
      .setStyle(ButtonStyle.Danger),
    paused
      ? new ButtonBuilder()
          .setCustomId("resumeButton")
          .setEmoji("<:play:1199750566243483688>")
          .setStyle(ButtonStyle.Success)
      : new ButtonBuilder()
          .setCustomId("pauseButton")
          .setEmoji("<:pause:1199750570328719442>")
          .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("skipButton")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("<:next:1199750568688746611>")
  );

module.exports = {
  customId: "resumeButton",
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

    queue.resume();
    await interaction.update({
      components: [buildControls(false)],
    });
  },
};
