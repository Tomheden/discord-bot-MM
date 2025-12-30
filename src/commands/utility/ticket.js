const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  MessageFlags,
} = require("discord.js");
const { loadJson, saveJson } = require("../../utils/storage");

const ticketsFileName = "tickets.json";
let tickets = loadJson(ticketsFileName, {});

const saveTickets = () => {
  saveJson(ticketsFileName, tickets);
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Gestión de tickets")
    .addSubcommand((command) =>
      command
        .setName("send")
        .setDescription("Enviar el mensaje de tickts")
        .addStringOption((option) =>
          option
            .setName("nombre")
            .setDescription("Descripción del botón")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("mensaje")
            .setDescription("Mensaje")
            .setRequired(false)
        )
    )
    .addSubcommand((command) =>
      command
        .setName("setup")
        .setDescription("Establece la categoría")
        .addChannelOption((option) =>
          option
            .setName("categoria")
            .setDescription("Categoría para los tickets")
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(true)
        )
    )
    .addSubcommand((command) =>
      command
        .setName("remove")
        .setDescription("Elimina el sistema de tickets")
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
  run: async (client, interaction) => {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === "send") {
      if (!tickets[guildId]?.categoryId) {
        await interaction.reply({
          content: "Ticket system is not configured. Run /ticket setup first.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const label = interaction.options.getString("nombre");
      const message =
        interaction.options.getString("mensaje") ||
        "❓ ¿Necesitas ayuda con algo? ¡Pulsa el botón para ponerte en contacto con un moderador!";

      const button = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ticketCreate")
          .setLabel(label)
          .setStyle(ButtonStyle.Primary)
      );

      const embed = new EmbedBuilder()
        .setColor("Blurple")
        .setTitle("✨ Crea un ticket")
        .setDescription(message)
        .setFooter({
          text: interaction.guild.name,
          iconURL: interaction.guild.iconURL(),
        });

      await interaction.reply({
        content: "Ticket panel sent.",
        flags: MessageFlags.Ephemeral,
      });

      await interaction.channel.send({ embeds: [embed], components: [button] });
      return;
    }

    if (sub === "remove") {
      if (!tickets[guildId]) {
        await interaction.reply({
          content: "No ticket system configured.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      delete tickets[guildId];
      saveTickets();

      await interaction.reply({
        content: "Ticket system removed.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === "setup") {
      if (tickets[guildId]) {
        await interaction.reply({
          content: "Ticket system is already configured.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const category = interaction.options.getChannel("categoria");
      tickets[guildId] = { categoryId: category.id };
      saveTickets();

      await interaction.reply({
        content: `Category set to ${category}. Use /ticket send to post the panel.`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
