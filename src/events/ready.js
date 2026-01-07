const {
  Events,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { registerBirthdayCron } = require("../commands/utility/bday");
const { DisTube, DisTubeError } = require("distube");
const { YtDlpPlugin, download, json } = require("@distube/yt-dlp");
const ffmpegStaticPath = require("ffmpeg-static");
const fs = require("fs");
const path = require("path");

module.exports = {
  event: Events.ClientReady,
  once: true,
  run: (client) => {
    console.log(`Logged in as ${client.user.tag}`);
    const isMusicClient = client.mode === "music";

    if (!isMusicClient) {
      registerBirthdayCron(client);
    }
    const voiceDebug = process.env.VOICE_DEBUG === "1";
    if (voiceDebug) {
      client.ws.on("VOICE_SERVER_UPDATE", (payload) => {
        const endpoint = payload?.endpoint ?? "null";
        console.log(
          `[voice] raw server update guild=${payload.guild_id} endpoint=${endpoint}`
        );
      });
      client.ws.on("VOICE_STATE_UPDATE", (payload) => {
        if (payload?.user_id !== client.user.id) {
          return;
        }
        console.log(
          `[voice] raw state update channel=${payload.channel_id ?? "none"}`
        );
      });
      client.on(Events.VoiceServerUpdate, (payload) => {
        const endpoint = payload?.endpoint ?? "null";
        console.log(
          `[voice] server update guild=${payload.guild_id} endpoint=${endpoint}`
        );
      });
      client.on(Events.VoiceStateUpdate, (oldState, newState) => {
        if (newState.member?.id !== client.user.id) {
          return;
        }
        console.log(
          `[voice] state update ${oldState.channelId ?? "none"} -> ${
            newState.channelId ?? "none"
          }`
        );
      });
    }

    const ffmpegPath = process.env.FFMPEG_PATH || ffmpegStaticPath;
    try {
      fs.chmodSync(ffmpegPath, 0o755);
    } catch (error) {
      if (voiceDebug) {
        console.log(`[ffmpeg] chmod failed: ${error?.message || error}`);
      }
    }
    if (voiceDebug) {
      const exists = fs.existsSync(ffmpegPath);
      console.log(
        `[ffmpeg] using path=${ffmpegPath} exists=${exists ? "yes" : "no"}`
      );
    }
    client.distube = new DisTube(client, {
      leaveOnStop: false,
      leaveOnEmpty: false,
      emptyCooldown: 20,
      emitNewSongOnly: true,
      emitAddSongWhenCreatingQueue: false,
      emitAddListWhenCreatingQueue: false,
      ffmpeg: {
        path: ffmpegPath,
      },
      plugins: [new YtDlpPlugin({ update: false })],
    });
    const ytDlpDistPath = require.resolve("@distube/yt-dlp/dist/index.js");
    const ytDlpDir = path.join(path.dirname(ytDlpDistPath), "..", "bin");
    const ytDlpFilename = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
    const ytDlpPath = path.join(ytDlpDir, ytDlpFilename);
    if (!fs.existsSync(ytDlpPath)) {
      download()
        .then((version) => {
          console.log(`[yt-dlp] descargado (${version || "version desconocida"})`);
        })
        .catch((error) => {
          console.error("[yt-dlp] descarga fallida:", error);
        });
    }
    const originalAttachStreamInfo =
      client.distube.handler.attachStreamInfo.bind(client.distube.handler);
    client.distube.handler.attachStreamInfo = async (song) => {
      if (song?.source === "youtube") {
        const info = await json(song.url, {
          dumpSingleJson: true,
          noWarnings: true,
          noCallHome: true,
          preferFreeFormats: true,
          skipDownload: true,
          simulate: true,
          format: "ba/ba*",
        }).catch((error) => {
          throw new DisTubeError(
            "YTDLP_ERROR",
            `${error?.stderr || error}`
          );
        });
        if (info?.entries?.length) {
          throw new DisTubeError(
            "YTDLP_ERROR",
            "No puedo obtener el stream de una playlist."
          );
        }
        if (!info?.url) {
          throw new DisTubeError(
            "YTDLP_ERROR",
            "No se pudo obtener el stream de esta cancion."
          );
        }
        song.streamURL = info.url;
        song.source = "direct_link";
        return;
      }
      await originalAttachStreamInfo(song);
    };

    const status = (queue) =>
      `Volumen: \`${queue.volume}%\` | Filtro: \`${
        queue.filters.names.join(", ") || "Off"
      }\` | Bucle: \`${
        queue.repeatMode
          ? queue.repeatMode === 2
            ? "All Queue"
            : "This Song"
          : "Off"
      }\` | Autoplay: \`${queue.autoplay ? "On" : "Off"}\``;

    let nowPlayingMessage = null;

    client.distube
      .on("playSong", (queue, song) => {
        const controls = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("stopButton")
            .setEmoji("<:stop:1199750571633152061>")
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId("pauseButton")
            .setEmoji("<:pause:1199750570328719442>")
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId("skipButton")
            .setStyle(ButtonStyle.Primary)
            .setEmoji("<:next:1199750568688746611>")
        );
        const embed = new EmbedBuilder()
          .setColor("Blurple")
          .setTitle("\uD83C\uDFA7 Ahora sonando:")
          .setThumbnail(song.thumbnail)
          .setDescription(`\`${song.name}\` - \`${song.formattedDuration}\``)
          .setFooter({
            text: `Solicitada por ${song.member.displayName}`,
            iconURL: song.member.displayAvatarURL({ dynamic: true }),
          });
        nowPlayingMessage = queue.textChannel.send({
          embeds: [embed],
          components: [controls],
        });
      })
      .on("finishSong", (queue) => {
        if (!nowPlayingMessage) {
          return;
        }
        nowPlayingMessage
          .then((message) => {
            const embedReceived = message.embeds.at(0);
            if (!embedReceived) {
              return;
            }
            const embed = new EmbedBuilder()
              .setColor("e63535")
              .setTitle(embedReceived.title ?? "\uD83C\uDFA7 Ahora sonando:")
              .setThumbnail(embedReceived.thumbnail?.url ?? null)
              .setDescription(embedReceived.description ?? "")
              .setFooter({
                text: embedReceived.footer?.text ?? "",
                iconURL: embedReceived.footer?.iconURL ?? null,
              });
            let pauseOrResume = "pauseButton";
            let buttonPauseOrResume = "<:pause:1199750570328719442>";
            let buttonColor = ButtonStyle.Secondary;
            if (queue.paused) {
              pauseOrResume = "resumeButton";
              buttonPauseOrResume = "<:play:1199750566243483688>";
              buttonColor = ButtonStyle.Success;
            }
            const disabledControls = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId("stopButton")
                .setEmoji("<:stop:1199750571633152061>")
                .setStyle(ButtonStyle.Danger)
                .setDisabled(true),
              new ButtonBuilder()
                .setCustomId(pauseOrResume)
                .setEmoji(buttonPauseOrResume)
                .setStyle(buttonColor)
                .setDisabled(true),
              new ButtonBuilder()
                .setCustomId("skipButton")
                .setStyle(ButtonStyle.Primary)
                .setEmoji("<:next:1199750568688746611>")
                .setDisabled(true)
            );
            queue.textChannel.messages.edit(message, {
              embeds: [embed],
              components: [disabledControls],
            });
          })
          .catch((error) => {
            console.error("Error al actualizar el mensaje:", error);
          });
      })
      .on("addSong", (queue, song) => {
        const embed = new EmbedBuilder()
          .setColor("76ed61")
          .setTitle("<:addqueue:1199843654525784084> Cancion anadida a la cola:")
          .setThumbnail(song.thumbnail)
          .setDescription(`\`${song.name}\` - \`${song.formattedDuration}\``)
          .setFooter({
            text: `Solicitada por ${song.member.displayName}`,
            iconURL: song.member.displayAvatarURL({ dynamic: true }),
          });
        queue.textChannel.send({ embeds: [embed] });
      })
      .on("addList", (queue, playlist) => {
        const embed = new EmbedBuilder()
          .setColor("76ed61")
          .setTitle("<:addqueue:1199843654525784084> Playlist anadida a la cola:")
          .setThumbnail(playlist.thumbnail)
          .setDescription(
            `\`${playlist.name}\` - \`${playlist.songs.length} canciones\``
          )
          .setFooter({
            text: `Solicitada por ${playlist.member.displayName}`,
            iconURL: playlist.member.displayAvatarURL({ dynamic: true }),
          });
        queue.textChannel.send({ embeds: [embed] });
      })
      .on("error", (channel, error) => {
        if (channel) {
          channel.send(
            `? | Ha ocurrido un error: ${error.toString().slice(0, 1974)}`
          );
        } else {
          console.error(error);
        }
      })
      .on("ffmpegDebug", (debug) => {
        if (process.env.VOICE_DEBUG === "1") {
          console.log(`[ffmpeg] ${debug}`);
        }
      })
      .on("empty", (queue, channel) => {
        channel.send("Canal de voz vacio, desconectado...");
        queue.voice.leave();
      })
      .on("searchNoResult", (message, query) =>
        message.channel.send(`?? | Sin resultados para \`${query}\`!`)
      )
      .on("deleteQueue", (queue) => {
        const embed = new EmbedBuilder()
          .setColor("e63535")
          .setTitle("\uD83C\uDFA7 Sesion de musica finalizada")
          .setDescription("Usa `/play` para reproducir una cancion.")

        queue.textChannel.send({ embeds: [embed] });
        queue.voice.leave();
      });

  },
};

