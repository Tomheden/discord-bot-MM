const {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} = require("discord.js");
const ExtendedClient = require("../../../class/ExtendedClient");

module.exports = {
  structure: new SlashCommandBuilder()
    .setName("shuffle")
    .setDescription("Mezcla las canciones de la cola"),
  /**
   * @param {ExtendedClient} client
   * @param {ChatInputCommandInteraction} interaction
   */
  run: async (client, interaction) => {
    const embed = new EmbedBuilder()
      .setColor("Blurple")
      .setTitle(`<:shuffle:1199843612956053635> Canciones de la cola mezcladas`)
      .setDescription(`El orden de las canciones es aleatorio`)
      .setFooter({
        text: `Solicitado por ${interaction.member.displayName}`,
        iconURL: interaction.member.displayAvatarURL({ dynamic: true }),
      });
    const queue = client.distube.getQueue(interaction);
    if (!queue) {
      interaction.reply({
        content: `✖️ | No hay canciones en la cola`,
        ephemeral: true,
      });
    } else {
      await queue.shuffle();
      await interaction.channel.send({ embeds: [embed] });
      interaction.deferReply();
      interaction.deleteReply();
    }
  },
};
