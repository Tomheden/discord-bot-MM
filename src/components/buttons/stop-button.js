const {
  ButtonInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const ExtendedClient = require("../../class/ExtendedClient");

module.exports = {
  customId: "stopButton",
  /**
   *
   * @param {ExtendedClient} client
   * @param {ButtonInteraction} interaction
   */
  run: async (client, interaction) => {
    const message = interaction.message;
    const embedReceived = message.embeds.at(0);

    const embed = new EmbedBuilder()
      .setColor(embedReceived.color)
      .setTitle(embedReceived.title)
      .setThumbnail(embedReceived.thumbnail.url)
      .setDescription(
        embedReceived.description +
          `\n\n**${interaction.member.nickname}** ha finalizado la sesión\n`
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
        .setCustomId("skipButton")
        .setStyle(ButtonStyle.Primary)
        .setEmoji(`<:next:1199750568688746611>`)
        .setDisabled(true)
    );
    const queue = client.distube.getQueue(interaction);
    if (!queue)
      return interaction.reply({
        content: `✖️ | No hay nada sonando ahora mismo`,
        ephemeral: true,
      });
    queue.stop();
    message.edit({ embeds: [embed], components: [select] });
    interaction.reply({
      content: `<:stop:1199750571633152061> | Sesión finalizada`,
      ephemeral: true,
    });
  },
};
