const { ButtonInteraction, Embed } = require("discord.js");
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const ExtendedClient = require("../../class/ExtendedClient");

module.exports = {
  customId: "skipButton",
  /**
   *
   * @param {ExtendedClient} client
   * @param {ButtonInteraction} interaction
   */
  run: async (client, interaction) => {
    const queue = client.distube.getQueue(interaction);
    const message = interaction.message;
    const embedReceived = message.embeds.at(0);

    var pauseOrResume = "pauseButton";
    var buttonPauseOrResume = "<:pause:1199750570328719442>";
    var buttonColor = ButtonStyle.Secondary;
    if (queue.paused) {
      pauseOrResume = "resumeButton";
      buttonPauseOrResume = "<:play:1199750566243483688>";
      buttonColor = ButtonStyle.Success;
    }

    const embed = new EmbedBuilder()
      .setColor(embedReceived.color)
      .setTitle(embedReceived.title)
      .setThumbnail(embedReceived.thumbnail.url)
      .setDescription(
        embedReceived.description +
          `\n\n**${interaction.member.displayName}** ha saltado la canción\n`
      )
      .setFooter({
        text: embedReceived.footer.text,
        iconURL: embedReceived.footer.iconURL,
      });

    const select = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("stopButton")
        .setEmoji(`<:stop:1199750571633152061>`)
        .setStyle(ButtonStyle.Danger)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(pauseOrResume)
        .setEmoji(buttonPauseOrResume)
        .setStyle(buttonColor)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId("skipButton")
        .setStyle(ButtonStyle.Primary)
        .setEmoji(`<:next:1199750568688746611>`)
        .setDisabled(true)
    );

    if (!queue)
      return interaction.channel.send({
        content: `❌ | No hay nada sonando ahora mismo`,
      });
    try {
      if (queue.songs.length <= 1) {
        message.edit({
          embeds: [
            embed.setDescription(
              embedReceived.description +
                `\n\n**${interaction.member.displayName}** ha saltado la canción, sesión finalizada.\n`
            ),
          ],
          components: [select],
        });
        queue.stop();
        interaction.deferReply();
        interaction.deleteReply();
      } else {
        if (queue.paused) queue.resume();
        await message.edit({ embeds: [embed], components: [select] });
        const song = await queue.skip();
        interaction.deferReply();
        interaction.deleteReply();
      }
    } catch (e) {
      interaction.reply(`❌ | ${e}`);
    }
  },
};
