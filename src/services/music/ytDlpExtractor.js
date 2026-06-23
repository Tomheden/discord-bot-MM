const { DisTubeError, PlayableExtractorPlugin, Playlist, Song } = require("distube");
const { json } = require("@distube/yt-dlp");

const isPlaylist = (info) => Array.isArray(info?.entries);

class YtDlpSong extends Song {
  constructor(plugin, info, options = {}) {
    super(
      {
        plugin,
        source: info.extractor,
        playFromSource: true,
        id: info.id,
        name: info.title || info.fulltitle,
        url: info.webpage_url || info.original_url,
        isLive: info.is_live,
        thumbnail: info.thumbnail || info.thumbnails?.[0]?.url,
        duration: info.is_live ? 0 : info.duration,
        uploader: {
          name: info.uploader,
          url: info.uploader_url,
        },
        views: info.view_count,
        likes: info.like_count,
        dislikes: info.dislike_count,
        reposts: info.repost_count,
        ageRestricted: Boolean(info.age_limit) && info.age_limit >= 18,
      },
      options
    );
  }
}

class LocalYtDlpPlugin extends PlayableExtractorPlugin {
  validate() {
    return true;
  }

  async resolve(url, options = {}) {
    const info = await this.getInfo(url);

    if (!isPlaylist(info)) {
      return new YtDlpSong(this, info, options);
    }

    if (info.entries.length === 0) {
      throw new DisTubeError("YTDLP_ERROR", "La playlist esta vacia.");
    }

    return new Playlist(
      {
        source: info.extractor,
        songs: info.entries.map((entry) => new YtDlpSong(this, entry, options)),
        id: info.id?.toString(),
        name: info.title,
        url: info.webpage_url,
        thumbnail: info.thumbnails?.[0]?.url,
      },
      options
    );
  }

  async getStreamURL(song) {
    if (!song.url) {
      throw new DisTubeError(
        "YTDLP_PLUGIN_INVALID_SONG",
        "Cannot get stream url from invalid song."
      );
    }

    const info = await this.getInfo(song.url, { format: "ba/ba*" });
    if (isPlaylist(info)) {
      throw new DisTubeError("YTDLP_ERROR", "No puedo obtener el stream de una playlist.");
    }

    return info.url;
  }

  getRelatedSongs() {
    return [];
  }

  async getInfo(url, extraFlags = {}) {
    return json(url, {
      dumpSingleJson: true,
      noWarnings: true,
      preferFreeFormats: true,
      skipDownload: true,
      simulate: true,
      ...extraFlags,
    }).catch((error) => {
      throw new DisTubeError("YTDLP_ERROR", `${error.stderr || error}`);
    });
  }
}

module.exports = {
  LocalYtDlpPlugin,
};
