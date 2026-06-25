const { PermissionsBitField, SlashCommandBuilder, MessageFlags } = require("discord.js");
const {
  fetchMinecraftProfile,
  isValidMinecraftUsername,
  toDashedUuid,
} = require("../../services/minecraftProfile");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("link")
    .setDescription("Vincula tu usuario de Discord con tu usuario de Minecraft")
    .addSubcommand((command) =>
      command
        .setName("minecraft")
        .setDescription("Vincula o actualiza tu usuario de Minecraft")
        .addStringOption((option) =>
          option
            .setName("usuario")
            .setDescription("Nombre de usuario de Minecraft")
            .setRequired(true)
        )
    )
    .addSubcommand((command) =>
      command
        .setName("ver")
        .setDescription("Muestra tu vinculacion actual")
    )
    .addSubcommand((command) =>
      command
        .setName("eliminar")
        .setDescription("Elimina tu vinculacion de Minecraft")
    )
    .addSubcommand((command) =>
      command
        .setName("admin-ver")
        .setDescription("Muestra la vinculacion de otro usuario")
        .addUserOption((option) =>
          option
            .setName("discord")
            .setDescription("Usuario de Discord a consultar")
            .setRequired(true)
        )
    )
    .addSubcommand((command) =>
      command
        .setName("admin-modificar")
        .setDescription("Vincula o actualiza el Minecraft de otro usuario")
        .addUserOption((option) =>
          option
            .setName("discord")
            .setDescription("Usuario de Discord a modificar")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("minecraft")
            .setDescription("Nombre de usuario de Minecraft")
            .setRequired(true)
        )
    )
    .addSubcommand((command) =>
      command
        .setName("admin-eliminar")
        .setDescription("Elimina la vinculacion de Minecraft de otro usuario")
        .addUserOption((option) =>
          option
            .setName("discord")
            .setDescription("Usuario de Discord a modificar")
            .setRequired(true)
        )
    ),
  run: async (client, interaction) => {
    if (!client.stats || !interaction.guild) {
      await interaction.reply({
        content: "Las estadisticas no estan disponibles.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();
    const isAdmin = interaction.memberPermissions?.has(
      PermissionsBitField.Flags.Administrator
    );

    if (subcommand === "ver") {
      const link = await client.stats.repository.getMinecraftLink(
        interaction.guild.id,
        interaction.user.id
      );
      await interaction.reply({
        content: link
          ? `Tu cuenta vinculada es **${link.minecraft_username}** (${toDashedUuid(link.minecraft_uuid)}).`
          : "No tienes ninguna cuenta de Minecraft vinculada.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (subcommand === "eliminar") {
      await client.stats.repository.unlinkMinecraftAccount(
        interaction.guild.id,
        interaction.user.id
      );
      await client.stats.repository.save();
      await interaction.reply({
        content: "Vinculacion de Minecraft eliminada.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (subcommand === "admin-ver") {
      if (!isAdmin) {
        await interaction.reply({
          content: "Necesitas permisos de administrador para usar este subcomando.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const targetUser = getAdminTargetUser(interaction);
      const link = await client.stats.repository.getMinecraftLink(
        interaction.guild.id,
        targetUser.id
      );

      await interaction.reply({
        content: link
          ? `${targetUser} tiene vinculada la cuenta **${link.minecraft_username}** (${toDashedUuid(link.minecraft_uuid)}).`
          : `${targetUser} no tiene ninguna cuenta de Minecraft vinculada.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (subcommand === "admin-eliminar") {
      if (!isAdmin) {
        await interaction.reply({
          content: "Necesitas permisos de administrador para usar este subcomando.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const targetUser = getAdminTargetUser(interaction);
      await client.stats.repository.unlinkMinecraftAccount(interaction.guild.id, targetUser.id);
      await client.stats.repository.save();

      await interaction.reply({
        content: `Vinculacion de Minecraft eliminada para ${targetUser}.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (subcommand === "admin-modificar") {
      if (!isAdmin) {
        await interaction.reply({
          content: "Necesitas permisos de administrador para usar este subcomando.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const targetUser = getAdminTargetUser(interaction);
      const minecraftUsername = interaction.options.getString("minecraft", true);
      await linkMinecraftAccountForUser({
        client,
        interaction,
        targetUser,
        minecraftUsername,
      });
      return;
    }

    if (subcommand !== "minecraft") {
      await interaction.reply({
        content: "Subcomando de link no reconocido. Vuelve a desplegar comandos con /deploy si acabas de actualizar el bot.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const minecraftUsername = interaction.options.getString("usuario", true);
    await linkMinecraftAccountForUser({
      client,
      interaction,
      targetUser: interaction.user,
      minecraftUsername,
    });
  },
};

const linkMinecraftAccountForUser = async ({
  client,
  interaction,
  targetUser,
  minecraftUsername,
}) => {
    if (!isValidMinecraftUsername(minecraftUsername)) {
      await interaction.reply({
        content: "El usuario de Minecraft debe tener 3-16 caracteres y solo letras, numeros o guion bajo.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    let profile;
    try {
      profile = await fetchMinecraftProfile(minecraftUsername);
    } catch (error) {
      console.error("[minecraft] Profile lookup failed:", error);
      await interaction.editReply({
        content: "No pude validar ese usuario con Mojang. Intentalo de nuevo mas tarde.",
      });
      return;
    }

    if (!profile) {
      await interaction.editReply({
        content: "No encontre ningun usuario premium de Minecraft con ese nombre.",
      });
      return;
    }

    const existingLink = await client.stats.repository.findMinecraftLink(
      interaction.guild.id,
      profile.uuid
    );

    if (existingLink && existingLink.user_id !== targetUser.id) {
      await interaction.editReply({
        content: "Ese usuario de Minecraft ya esta vinculado a otra cuenta de Discord.",
      });
      return;
    }

    const link = await client.stats.repository.linkMinecraftAccount({
      guildId: interaction.guild.id,
      userId: targetUser.id,
      username: targetUser.username,
      joinedAt: targetUser.id === interaction.user.id ? interaction.member?.joinedAt : null,
      minecraftUsername: profile.username,
      minecraftUuid: profile.uuid,
      timestamp: new Date(),
    });
    await client.stats.repository.save();

    await interaction.editReply({
      content:
        targetUser.id === interaction.user.id
          ? `Cuenta vinculada: **${link.minecraft_username}** (${profile.uuidDashed}).`
          : `Cuenta vinculada para ${targetUser}: **${link.minecraft_username}** (${profile.uuidDashed}).`,
    });
};

const getAdminTargetUser = (interaction) =>
  interaction.options.getUser("discord") || interaction.options.getUser("usuario", true);
