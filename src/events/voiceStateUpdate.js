const { Events } = require("discord.js");

const getMemberPayload = (state) => ({
  guildId: state.guild.id,
  userId: state.id,
  username: state.member?.user?.username || null,
  joinedAt: state.member?.joinedAt || null,
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
        channelId: oldChannelId,
        timestamp,
      });
    }

    if (newChannelId) {
      client.stats.enqueue("voiceJoin", {
        ...payload,
        channelId: newChannelId,
        timestamp,
      });
    }
  },
};
