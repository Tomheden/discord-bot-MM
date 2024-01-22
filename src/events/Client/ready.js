const { log } = require("../../functions");
const ExtendedClient = require("../../class/ExtendedClient");
const { DisTube } = require("distube");
const { YtDlpPlugin } = require("@distube/yt-dlp");

module.exports = {
  event: "ready",
  once: true,
  /**
   *
   * @param {ExtendedClient} _
   * @param {import('discord.js').Client<true>} client
   * @returns
   */
  run: (_, client) => {
    client.distube = new DisTube(client, {
      leaveOnStop: false,
      emitNewSongOnly: true,
      emitAddSongWhenCreatingQueue: false,
      emitAddListWhenCreatingQueue: false,
      plugins: [new YtDlpPlugin()],
    });

    //DISTUBE
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
    client.distube
      .on("playSong", (queue, song) =>
        queue.textChannel.send(
          `▶️ | Reproduciendo \`${song.name}\` - \`${song.formattedDuration}\``
        )
      )
      .on("addSong", (queue, song) =>
        queue.textChannel.send(
          `✔️ | Añadida ${song.name} - \`${song.formattedDuration}\` a la cola`
        )
      )
      .on("addList", (queue, playlist) =>
        queue.textChannel.send(
          `✔️ | Añadida la playlist \`${playlist.name}\` (${
            playlist.songs.length
          } canciones) a la cola\n${status(queue)}`
        )
      )
      .on("error", (channel, e) => {
        if (channel)
          channel.send(
            `❌ | Ha ocurrido un error: ${e.toString().slice(0, 1974)}`
          );
        else console.error(e);
      })
      .on("empty", (channel) =>
        channel.send("Canal de voz vacío, desconectado...")
      )
      .on("searchNoResult", (message, query) =>
        message.channel.send(`✖️ | Sin resultados para \`${query}\`!`)
      )
      .on("finish", (queue) => {
        const lastSong = queue.songs[0]; // Get the last played song
        if (lastSong && Date.now() - lastSong.playedAt > 5000) {
          queue.textChannel.send(
            "Sin actividad en los últimos 3 minutos, desconectando..."
          );
          queue.voiceChannel.leave();
        }
      });

    log("Logged in as: " + client.user.tag, "done");
  },
};
