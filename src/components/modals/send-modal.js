const { ModalSubmitInteraction } = require("discord.js");
const ExtendedClient = require("../../class/ExtendedClient");
const { EmbedBuilder } = require("discord.js");
const send = require("../../schemas/SendSchema");

module.exports = {
  customId: "mensajeModal",
  /**
   *
   * @param {ExtendedClient} client
   * @param {ModalSubmitInteraction} interaction
   */
  run: async (client, interaction) => {
    const data = await send.findOne({ guild: interaction.guild.id });
    const mensaje = interaction.fields.getTextInputValue("mensaje");

    const canal = client.channels.cache.get(data.channel);

    await send.deleteOne({ guild: interaction.guild.id });
    await interaction.reply({
      content: "Enviando el mensaje a " + canal.name,
      ephemeral: true,
    });
    canal.send({ content: mensaje });
  },
};
