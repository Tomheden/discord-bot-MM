const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("shuffle")
    .setDescription("Mezcla las canciones de la cola"),
  run: async (client, interaction) => {
    const queue = client.distube.getQueue(interaction);
    if (!queue) {
      await interaction.reply({
        content: "\u2716\uFE0F | No hay canciones en la cola",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await queue.shuffle();

    const embed = new EmbedBuilder()
      .setColor("Blurple")
      .setTitle("<:shuffle:1199843612956053635> Canciones de la cola mezcladas")
      .setDescription("El orden de las canciones es aleatorio")
      .setFooter({
        text: `Solicitado por ${interaction.member.displayName}`,
        iconURL: interaction.member.displayAvatarURL({ dynamic: true }),
      });

    await interaction.channel.send({ embeds: [embed] });
    await interaction.reply({
      content: "\u2705 | Cola mezclada",
      flags: MessageFlags.Ephemeral,
    });
  },
};
