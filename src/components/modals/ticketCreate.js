const {
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
  MessageFlags,
} = require("discord.js");
const config = require("../../config");
const { loadJson } = require("../../utils/storage");

module.exports = {
  customId: "ticketModal",
  run: async (client, interaction) => {
    const tickets = loadJson("tickets.json", {});
    const data = tickets[interaction.guild.id];

    if (!data?.categoryId) {
      await interaction.reply({
        content: "Ticket system is not configured yet.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const why = interaction.fields.getTextInputValue("whyTicket");
    const info = interaction.fields.getTextInputValue("infoTicket");

    const category = interaction.guild.channels.cache.get(data.categoryId);

    const overwrites = [
      {
        id: interaction.guild.id,
        deny: [PermissionsBitField.Flags.ViewChannel],
      },
      {
        id: interaction.user.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
        ],
      },
    ];

    for (const roleId of config.roles.ticketStaff) {
      overwrites.push({
        id: roleId,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
        ],
      });
    }

    const channel = await interaction.guild.channels.create({
      name: `ticket-${interaction.user.id}`,
      type: ChannelType.GuildText,
      topic: `Ticket by ${interaction.user.username}; Reason: ${why}`,
      parent: category ?? undefined,
      permissionOverwrites: overwrites,
    });

    const embed = new EmbedBuilder()
      .setColor("Blurple")
      .setTitle(`Ticket creado por ${interaction.user.username}`)
      .setDescription(`Motivo: ${why}\n\nInformación adicional: ${info}`)
      .setTimestamp();

    const button = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("ticketClose")
        .setLabel("🔒 Cerrar ticket")
        .setStyle(ButtonStyle.Danger)
    );

    await channel.send({ embeds: [embed], components: [button] });
    await interaction.editReply({
      content: `Ticket creado en: ${channel}`,
    });
  },
};
