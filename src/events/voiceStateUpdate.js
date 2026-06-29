const { Events, PermissionsBitField } = require("discord.js");

const isPublicChannel = (guild, channel) =>
  channel?.permissionsFor(guild.roles.everyone)?.has(PermissionsBitField.Flags.ViewChannel) ??
  true;

const getMemberPayload = (state) => ({
  guildId: state.guild.id,
  userId: state.id,
  username: state.member?.user?.username || null,
  joinedAt: state.member?.joinedAt || null,
});

const getChannelPayload = (channel) => ({
  channelId: channel?.id || null,
  channelName: channel?.name || null,
  channelType: channel?.type ?? null,
  channelParentId: channel?.parentId || null,
  channelIsPublic: channel?.guild ? isPublicChannel(channel.guild, channel) : true,
});

module.exports = {
  event: Events.VoiceStateUpdate,
  run: (client, oldState, newState) => {
    if (!client.stats || newState.member?.user?.bot) {
      return;
    }

    const oldChannelId = oldState.channelId;
    const newChannelId = newState.channelId;

    if (oldChannelId === newChannelId) {
      return;
    }

    const payload = getMemberPayload(newState);
    const timestamp = new Date().toISOString();

    if (oldChannelId) {
      client.stats.enqueue("voiceLeave", {
        ...payload,
        ...getChannelPayload(oldState.channel),
        channelId: oldChannelId,
        timestamp,
      });
    }

    if (newChannelId) {
      client.stats.enqueue("voiceJoin", {
        ...payload,
        ...getChannelPayload(newState.channel),
        channelId: newChannelId,
        timestamp,
      });
    }
  },
};
