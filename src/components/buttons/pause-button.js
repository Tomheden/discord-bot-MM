const { ButtonInteraction, Embed } = require("discord.js");
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const ExtendedClient = require("../../class/ExtendedClient");

module.exports = {
  customId: "pauseButton",
  /**
   *
   * @param {ExtendedClient} client
   * @param {ButtonInteraction} interaction
   */
  run: async (client, interaction) => {
    const queue = client.distube.getQueue(interaction);
    const message = interaction.message;
    const embedReceived = message.embeds.at(0);

    const embed = new EmbedBuilder()
      .setColor(embedReceived.color)
      .setTitle(embedReceived.title)
      .setThumbnail(embedReceived.thumbnail.url)
      .setDescription(
        embedReceived.description +
          `\n\n**${interaction.member.displayName}** ha pausado la canción\n`
      )
      .setFooter({
        text: embedReceived.footer.text,
        iconURL: embedReceived.footer.iconURL,
      });

    const select = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("stopButton")
        .setEmoji(`<:stop:1199750571633152061>`)
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("resumeButton")
        .setEmoji(`<:play:1199750566243483688>`)
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("skipButton")
        .setStyle(ButtonStyle.Primary)
        .setEmoji(`<:next:1199750568688746611>`)
    );

    if (!queue)
      return interaction.channel.send(`❌ | No hay nada sonando ahora mismo`);
    message.edit({ embeds: [embed], components: [select] });
    queue.pause();
    interaction.reply({
      content: `Pausando la canción...`,
      ephemeral: true,
    });
    interaction.deleteReply();
  },
};
