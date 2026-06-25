const { Events } = require("discord.js");

module.exports = {
  event: Events.MessageCreate,
  run: (client, message) => {
    if (!client.stats || !message.guild || message.author?.bot) {
      return;
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
      replyUserId: message.mentions.repliedUser?.id || null,
      timestamp: message.createdAt,
    });
  },
};
