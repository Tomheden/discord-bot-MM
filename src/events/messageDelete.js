const { Events, EmbedBuilder, PermissionsBitField } = require("discord.js");
const config = require("../config");

module.exports = {
  event: Events.MessageDelete,
  run: async (client, message) => {
    if (!message || message.author?.bot) {
      return;
    }

    let fullMessage = message;
    if (message.partial) {
      try {
        fullMessage = await message.fetch();
      } catch (error) {
        return;
      }
    }

    const logChannel = client.channels.cache.get(config.channels.logs.message);
    if (
      !logChannel ||
      !logChannel.permissionsFor(client.user).has(PermissionsBitField.Flags.SendMessages)
    ) {
      return;
    }

    const user = fullMessage.author;
    const content = fullMessage.content || "[no content]";

    await logChannel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("Message deleted")
          .setDescription(`Channel: ${fullMessage.channel}\nUser: ${user} (ID: ${user.id})\n\n${content}`)
          .setColor("#e63e49")
          .setThumbnail(user.displayAvatarURL({ dynamic: true })),
      ],
    });
  },
};
