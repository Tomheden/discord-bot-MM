const { SlashCommandBuilder, ChannelType, MessageFlags } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("say")
    .setDescription("Send a message as the bot")
    .addStringOption((option) =>
      option
        .setName("message")
        .setDescription("Message to send")
        .setRequired(true)
    )
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("Channel to send the message to")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    ),
  run: async (client, interaction) => {
    let message = interaction.options.getString("message")?.trim() ?? "";
    if (!message) {
      const fallback = interaction.options.data.find((option) => option.type === 3)?.value;
      message = typeof fallback === "string" ? fallback.trim() : "";
    }
    const channel = interaction.options.getChannel("channel") || interaction.channel;

    if (!channel) {
      await interaction.reply({
        content: "No pude resolver el canal para enviar el mensaje.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (!message) {
      await interaction.reply({
        content: "No puedo enviar un mensaje vacio.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await channel.send({ content: message });
    await interaction.reply({
      content: `Mensaje enviado a ${channel}.`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
