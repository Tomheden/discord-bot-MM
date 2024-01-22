const config = require("../../config");
const { log } = require("../../functions");
const ExtendedClient = require("../../class/ExtendedClient");
const { EmbedBuilder } = require("discord.js");

const cooldown = new Map();

module.exports = {
  event: "messageDelete",
  /**
   *
   * @param {ExtendedClient} client
   * @param {Message<true>} deletedMessage
   * @returns
   */
  run: async (client, deletedMessage) => {
    // Verificar si el mensaje eliminado no es del bot
    if (!deletedMessage.author.bot) {
      const user = deletedMessage.author;
      const logChannel = client.channels.cache.get("1113152978917007432");

      // Comprobar si el canal de registros existe y es accesible
      if (
        logChannel &&
        logChannel.permissionsFor(client.user).has("SEND_MESSAGES")
      ) {
        const logMessage = `Mensaje eliminado en ${deletedMessage.channel} por ${user} _(ID: ${user.id})_:\n\`${deletedMessage.content}\``;
        logChannel.send({
          embeds: [
            new EmbedBuilder()
              .setTitle("**Mensaje eliminado**")
              .setDescription(logMessage)
              .setColor("e63e49")
              .setThumbnail(user.displayAvatarURL({ dynamic: true })),
          ],
        });
      }
    }
  },
};
