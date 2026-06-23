const { Events } = require("discord.js");

module.exports = {
  event: Events.GuildMemberRemove,
  run: (client, member) => {
    if (!client.stats || member.user?.bot) {
      return;
    }

    client.stats.enqueue("memberLeave", {
      guildId: member.guild.id,
      userId: member.id,
      username: member.user.username,
      timestamp: new Date(),
    });
  },
};
