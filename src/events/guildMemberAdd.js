const { Events } = require("discord.js");

module.exports = {
  event: Events.GuildMemberAdd,
  run: (client, member) => {
    if (!client.stats || member.user?.bot) {
      return;
    }

    client.stats.enqueue("memberJoin", {
      guildId: member.guild.id,
      userId: member.id,
      username: member.user.username,
      joinedAt: member.joinedAt,
      timestamp: member.joinedAt || new Date(),
    });
  },
};
