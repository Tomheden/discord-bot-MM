const { Events, PermissionsBitField } = require("discord.js");

const isPublicChannel = (guild, channel) =>
  channel?.permissionsFor(guild.roles.everyone)?.has(PermissionsBitField.Flags.ViewChannel) ??
  true;

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
      channelName: message.channel?.name || null,
      channelType: message.channel?.type ?? null,
      channelParentId: message.channel?.parentId || null,
      channelIsPublic: isPublicChannel(message.guild, message.channel),
      mentionedUsers: [...message.mentions.users.values()].map((user) => ({
        id: user.id,
        username: user.username,
      })),
      replyUserId,
      timestamp: message.createdAt,
    });
  },
};
