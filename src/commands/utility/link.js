const { SlashCommandBuilder, MessageFlags } = require("discord.js");
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

    if (subcommand === "ver") {
      const link = client.stats.repository.getMinecraftLink(
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
      client.stats.repository.unlinkMinecraftAccount(
        interaction.guild.id,
        interaction.user.id
      );
      client.stats.repository.save();
      await interaction.reply({
        content: "Vinculacion de Minecraft eliminada.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const minecraftUsername = interaction.options.getString("usuario", true);
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

    const existingLink = client.stats.repository.findMinecraftLink(
      interaction.guild.id,
      profile.uuid
    );

    if (existingLink && existingLink.user_id !== interaction.user.id) {
      await interaction.editReply({
        content: "Ese usuario de Minecraft ya esta vinculado a otra cuenta de Discord.",
      });
      return;
    }

    const link = client.stats.repository.linkMinecraftAccount({
      guildId: interaction.guild.id,
      userId: interaction.user.id,
      username: interaction.user.username,
      joinedAt: interaction.member?.joinedAt,
      minecraftUsername: profile.username,
      minecraftUuid: profile.uuid,
      timestamp: new Date(),
    });
    client.stats.repository.save();

    await interaction.editReply({
      content: `Cuenta vinculada: **${link.minecraft_username}** (${profile.uuidDashed}).`,
    });
  },
};
