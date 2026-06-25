const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");

const LAST_ACTION_FIELD = "Ultima accion";

const buildControls = ({ paused = false, disabled = false } = {}) =>
  new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("stopButton")
      .setEmoji("<:stop:1199750571633152061>")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled),
    paused
      ? new ButtonBuilder()
          .setCustomId("resumeButton")
          .setEmoji("<:play:1199750566243483688>")
          .setStyle(ButtonStyle.Success)
          .setDisabled(disabled)
      : new ButtonBuilder()
          .setCustomId("pauseButton")
          .setEmoji("<:pause:1199750570328719442>")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId("skipButton")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("<:next:1199750568688746611>")
      .setDisabled(disabled)
  );

const withLastAction = (message, text) => {
  const source = message.embeds.at(0);
  if (!source) {
    return null;
  }

  const embed = EmbedBuilder.from(source);
  const sourceFields = source.fields ?? source.data?.fields ?? [];
  const fields = sourceFields
    .filter((field) => field.name !== LAST_ACTION_FIELD)
    .map((field) => ({
      name: field.name,
      value: field.value,
      inline: field.inline,
    }));

  embed.setFields(fields);
  embed.addFields({
    name: LAST_ACTION_FIELD,
    value: text,
  });

  return embed;
};

module.exports = {
  buildControls,
  withLastAction,
};
