//PUBLICAR
const ExtendedClient = require("../../class/ExtendedClient");
const { EmbedBuilder } = require("discord.js");

module.exports = {
  event: "interactionCreate",
  /**
   *
   * @param {ExtendedClient} client
   * @param {import('discord.js').Interaction} interaction
   * @returns
   */
  run: async (client, interaction) => {
    if (interaction.customId == "publicacionModal") {
      const t_titulo =
        interaction.fields.getTextInputValue("tituloPublicacion");
      const t_texto = interaction.fields.getTextInputValue("textoPublicacion");

      const roleId = "757634178102722641";
      const role = interaction.guild.roles.cache.get(roleId);

      //const idAnuncios = "973240810847998102"; canal test-bot
      const idAnuncios = "1122638071066787871";
      const canalAnuncios = client.channels.cache.get(idAnuncios);

      canalAnuncios.send(`**NUEVA PUBLICACIÓN **${role}`);
      canalAnuncios.send({
        embeds: [
          new EmbedBuilder()
            .setTitle(`**${t_titulo.toUpperCase()}**`)
            .setDescription(t_texto)
            .setColor("#44cad4"),
        ],
      });
      await interaction.reply("Creando publicación...");
    }
  },
};
