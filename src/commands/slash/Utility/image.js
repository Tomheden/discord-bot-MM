const {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  ChannelType,
} = require("discord.js");
const ExtendedClient = require("../../../class/ExtendedClient");

module.exports = {
  structure: new SlashCommandBuilder()
    .setName("image")
    .setDescription("Envia una imagen como el bot")
    .addChannelOption((option) =>
      option
        .setName("canal")
        .setDescription("El canal al que se enviará el mensaje")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("imagen")
        .setDescription("URL de la imagen a enviar")
        .setRequired(true)
    ),
  /**
   * @param {ExtendedClient} client
   * @param {ChatInputCommandInteraction} interaction
   */
  run: async (client, interaction) => {
    try {
      const canal = interaction.options.getChannel("canal");
      const imagen = interaction.options.getString("imagen");

      // Enviar respuesta inicial para que el bot no se quede "pensando"
      await interaction.reply({
        content: `Enviando la imagen a ${canal.name}`,
        ephemeral: true
      });

      // Verificar si la URL de la imagen es válida y es de imagen
      if (!isValidImageUrl(imagen)) {
        return interaction.followUp({
          content: "La URL proporcionada no es una imagen válida.",
          ephemeral: true,
        });
      }

      // Enviar la imagen al canal especificado
      await canal.send({
        files: [{ attachment: imagen, name: 'imagen.png' }]
      });

      // Confirmar que la imagen se envió
      await interaction.followUp({
        content: `La imagen se ha enviado a ${canal.name}.`,
        ephemeral: true
      });

    } catch (error) {
      console.error('Error al enviar la imagen:', error);
      await interaction.followUp({
        content: 'Ocurrió un error al intentar enviar la imagen.',
        ephemeral: true,
      });
    }
  },
};

// Función para validar la URL de la imagen
function isValidImageUrl(url) {
  return url.match(/\.(jpeg|jpg|gif|png|webp)$/) || url.includes('discordapp.net');
}
