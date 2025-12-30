const { Events, EmbedBuilder, PermissionsBitField } = require("discord.js");
const config = require("../config");

module.exports = {
  event: Events.MessageUpdate,
  run: async (client, oldMessage, newMessage) => {
    if (!newMessage || newMessage.author?.bot) {
      return;
    }

    let before = oldMessage;
    let after = newMessage;

    if (oldMessage.partial) {
      try {
        before = await oldMessage.fetch();
      } catch (error) {
        return;
      }
    }

    if (newMessage.partial) {
      try {
        after = await newMessage.fetch();
      } catch (error) {
        return;
      }
    }

    if (before.content === after.content) {
      return;
    }

    const logChannel = client.channels.cache.get(config.channels.logs.message);
    if (
      !logChannel ||
      !logChannel.permissionsFor(client.user).has(PermissionsBitField.Flags.SendMessages)
    ) {
      return;
    }

    const user = after.author;
    const beforeContent = before.content || "[no content]";
    const afterContent = after.content || "[no content]";

    await logChannel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("Mensaje editado")
          .setDescription(
            `Canal: ${after.channel}\nUsuario: ${user} (ID: ${user.id})\n\nAntes:\n${beforeContent}\n\nDespués:\n${afterContent}`
          )
          .setColor("#349eeb")
          .setThumbnail(user.displayAvatarURL({ dynamic: true })),
      ],
    });
  },
};
