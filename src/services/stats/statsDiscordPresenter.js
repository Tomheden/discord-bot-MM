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

const formatNumber = (value) => String(Number(value) || 0);

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

const getMinecraftUsername = (minecraft) =>
  minecraft?.minecraft_username || minecraft?.username || null;

const buildUserStatsEmbed = async ({ repository, guildId, user }) => {
  const stats = await repository.getUserStats(guildId, user.id);
  const activity = await repository.getUserActivity(guildId, user.id);
  const minecraftUsername = getMinecraftUsername(stats.minecraft);
  const minecraft = minecraftUsername ? `**${minecraftUsername}**` : "Sin vincular";
  const reactionsGiven = Number(stats.reactionsGiven) || 0;
  const reactionsReceived = Number(stats.reactionsReceived) || 0;
  const mentionsReceived = Number(stats.mentionsReceived) || 0;
  const repliesSent = Number(stats.repliesSent) || 0;

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
          `Comandos: **${formatNumber(stats.commands)}**`,
          `Dias activos: **${formatNumber(activity.daysActive)}**`,
          `Racha activa: **${formatNumber(activity.activeStreak)}**`,
          `Ultima actividad: ${formatDate(activity.lastActivityAt)}`,
          `Union al servidor: ${formatDate(activity.joinedAt)}`,
        ].join("\n"),
        inline: false,
      },
      {
        name: "Social",
        value: [
          `Reacciones dadas: **${formatNumber(reactionsGiven)}**`,
          `Reacciones recibidas: **${formatNumber(reactionsReceived)}**`,
          `Menciones recibidas: **${formatNumber(mentionsReceived)}**`,
          `Respuestas enviadas: **${formatNumber(repliesSent)}**`,
        ].join("\n"),
        inline: true,
      },
      {
        name: "Canales mas usados",
        value: formatTopChannels(activity.topChannels),
        inline: true,
      }
    )
    .setFooter({ text: "Solo se registran metadatos, no contenido de mensajes." });
};

module.exports = {
  buildUserStatsEmbed,
  formatDuration,
};
