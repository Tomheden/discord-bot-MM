const config = require("../../config");
const { log } = require("../../functions");
const ExtendedClient = require("../../class/ExtendedClient");
const { EmbedBuilder } = require("discord.js");

const cooldown = new Map();

module.exports = {
  event: "messageUpdate",
  /**
   *
   * @param {ExtendedClient} client
   * @param {Message<true>} newMessage
   * @param {Message<true>} oldMessage
   * @returns
   */
  run: async (client, oldMessage, newMessage) => {
    // Verificar si el mensaje editado no es del bot
    if (!newMessage.author.bot && newMessage != oldMessage) {
      const user = oldMessage.author;
      const logChannel = client.channels.cache.get("1113152978917007432");

      // Comprobar si el canal de registros existe y es accesible
      if (
        logChannel &&
        logChannel.permissionsFor(client.user).has("SEND_MESSAGES")
      ) {
        const logMessage = `Mensaje editado en ${newMessage.channel} por ${user} _(ID: ${user.id})_:\nContenido anterior:\n \`${oldMessage.content}\`\nContenido actualizado:\n \`${newMessage.content}\``;
        logChannel.send({
          embeds: [
            new EmbedBuilder()
              .setTitle("**Mensaje editado**")
              .setDescription(logMessage)
              .setColor("349eeb")
              .setThumbnail(user.displayAvatarURL({ dynamic: true })),
          ],
        });
      }
    }
  },
};
