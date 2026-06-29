const { EmbedBuilder, MessageFlags, SlashCommandBuilder } = require("discord.js");
const { formatDuration } = require("../../services/stats/statsDiscordPresenter");

const RANKING_TYPES = {
  activity: {
    label: "Actividad",
    description: "Puntuacion de actividad",
    value: (entry) => `${entry.activityScore || 0} pts`,
  },
  messages: {
    label: "Mensajes",
    description: "Mensajes enviados",
    value: (entry) => `${entry.messages || 0} mensajes`,
  },
  voice: {
    label: "Voz",
    description: "Tiempo en canales de voz",
    value: (entry) => formatDuration(entry.voiceSeconds || 0),
  },
  commands: {
    label: "Comandos",
    description: "Comandos usados",
    value: (entry) => `${entry.commands || 0} comandos`,
  },
  reactions: {
    label: "Reacciones",
    description: "Reacciones dadas y recibidas",
    value: (entry) =>
      `${(entry.reactionsGiven || 0) + (entry.reactionsReceived || 0)} reacciones`,
  },
  mentions: {
    label: "Menciones",
    description: "Menciones recibidas",
    value: (entry) => `${entry.mentionsReceived || 0} menciones`,
  },
  replies: {
    label: "Respuestas",
    description: "Respuestas enviadas",
    value: (entry) => `${entry.repliesSent || 0} respuestas`,
  },
  channels: {
    label: "Canales",
    description: "Canales mas activos",
    value: (entry) => {
      const parts = [];
      if (entry.messages) {
        parts.push(`${entry.messages} mensajes`);
      }
      if (entry.voiceSeconds) {
        parts.push(formatDuration(entry.voiceSeconds));
      }
      if (entry.reactions) {
        parts.push(`${entry.reactions} reacciones`);
      }

      return parts.join(" / ") || "Sin actividad";
    },
  },
};

const PERIOD_LABELS = {
  all: "historico",
  day: "hoy",
  week: "esta semana",
  month: "este mes",
};

const clampLimit = (value) => {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return 10;
  }

  return Math.min(parsed, 25);
};

const formatUserLine = (entry, type) => {
  const userLabel = entry.userId ? `<@${entry.userId}>` : entry.username || "Usuario desconocido";
  return `**#${entry.rank}** ${userLabel} - ${RANKING_TYPES[type].value(entry)}`;
};

const formatChannelLine = (entry) =>
  `**#${entry.rank}** <#${entry.channelId}> - ${RANKING_TYPES.channels.value(entry)}`;

const buildRankingEmbed = ({ type, period, limit, entries }) => {
  const rankingType = RANKING_TYPES[type] || RANKING_TYPES.activity;
  const lines = entries.length
    ? entries.map((entry) =>
        type === "channels" ? formatChannelLine(entry) : formatUserLine(entry, type)
      )
    : ["Sin datos todavia."];

  return new EmbedBuilder()
    .setColor("Blurple")
    .setTitle(`Ranking de ${rankingType.label}`)
    .setDescription(lines.join("\n"))
    .addFields(
      {
        name: "Periodo",
        value: PERIOD_LABELS[period] || PERIOD_LABELS.all,
        inline: true,
      },
      {
        name: "Limite",
        value: String(limit),
        inline: true,
      }
    )
    .setFooter({ text: "Solo se registran metadatos, no contenido de mensajes." });
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rankings")
    .setDescription("Muestra rankings de actividad del servidor")
    .addStringOption((option) =>
      option
        .setName("tipo")
        .setDescription("Ranking a consultar")
        .setRequired(false)
        .addChoices(
          ...Object.entries(RANKING_TYPES).map(([value, config]) => ({
            name: config.label,
            value,
          }))
        )
    )
    .addStringOption((option) =>
      option
        .setName("periodo")
        .setDescription("Periodo del ranking")
        .setRequired(false)
        .addChoices(
          { name: "Historico", value: "all" },
          { name: "Hoy", value: "day" },
          { name: "Esta semana", value: "week" },
          { name: "Este mes", value: "month" }
        )
    )
    .addIntegerOption((option) =>
      option
        .setName("limite")
        .setDescription("Numero de entradas a mostrar")
        .setMinValue(1)
        .setMaxValue(25)
        .setRequired(false)
    )
    .addBooleanOption((option) =>
      option
        .setName("privado")
        .setDescription("Muestra la respuesta solo para ti")
        .setRequired(false)
    ),
  run: async (client, interaction) => {
    if (!client.stats || !interaction.guild) {
      await interaction.reply({
        content: "Las estadisticas no estan disponibles.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await client.stats.flush();

    const type = interaction.options.getString("tipo") || "activity";
    const period = interaction.options.getString("periodo") || "all";
    const limit = clampLimit(interaction.options.getInteger("limite") || 10);
    const isPrivate = interaction.options.getBoolean("privado") || false;

    const entries =
      type === "channels"
        ? await client.stats.repository.getGuildChannels(interaction.guild.id, {
            period,
            limit,
          })
        : (await client.stats.repository.getRanking(type, {
            guildId: interaction.guild.id,
            period,
          })).slice(0, limit);
    const rankedEntries = entries
      .slice(0, limit)
      .map((entry, index) => ({ ...entry, rank: entry.rank || index + 1 }));

    const embed = buildRankingEmbed({
      type,
      period,
      limit,
      entries: rankedEntries,
    });

    await interaction.reply({
      embeds: [embed],
      flags: isPrivate ? MessageFlags.Ephemeral : undefined,
    });
  },
};
