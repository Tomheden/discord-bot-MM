const {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} = require("discord.js");
const ExtendedClient = require("../../../class/ExtendedClient");

module.exports = {
  structure: new SlashCommandBuilder()
    .setName("leave")
    .setDescription("Desconecta al bot del canal de voz"),
  /**
   * @param {ExtendedClient} client
   * @param {ChatInputCommandInteraction} interaction
   */
  run: async (client, interaction) => {
    client.distube.voices.leave(interaction);
    interaction.reply(`✔️ | Desconectando...`);
  },
};
