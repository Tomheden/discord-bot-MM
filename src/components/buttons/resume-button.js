const { ButtonInteraction, Embed } = require("discord.js");
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const ExtendedClient = require("../../class/ExtendedClient");

module.exports = {
  customId: "resumeButton",
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
          `\n\n**${interaction.member.displayName}** ha reanudado la canción\n`
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
        .setCustomId("pauseButton")
        .setEmoji(`<:pause:1199750570328719442>`)
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("skipButton")
        .setStyle(ButtonStyle.Primary)
        .setEmoji(`<:next:1199750568688746611>`)
    );

    if (!queue)
      return interaction.channel.send(`❌ | No hay nada sonando ahora mismo`);
    message.edit({ embeds: [embed], components: [select] });
    queue.resume();
    interaction.deferReply();
    interaction.deleteReply();
  },
};
