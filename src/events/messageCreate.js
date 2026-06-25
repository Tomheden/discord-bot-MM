const { Events } = require("discord.js");

module.exports = {
  event: Events.MessageCreate,
  run: async (client, message) => {
    if (!client.stats || !message.guild || message.author?.bot) {
      return;
    }

    let replyUserId = message.mentions.repliedUser?.id || null;
    if (!replyUserId && message.reference?.messageId) {
      try {
        const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
        replyUserId = repliedMessage.author?.bot ? null : repliedMessage.author?.id || null;
      } catch (error) {
        replyUserId = null;
      }
    }

    client.stats.enqueue("message", {
      guildId: message.guild.id,
      userId: message.author.id,
      username: message.author.username,
      joinedAt: message.member?.joinedAt,
      channelId: message.channelId,
      mentionedUsers: [...message.mentions.users.values()].map((user) => ({
        id: user.id,
        username: user.username,
      })),
      replyUserId,
      timestamp: message.createdAt,
    });
  },
};
