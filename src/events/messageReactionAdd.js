const { Events, PermissionsBitField } = require("discord.js");

const isPublicChannel = (guild, channel) =>
  channel?.permissionsFor(guild.roles.everyone)?.has(PermissionsBitField.Flags.ViewChannel) ??
  true;

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

    let message = fullReaction.message;
    if (message?.partial) {
      try {
        message = await message.fetch();
      } catch (error) {
        return;
      }
    }

    if (!message?.guild || message.author?.bot) {
      return;
    }

    client.stats.enqueue("reaction", {
      guildId: message.guild.id,
      userId: user.id,
      username: user.username,
      joinedAt: message.guild.members.cache.get(user.id)?.joinedAt || null,
      channelId: message.channelId,
      channelName: message.channel?.name || null,
      channelType: message.channel?.type ?? null,
      channelParentId: message.channel?.parentId || null,
      channelIsPublic: isPublicChannel(message.guild, message.channel),
      messageAuthorId: message.author?.id || null,
      timestamp: new Date(),
    });
  },
};
