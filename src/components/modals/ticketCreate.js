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
const { loadJson, saveJson } = require("../../utils/storage");

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

    const ticketCounts = loadJson("ticket-counts.json", {});
    const guildCounts = ticketCounts[interaction.guild.id] || {};
    const currentCount = Number(guildCounts[interaction.user.id] || 0);
    const nextCount = currentCount + 1;
    const usernameSlug = interaction.user.username
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    const safeName = usernameSlug || `user-${interaction.user.id}`;

    const channel = await interaction.guild.channels.create({
      name: `ticket-${safeName}-${nextCount}`,
      type: ChannelType.GuildText,
      topic: `Ticket de ${interaction.user.username}; ID de usuario: ${interaction.user.id}; Motivo: ${why}`,
      parent: category ?? undefined,
      permissionOverwrites: overwrites,
    });
    guildCounts[interaction.user.id] = nextCount;
    ticketCounts[interaction.guild.id] = guildCounts;
    saveJson("ticket-counts.json", ticketCounts);

    const embed = new EmbedBuilder()
      .setColor("Blurple")
      .setTitle(`Ticket creado por ${interaction.user.username}`)
      .setDescription(`**Motivo:** ${why}\n\n**Información adicional:** ${info}`)
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
