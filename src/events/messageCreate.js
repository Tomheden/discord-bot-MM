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
      timestamp: message.createdAt,
    });
  },
};
