const {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionsBitField,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
} = require("discord.js");
const ExtendedClient = require("../../../class/ExtendedClient");
const ticket = require("../../../schemas/TicketSchema");
const { options } = require("./ping");

module.exports = {
  structure: new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Gestión del sistema de tickets")
    .addSubcommand((command) =>
      command
        .setName("send")
        .setDescription("Enviar el mensaje del ticket")
        .addStringOption((option) =>
          option
            .setName("nombre")
            .setDescription("Nombre del select")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("mensaje")
            .setDescription("Mensaje personalizado del embed")
            .setRequired(false)
        )
    )
    .addSubcommand((command) =>
      command
        .setName("setup")
        .setDescription("Setup de la categoría")
        .addChannelOption((option) =>
          option
            .setName("categoria")
            .setDescription("La categoría donde se mandaran los tickets")
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(true)
        )
    )
    .addSubcommand((command) =>
      command
        .setName("remove")
        .setDescription("Desactiva el sistema de tickets")
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
  run: async (client, interaction) => {
    const { options } = interaction;
    const sub = options.getSubcommand();
    const data = await ticket.findOne({ guild: interaction.guild.id });

    switch (sub) {
      case "send":
        if (!data)
          return await interaction.reply({
            content: "Necesitas usar /tickets primero",
            ephemeral: true,
          });
        const nombre = options.getString("nombre");
        var mensaje =
          options.getString("mensaje") ||
          "Contacta con el staff para resolver tus dudas";
        const select = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("ticketCreateSelect")
            .setLabel(`🎫 ${nombre}`)
            .setStyle(ButtonStyle.Primary)
        );
        const embed = new EmbedBuilder()
          .setColor("Blurple")
          .setTitle(`✨ Crea un ticket`)
          .setDescription(`👮` + mensaje)
          .setFooter({
            text: `${interaction.guild.name}`,
            iconURL: `${interaction.guild.iconURL()}`,
          });

        await interaction.reply({
          content: "He enviado el mensaje de tu ticket",
          ephemeral: true,
        });
        await interaction.channel.send({
          embeds: [embed],
          components: [select],
        });
        break;

      case "remove":
        if (!data)
          return await interaction.reply({
            content: `⚠️ Parece que no tienes un sistema de tickets`,
            ephemeral: true,
          });
        else {
          await ticket.deleteOne({ guild: interaction.guild.id });
          await interaction.reply({
            content: "Sistema de tickets eliminado",
            ephemeral: true,
          });
        }
        break;
      case "setup":
        if (data)
          return await interaction.reply({
            content: `⚠️ Parece que YA tienes un sistema de tickets`,
            ephemeral: true,
          });
        else {
          const categoria = options.getChannel("categoria");
          await ticket.create({
            guild: interaction.guild.id,
            category: categoria.id,
          });
          await interaction.reply({
            content: `Categoria establecida a ${categoria}. Usa /ticket send para enviar un mensaje a crear`,
            ephemeral: true,
          });
        }
    }
  },
};
