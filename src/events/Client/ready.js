const { log } = require("../../functions");
const ExtendedClient = require("../../class/ExtendedClient");
const { DisTube } = require("distube");
const { YtDlpPlugin } = require("@distube/yt-dlp");
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

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
    var msg = "";
    client.distube = new DisTube(client, {
      leaveOnStop: false,
      emptyCooldown: 20,
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
      .on("playSong", (queue, song) => {
        const select = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("stopButton")
            .setEmoji(`<:stop:1199750571633152061>`)
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId("pauseButton")
            .setEmoji(`<:pause:1199750570328719442>`)
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId("skipButton")
            .setStyle(ButtonStyle.Primary)
            .setEmoji(`<:next:1199750568688746611>`)
        );
        const embed = new EmbedBuilder()
          .setColor("Blurple")
          .setTitle(`🎧 Ahora sonando:`)
          .setThumbnail(song.thumbnail)
          .setDescription(`\`${song.name}\` - \`${song.formattedDuration}\``)
          .setFooter({
            text: `Solicitada por ${song.member.displayName}`,
            iconURL: song.member.displayAvatarURL({ dynamic: true }),
          });
        msg = queue.textChannel.send({
          embeds: [embed],
          components: [select],
        });
      })
      .on("finishSong", (queue, song) => {
        msg
          .then((message) => {
            // Acceder al valor de la propiedad id
            const messageObj = message;

            // Hacer lo que quieras con el valor messageId
            const embedReceived = message.embeds.at(0);

            const embed = new EmbedBuilder()
              .setColor("e63535")
              .setTitle(embedReceived.title)
              .setThumbnail(embedReceived.thumbnail.url)
              .setDescription(embedReceived.description)
              .setFooter({
                text: embedReceived.footer.text,
                iconURL: embedReceived.footer.iconURL,
              });
            var pauseOrResume = "pauseButton";
            var buttonPauseOrResume = "<:pause:1199750570328719442>";
            var buttonColor = ButtonStyle.Secondary;
            if (queue.paused) {
              pauseOrResume = "resumeButton";
              buttonPauseOrResume = "<:play:1199750566243483688>";
              buttonColor = ButtonStyle.Success;
            }
            const select = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId("stopButton")
                .setEmoji(`<:stop:1199750571633152061>`)
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
                .setEmoji(`<:next:1199750568688746611>`)
                .setDisabled(true)
            );
            queue.textChannel.messages.edit(message, {
              embeds: [embed],
              components: [select],
            });
          })
          .catch((error) => {
            // Manejar errores si la Promise es rechazada
            console.error("Error al obtener el mensaje:", error);
          });
      })
      .on("addSong", (queue, song) => {
        const embed = new EmbedBuilder()
          .setColor("76ed61")
          .setTitle(
            `<:addqueue:1199843654525784084> Canción añadida a la cola:`
          )
          .setThumbnail(song.thumbnail)
          .setDescription(`\`${song.name}\` - \`${song.formattedDuration}\``)
          .setFooter({
            text: `Solicitada por ${song.member.displayName}`,
            iconURL: song.member.displayAvatarURL({ dynamic: true }),
          });
        queue.textChannel.send({ embeds: [embed] });
      })
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
      .on("empty", (queue, channel) => {
        channel.send("Canal de voz vacío, desconectado...");
        queue.voice.leave();
      })
      .on("searchNoResult", (message, query) =>
        message.channel.send(`✖️ | Sin resultados para \`${query}\`!`)
      )
      .on("deleteQueue", (queue) => {
        const embed = new EmbedBuilder()
          .setColor("e63535")
          .setTitle(`🎧 Sesión de música finalizada`)
          .setDescription(`Usa \`/play\` para reproducir una canción.`);

        queue.textChannel.send({ embeds: [embed] });
        queue.voice.leave();
      });

    log("Logged in as: " + client.user.tag, "done");
  },
};
