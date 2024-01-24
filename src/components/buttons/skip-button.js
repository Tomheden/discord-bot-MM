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

    const embed = new EmbedBuilder()
      .setColor(embedReceived.color)
      .setTitle(embedReceived.title)
      .setThumbnail(embedReceived.thumbnail.url)
      .setDescription(
        embedReceived.description +
          `\n\n**${interaction.member.nickname}** ha saltado la canción\n`
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

    if (!queue)
      return interaction.channel.send({
        content: `❌ | No hay nada sonando ahora mismo`,
        ephemeral: true,
      });
    try {
      if (queue.songs.length <= 1) {
        interaction.reply({
          content: `❌ | No hay más canciones para saltar, parando la actual...`,
          ephemeral: true,
        });
        message.edit({ embeds: [embed], components: [select] });
        queue.stop();
      } else {
        const song = await queue.skip();
        interaction.reply({
          content: `✔️ | Saltando la canción...`,
          ephemeral: true,
        });
        message.edit({ embeds: [embed], components: [select] });
      }
    } catch (e) {
      interaction.reply(`❌ | ${e}`);
    }
  },
};
