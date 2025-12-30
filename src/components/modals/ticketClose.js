const {
  ActionRowBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
} = require("discord.js");
const { createTranscript, ExportReturnType } = require("discord-html-transcripts");
const config = require("../../config");
const { uploadTranscript } = require("../../utils/github");

module.exports = {
  customId: "closeTicketModal",
  run: async (client, interaction) => {
    const channel = interaction.channel;
    if (!channel) {
      return;
    }

    const ticketUserId = channel.name.replace("ticket-", "");
    const member = await interaction.guild.members.fetch(ticketUserId).catch(() => null);
    const reason = interaction.fields.getTextInputValue("closeReasonTicket");

    let transcriptResult = null;
    try {
      const htmlBuffer = await createTranscript(channel, {
        limit: -1,
        returnType: ExportReturnType.Buffer,
        filename: `${channel.name}.html`,
        hydrate: true,
        filter: (message) =>
          !message.embeds?.some((embed) => Array.isArray(embed.fields) && embed.fields.length > 0),
      });
      transcriptResult = {
        buffer: htmlBuffer,
        fileName: `${channel.name}-${Date.now()}.html`,
        isHtml: true,
      };
    } catch (error) {
      console.error("Transcript generation failed:", error);
      const textTranscript = await buildTextTranscript(channel);
      if (textTranscript) {
        transcriptResult = textTranscript;
      }
    }

    const transcriptsChannel = client.channels.cache.get(config.channels.tickets.transcripts);
    const ticketsLogChannel = client.channels.cache.get(config.channels.tickets.log);

    let transcriptMessage;
    let hostedTranscriptUrl = null;
    if (transcriptResult) {
      try {
        const uploadResult = await uploadTranscript({
          buffer: transcriptResult.buffer,
          fileName: transcriptResult.fileName,
          config,
        });
        hostedTranscriptUrl = uploadResult?.blobUrl || uploadResult?.htmlUrl || null;
      } catch (error) {
        console.error("Transcript upload failed:", error);
      }
    }

    if (transcriptsChannel && transcriptResult) {
      const attachment = new AttachmentBuilder(transcriptResult.buffer, {
        name: transcriptResult.fileName,
      });
      transcriptMessage = await transcriptsChannel.send({
        content: "Ticket transcript:",
        files: [attachment],
      });
    } else if (transcriptsChannel && !transcriptResult) {
      await transcriptsChannel.send("Ticket transcript failed to generate.");
    }

    if (ticketsLogChannel && member) {
      const embed = new EmbedBuilder()
        .setColor("Blurple")
        .setAuthor({
          name: member.displayName,
          iconURL: member.displayAvatarURL({ dynamic: true }),
        })
        .setDescription(
          `Ticket creado por ${member.user}\nCerrado por ${interaction.member.user} con motivo de: ${reason}`
        )
        .setTimestamp();

      const linkUrl = resolveTranscriptUrl({
        hostedUrl: hostedTranscriptUrl,
        isHtml: transcriptResult?.isHtml,
        fallbackUrl: transcriptMessage?.attachments.first()?.url,
      });

      const button = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("Ver ticket")
          .setURL(linkUrl)
          .setStyle(ButtonStyle.Link)
      );

      await ticketsLogChannel.send({ embeds: [embed], components: [button] });
    }

    await interaction.reply({ content: "Este ticket se cerrará en unos segundos..." });

    setTimeout(async () => {
      await channel.delete().catch(() => {});
      if (member) {
        await member
          .send(
            `📢 Tu ticket de ${interaction.guild.name} se ha cerrado. Motivo: ${reason}`
          )
          .catch(() => {});
      }
    }, 5000);
  },
};

const buildTextTranscript = async (channel) => {
  try {
    let allMessages = [];
    let lastMessageId;

    while (true) {
      const fetchOptions = { limit: 100, before: lastMessageId };
      if (!lastMessageId) {
        delete fetchOptions.before;
      }

      const messages = await channel.messages.fetch(fetchOptions);
      allMessages.push(...messages.values());
      lastMessageId = messages.lastKey();

      if (messages.size < 100) {
        break;
      }
    }

    const lines = allMessages
      .reverse()
      .map((message) => {
        const timestamp = message.createdAt.toISOString();
        const author = message.author?.tag || "Unknown";
        const content = message.content || "[no content]";
        return `[${timestamp}] ${author}: ${content}`;
      })
      .join("\n");

    return {
      buffer: Buffer.from(lines),
      fileName: `${channel.name}-${Date.now()}.txt`,
      isHtml: false,
    };
  } catch (error) {
    console.error("Text transcript failed:", error);
    return null;
  }
};

const resolveTranscriptUrl = ({ hostedUrl, isHtml, fallbackUrl }) => {
  if (hostedUrl) {
    if (isHtml) {
      return `https://html-preview.github.io/?url=${encodeURIComponent(hostedUrl)}`;
    }
    return hostedUrl;
  }

  return fallbackUrl ?? "https://discord.com";
};
