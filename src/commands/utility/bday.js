const { SlashCommandBuilder, PermissionsBitField, MessageFlags } = require("discord.js");
const cron = require("node-cron");
const config = require("../../config");
const { loadJson, saveJson } = require("../../utils/storage");
const { isValidDate } = require("../../utils/validators");

const birthdayFileName = "birthdays.json";
let birthdays = loadJson(birthdayFileName, {});
let cronStarted = false;

const saveBirthdays = () => {
  saveJson(birthdayFileName, birthdays);
};

const registerBirthdayCron = (client) => {
  if (cronStarted) {
    return;
  }

  cronStarted = true;
  cron.schedule(config.birthdays.schedule, () => {
    const now = new Date();
    if (config.birthdays.useTomorrow) {
      now.setDate(now.getDate() + 1);
    }

    const day = now.getDate();
    const month = now.getMonth() + 1;
    const timeString = new Date().toLocaleTimeString();

    const logChannel = client.channels.cache.get(config.channels.birthdays.log);
    const announceChannel = client.channels.cache.get(config.channels.birthdays.announce);

    if (logChannel) {
      logChannel.send(`Birthday cron running. Day: ${day}, Month: ${month}, Time: ${timeString}`);
    }

    if (!announceChannel) {
      return;
    }

    for (const userId of Object.keys(birthdays)) {
      const birthday = birthdays[userId];
      if (birthday.day === day && birthday.month === month) {
        announceChannel.send(`🎉 ¡Feliz cumpleaños, <@${userId}>!`);
      }
    }
  });
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("bday")
    .setDescription("Gestión de cumpleaños")
    .addSubcommand((command) =>
      command
        .setName("add")
        .setDescription("Añade tu cumpleños")
        .addIntegerOption((option) =>
          option
            .setName("dia")
            .setDescription("Dia del mes")
            .setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName("mes")
            .setDescription("Mes del año")
            .setRequired(true)
        )
    )
    .addSubcommand((command) =>
      command
        .setName("mod")
        .setDescription("Actualiza tu cmpleaños")
        .addIntegerOption((option) =>
          option
            .setName("dia")
            .setDescription("Nuevo dia del mes")
            .setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName("mes")
            .setDescription("Nuevo mes del año")
            .setRequired(true)
        )
    )
    .addSubcommand((command) =>
      command
        .setName("rmv")
        .setDescription("Borra tu cumpleaños")
        .addUserOption((option) =>
          option
            .setName("user")
            .setDescription("Solo administradores")
            .setRequired(false)
        )
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
  run: async (client, interaction) => {
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const isAdmin = interaction.member.permissions.has(
      PermissionsBitField.Flags.Administrator
    );

    if (sub === "add") {
      await handleAdd(interaction, userId);
    } else if (sub === "mod") {
      await handleMod(interaction, userId);
    } else if (sub === "rmv") {
      await handleRmv(interaction, userId, isAdmin);
    }

    saveBirthdays();
  },
  registerBirthdayCron,
};

const handleAdd = async (interaction, userId) => {
  let day =
    interaction.options.getInteger("dia") ??
    interaction.options.getInteger("día") ??
    interaction.options.getInteger("day");
  let month =
    interaction.options.getInteger("mes") ??
    interaction.options.getInteger("month");
  if (day == null || month == null) {
    const subcommand = interaction.options.data.find((option) => option.type === 1);
    const intOptions = (subcommand?.options ?? []).filter((option) => option.type === 4);
    const dayFallback = intOptions[0]?.value;
    const monthFallback = intOptions[1]?.value;
    day = Number.isFinite(dayFallback) ? dayFallback : day;
    month = Number.isFinite(monthFallback) ? monthFallback : month;
  }

  if (birthdays[userId]) {
      await interaction.reply({
        content: "Ya has registrado un cumpleaños, usa /bday mod para modificar la fecha.",
        flags: MessageFlags.Ephemeral,
      });
    return;
  }

  const dayNumber = Number(day);
  const monthNumber = Number(month);
  if (!Number.isInteger(dayNumber) || !Number.isInteger(monthNumber)) {
      await interaction.reply({
        content: "No pude leer dia y mes. Vuelve a ejecutar el comando o redeploy.",
        flags: MessageFlags.Ephemeral,
      });
    return;
  }

  if (!isValidDate(dayNumber, monthNumber)) {
      await interaction.reply({
        content: "Fecha inválida",
        flags: MessageFlags.Ephemeral,
      });
    return;
  }

  birthdays[userId] = { day: dayNumber, month: monthNumber };
    await interaction.reply({
      content: `Cumpleaños guardado el ${day}/${month}.`,
      flags: MessageFlags.Ephemeral,
    });
};

const handleMod = async (interaction, userId) => {
  let day =
    interaction.options.getInteger("dia") ??
    interaction.options.getInteger("día") ??
    interaction.options.getInteger("day");
  let month =
    interaction.options.getInteger("mes") ??
    interaction.options.getInteger("month");
  if (day == null || month == null) {
    const subcommand = interaction.options.data.find((option) => option.type === 1);
    const intOptions = (subcommand?.options ?? []).filter((option) => option.type === 4);
    const dayFallback = intOptions[0]?.value;
    const monthFallback = intOptions[1]?.value;
    day = Number.isFinite(dayFallback) ? dayFallback : day;
    month = Number.isFinite(monthFallback) ? monthFallback : month;
  }

  if (!birthdays[userId]) {
      await interaction.reply({
        content: "No tienes ningún cumpleaños guardado, ejecuta /bday add.",
        flags: MessageFlags.Ephemeral,
      });
    return;
  }

  const dayNumber = Number(day);
  const monthNumber = Number(month);
  if (!Number.isInteger(dayNumber) || !Number.isInteger(monthNumber)) {
      await interaction.reply({
        content: "No pude leer dia y mes. Vuelve a ejecutar el comando o redeploy.",
        flags: MessageFlags.Ephemeral,
      });
    return;
  }

  if (!isValidDate(dayNumber, monthNumber)) {
      await interaction.reply({
        content: "Fecha inválida.",
        flags: MessageFlags.Ephemeral,
      });
    return;
  }

  birthdays[userId] = { day: dayNumber, month: monthNumber };
  await interaction.reply({
    content: `Cumpleaños actulizado al ${day}/${month}.`,
    flags: MessageFlags.Ephemeral,
  });
};

const handleRmv = async (interaction, userId, isAdmin) => {
  const targetUser = interaction.options.getUser("user");
  const targetUserId = targetUser ? targetUser.id : userId;

  if (targetUser && !isAdmin) {
    await interaction.reply({
      content: "No puedes eliminar el cumpleaños de otra persona.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!birthdays[targetUserId]) {
    await interaction.reply({
      content: "No existe cumpleaños a eliminar.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  delete birthdays[targetUserId];
  await interaction.reply({
    content: `Cumpleañs eliminado ${targetUser ? ` para ${targetUser.username}` : ""}.`,
    flags: MessageFlags.Ephemeral,
  });
};
