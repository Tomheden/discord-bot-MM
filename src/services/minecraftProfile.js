const MINECRAFT_USERNAME_PATTERN = /^[A-Za-z0-9_]{3,16}$/;

const toDashedUuid = (uuid) =>
  uuid.replace(
    /^([a-f0-9]{8})([a-f0-9]{4})([a-f0-9]{4})([a-f0-9]{4})([a-f0-9]{12})$/i,
    "$1-$2-$3-$4-$5"
  );

const normalizeMinecraftUuid = (uuid) =>
  String(uuid || "").replace(/-/g, "").toLowerCase();

const isValidMinecraftUsername = (username) =>
  typeof username === "string" && MINECRAFT_USERNAME_PATTERN.test(username);

const fetchMinecraftProfile = async (username) => {
  if (!isValidMinecraftUsername(username)) {
    return null;
  }

  const response = await fetch(
    `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(username)}`,
    {
      headers: {
        Accept: "application/json",
        "User-Agent": "discord-bot-mm-stats",
      },
    }
  );

  if (response.status === 204 || response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Mojang profile lookup failed with ${response.status}`);
  }

  const profile = await response.json();
  const uuid = normalizeMinecraftUuid(profile.id);

  if (!/^[a-f0-9]{32}$/.test(uuid)) {
    return null;
  }

  return {
    username: profile.name,
    uuid,
    uuidDashed: toDashedUuid(uuid),
  };
};

module.exports = {
  fetchMinecraftProfile,
  isValidMinecraftUsername,
  normalizeMinecraftUuid,
  toDashedUuid,
};
