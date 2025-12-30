const {
  SlashCommandBuilder,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  ActionRowBuilder,
  TextInputStyle,
  MessageFlags,
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("send")
    .setDescription("Send a message as the bot")
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("Channel to send the message to")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    ),
  run: async (client, interaction) => {
    let channel = interaction.options.getChannel("channel");
    if (!channel) {
      const fallback = interaction.options.data.find((option) => option.type === 7)?.value;
      channel = fallback ? interaction.guild.channels.cache.get(fallback) : null;
    }
    if (!channel) {
      await interaction.reply({
        content: "No pude resolver el canal para este comando.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const modal = new ModalBuilder()
      .setTitle("Send a message")
      .setCustomId(`sendModal:${channel.id}`);

    const textInput = new TextInputBuilder()
      .setCustomId("mensaje")
      .setRequired(true)
      .setLabel("Message")
      .setStyle(TextInputStyle.Paragraph);

    modal.addComponents(new ActionRowBuilder().addComponents(textInput));

    await interaction.showModal(modal);
  },
};
