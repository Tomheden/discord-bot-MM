const { SlashCommandBuilder, ChannelType, MessageFlags } = require("discord.js");
const { isValidImageUrl } = require("../../utils/validators");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("image")
    .setDescription("Send an image as the bot")
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("Channel to send the image to")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("url")
        .setDescription("Image URL")
        .setRequired(true)
    ),
  run: async (client, interaction) => {
    let channel = interaction.options.getChannel("channel");
    if (!channel) {
      const fallback = interaction.options.data.find((option) => option.type === 7)?.value;
      channel = fallback ? interaction.guild.channels.cache.get(fallback) : null;
    }

    let url = interaction.options.getString("url")?.trim() ?? "";
    if (!url) {
      const fallback = interaction.options.data.find((option) => option.type === 3)?.value;
      url = typeof fallback === "string" ? fallback.trim() : "";
    }

    if (!channel) {
      await interaction.reply({
        content: "No pude resolver el canal para este comando.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.reply({
      content: `Sending image to ${channel.name}...`,
      flags: MessageFlags.Ephemeral,
    });

    if (!isValidImageUrl(url)) {
      await interaction.followUp({
        content: "The URL is not a valid image.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      await channel.send({ files: [{ attachment: url, name: "image.png" }] });
      await interaction.followUp({
        content: `Image sent to ${channel.name}.`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      console.error(error);
      await interaction.followUp({
        content: "Failed to send the image.",
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
