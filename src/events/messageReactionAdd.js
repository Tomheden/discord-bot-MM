const { Events } = require("discord.js");

module.exports = {
  event: Events.MessageReactionAdd,
  run: async (client, reaction, user) => {
    if (!client.stats || user?.bot) {
      return;
    }

    let fullReaction = reaction;
    if (reaction.partial) {
      try {
        fullReaction = await reaction.fetch();
      } catch (error) {
        return;
      }
    }

    const message = fullReaction.message;
    if (!message?.guild || message.author?.bot) {
      return;
    }

    client.stats.enqueue("reaction", {
      guildId: message.guild.id,
      userId: user.id,
      username: user.username,
      joinedAt: message.guild.members.cache.get(user.id)?.joinedAt || null,
      channelId: message.channelId,
      messageAuthorId: message.author?.id || null,
      timestamp: new Date(),
    });
  },
};
