const { EmbedBuilder } = require("discord.js");

const formatDuration = (seconds) => {
  const value = Math.max(0, Number(seconds) || 0);
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
};

const formatDate = (iso) => {
  if (!iso) {
    return "Sin datos";
  }

  return `<t:${Math.floor(new Date(iso).getTime() / 1000)}:R>`;
};

const formatTopChannels = (channels) => {
  if (!channels.length) {
    return "Sin datos";
  }

  return channels
    .slice(0, 3)
    .map((channel) => {
      const parts = [];
      if (channel.messages) {
        parts.push(`${channel.messages} mensajes`);
      }
      if (channel.voiceSeconds) {
        parts.push(formatDuration(channel.voiceSeconds));
      }

      return `<#${channel.channelId}>: ${parts.join(" / ")}`;
    })
    .join("\n");
};

const buildUserStatsEmbed = ({ repository, guildId, user }) => {
  const stats = repository.getUserStats(guildId, user.id);
  const activity = repository.getUserActivity(guildId, user.id);
  const minecraft = stats.minecraft
    ? `**${stats.minecraft.minecraft_username}**`
    : "Sin vincular";

  return new EmbedBuilder()
    .setColor("Blurple")
    .setTitle(`Estadisticas de ${user.username}`)
    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
    .addFields(
      {
        name: "Mensajes",
        value: [
          `Total: **${stats.messages}**`,
          `Ranking: **${stats.rank ?? "Sin ranking"}**`,
          `Media diaria: **${stats.averageDailyMessages}**`,
          `Ultimo mensaje: ${formatDate(stats.lastMessageAt)}`,
        ].join("\n"),
        inline: true,
      },
      {
        name: "Voz",
        value: [
          `Tiempo total: **${formatDuration(stats.voiceSeconds)}**`,
          `Entradas: **${stats.joins}**`,
          `Salidas: **${stats.leaves}**`,
          `Sesion media: **${formatDuration(stats.averageVoiceSessionSeconds)}**`,
        ].join("\n"),
        inline: true,
      },
      {
        name: "Actividad",
        value: [
          `Minecraft: ${minecraft}`,
          `Comandos: **${stats.commands}**`,
          `Dias activos: **${activity.daysActive}**`,
          `Ultima actividad: ${formatDate(activity.lastActivityAt)}`,
          `Union al servidor: ${formatDate(activity.joinedAt)}`,
        ].join("\n"),
        inline: false,
      },
      {
        name: "Canales mas usados",
        value: formatTopChannels(activity.topChannels),
        inline: false,
      }
    )
    .setFooter({ text: "Solo se registran metadatos, no contenido de mensajes." });
};

module.exports = {
  buildUserStatsEmbed,
};
