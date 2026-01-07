const {
  SlashCommandBuilder,
  MessageFlags,
  PermissionsBitField,
  ChannelType,
} = require("discord.js");
const {
  getVoiceConnection,
  VoiceConnectionStatus,
  VoiceConnectionDisconnectReason,
} = require("@discordjs/voice");
const { json } = require("@distube/yt-dlp");

const isUrl = (value) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Reproduce musica en el canal de voz que te encuentres")
    .addStringOption((option) =>
      option
        .setName("cancion")
        .setDescription("Enlace de la cancion")
        .setRequired(true)
    ),
  run: async (client, interaction) => {
    const voiceChannel = interaction.member?.voice?.channel;
    if (!voiceChannel) {
      await interaction.reply({
        content: "\u274C | Necesitas estar en un canal de voz",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (voiceChannel.type !== ChannelType.GuildVoice) {
      await interaction.reply({
        content: "\u274C | Usa un canal de voz normal (no Stage).",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const botMember = interaction.guild.members.me;
    const permissions = voiceChannel.permissionsFor(botMember);
    if (!permissions?.has(PermissionsBitField.Flags.Connect) || !permissions?.has(PermissionsBitField.Flags.Speak)) {
      await interaction.reply({
        content: "\u274C | No tengo permisos para unirme y hablar en ese canal.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (voiceChannel.full) {
      await interaction.reply({
        content: "\u274C | El canal de voz esta lleno.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (!voiceChannel.joinable || !voiceChannel.speakable) {
      await interaction.reply({
        content: "\u274C | No puedo unirme o hablar en ese canal.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    let query = interaction.options.getString("cancion");
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      await interaction.editReply({
        content: "\u23F3 | Buscando...",
      });
      const voiceDebug = process.env.VOICE_DEBUG === "1";
      const existingQueue = client.distube.getQueue(interaction.guildId);
      if (existingQueue?.voice?.channelId && existingQueue.voice.channelId !== voiceChannel.id) {
        await interaction.editReply({
          content: "\u274C | Ya estoy reproduciendo en otro canal de voz.",
        });
        return;
      }
      if (voiceDebug) {
        const adapterCreatorType =
          typeof voiceChannel.guild?.voiceAdapterCreator;
        console.log(
          `[voice] join guild=${voiceChannel.guildId} channel=${
            voiceChannel.id
          } adapterCreator=${adapterCreatorType}`
        );
        const voice = client.distube.voices.create(voiceChannel);
        voice.connection.on("stateChange", (oldState, newState) => {
          console.log(
            `[voice] connection ${oldState.status} -> ${newState.status}`
          );
          if (newState.status === VoiceConnectionStatus.Disconnected) {
            console.log(
              `[voice] disconnect reason=${newState.reason} closeCode=${
                newState.closeCode ?? "n/a"
              }`
            );
          }
        });
        voice.connection.on("error", (error) => {
          console.error("[voice] connection error:", error);
        });
      }
      if (!isUrl(query)) {
        const search = await json(`ytsearch1:${query}`, {
          dumpSingleJson: true,
          noWarnings: true,
          noCallHome: true,
          preferFreeFormats: true,
          skipDownload: true,
          simulate: true,
        });
        const entry = search?.entries?.[0];
        const resolvedUrl = entry?.webpage_url || entry?.url;
        if (!resolvedUrl) {
          await interaction.editReply({
            content: "\u274C | No encontre resultados para esa busqueda.",
          });
          return;
        }
        query = resolvedUrl;
      }

      await client.distube.play(voiceChannel, query, {
        member: interaction.member,
        textChannel: interaction.channel,
        interaction,
      });
      await interaction.deleteReply();
    } catch (error) {
      console.error(error);
      await interaction.editReply({
        content: "\u274C | No pude reproducir esa cancion.",
      });
    }
  },
};
