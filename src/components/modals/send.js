const { EmbedBuilder, MessageFlags } = require("discord.js");

module.exports = {
  customId: "sendModal",
  run: async (client, interaction) => {
    const text = interaction.fields.getTextInputValue("mensaje");
    const channelId = interaction.customId.split(":")[1];
    const channel = interaction.guild.channels.cache.get(channelId);

    if (!channel) {
      await interaction.reply({
        content: "Channel not found for this send request.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const embed = new EmbedBuilder().setColor("#c2c2c2").setDescription(text);

    await channel.send({ embeds: [embed] });
    await interaction.reply({
      content: `Message sent to ${channel.name}.`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
