// bday.js
const { SlashCommandBuilder, PermissionsBitField } = require("discord.js");
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

// Path al archivo JSON
const birthdayFilePath = path.join(__dirname, 'birthdays.json');

// Cargar o crear archivo JSON
let birthdays = {};
if (fs.existsSync(birthdayFilePath)) {
  birthdays = JSON.parse(fs.readFileSync(birthdayFilePath));
}

module.exports = {
  structure: new SlashCommandBuilder()
    .setName('bday')
    .setDescription('Gestión de cumpleaños')
    .addSubcommand((command) =>
      command
        .setName('add')
        .setDescription('Añadir tu cumpleaños')
        .addIntegerOption((option) =>
          option.setName('día')
            .setDescription('Día de tu cumpleaños')
            .setRequired(true)
        )
        .addIntegerOption((option) =>
          option.setName('mes')
            .setDescription('Mes de tu cumpleaños')
            .setRequired(true)
        )
    )
    .addSubcommand((command) =>
      command
        .setName('mod')
        .setDescription('Modificar tu cumpleaños')
        .addIntegerOption((option) =>
          option.setName('día')
            .setDescription('Nuevo día de tu cumpleaños')
            .setRequired(true)
        )
        .addIntegerOption((option) =>
          option.setName('mes')
            .setDescription('Nuevo mes de tu cumpleaños')
            .setRequired(true)
        )
    )
    .addSubcommand((command) =>
      command
        .setName('rmv')
        .setDescription('Eliminar tu cumpleaños')
        .addUserOption((option) =>
          option.setName('usuario')
            .setDescription('Usuario cuyo cumpleaños quieres eliminar (solo Admin)')
            .setRequired(false)
        )
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

  run: async (client, interaction) => {
    const { options } = interaction;
    const sub = options.getSubcommand();
    const userId = interaction.user.id;
    const isAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);

    switch (sub) {
      case 'add':
        await handleAdd(interaction, userId);
        break;
      case 'mod':
        await handleMod(interaction, userId);
        break;
      case 'rmv':
        await handleRmv(interaction, userId, isAdmin);
        break;
    }

    // Guardar cambios en el archivo JSON
    fs.writeFileSync(birthdayFilePath, JSON.stringify(birthdays, null, 2));
  },

  registerBirthdayCron: (client) => {
    // Tarea diaria para revisar cumpleaños
    // cron.schedule('0 0 * * *', () => {
      cron.schedule('0 23 * * *', () => {
      const today = new Date();
      const day = today.getDate() + 1;
      const month = today.getMonth() + 1;
      const timeString = today.toLocaleTimeString(); // Obtener la hora actual en formato local

      const channelLog = client.channels.cache.get('973240810847998102'); // Reemplaza '973240810847998102' con el ID real del canal
      const channel = client.channels.cache.get('1126284792921608212');
      if (channelLog) {
        channelLog.send(`Dentro del cron, valores día: ${day}, mes: ${month}, hora: ${timeString}`);
        for (const userId in birthdays) {
          const birthday = birthdays[userId];
          if (birthday.day === day && birthday.month === month) {
            channel.send(`🎉 ¡Feliz cumpleaños, <@${userId}>! 🎉`);
            // channelLog.send(`🎉 ¡Feliz cumpleaños, <@${userId}>! 🎉`);
          }
        }
      }
    });
  }
};

// Función para manejar la adición de cumpleaños
async function handleAdd(interaction, userId) {
  const day = interaction.options.getInteger('día');
  const month = interaction.options.getInteger('mes');

  if (birthdays[userId]) {
    await interaction.reply({
      content: '❌ Ya tienes un cumpleaños registrado. Usa /bday mod para modificarlo.',
      ephemeral: true
    });
    return;
  }

  if (!isValidDate(day, month)) {
    await interaction.reply({
      content: '❌ Fecha no válida. Asegúrate de que el día y el mes sean correctos.',
      ephemeral: true
    });
    return;
  }

  birthdays[userId] = { day, month };
  await interaction.reply({
    content: `✅ ¡Cumpleaños registrado para el ${day}/${month}!`,
    ephemeral: true
  });
}

// Función para manejar la modificación de cumpleaños
async function handleMod(interaction, userId) {
  const day = interaction.options.getInteger('día');
  const month = interaction.options.getInteger('mes');

  if (!birthdays[userId]) {
    await interaction.reply({
      content: '❌ No tienes un cumpleaños registrado. Usa /bday add para agregarlo.',
      ephemeral: true
    });
    return;
  }

  if (!isValidDate(day, month)) {
    await interaction.reply({
      content: '❌ Fecha no válida. Asegúrate de que el día y el mes sean correctos.',
      ephemeral: true
    });
    return;
  }

  birthdays[userId] = { day, month };
  await interaction.reply({
    content: `✅ ¡Cumpleaños modificado para el ${day}/${month}!`,
    ephemeral: true
  });
}

// Función para manejar la eliminación de cumpleaños
async function handleRmv(interaction, userId, isAdmin) {
  const targetUser = interaction.options.getUser('usuario');
  const targetUserId = targetUser ? targetUser.id : userId;

  if (targetUser && !isAdmin) {
    await interaction.reply({
      content: '❌ No tienes permisos para eliminar el cumpleaños de otro usuario.',
      ephemeral: true
    });
    return;
  }

  if (!birthdays[targetUserId]) {
    await interaction.reply({
      content: '❌ No tienes un cumpleaños registrado. Usa /bday add para agregarlo.',
      ephemeral: true
    });
    return;
  }

  delete birthdays[targetUserId];
  await interaction.reply({
    content: `✅ Cumpleaños ${targetUser ? 'de ' + targetUser.username + ' ' : ''}eliminado.`,
    ephemeral: true
  });
}

// Función para validar fechas
function isValidDate(day, month) {
  return (
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= new Date(2024, month, 0).getDate()
  );
}
