const isValidImageUrl = (url) => {
  if (!url || typeof url !== "string") {
    return false;
  }

  return /\.(jpeg|jpg|gif|png|webp)$/i.test(url) || url.includes("discordapp.net") || url.includes("cdn.discordapp.com");
};

const isValidDate = (day, month) => {
  if (!Number.isInteger(day) || !Number.isInteger(month)) {
    return false;
  }

  if (month < 1 || month > 12 || day < 1) {
    return false;
  }

  const maxDay = new Date(2024, month, 0).getDate();
  return day <= maxDay;
};

module.exports = {
  isValidImageUrl,
  isValidDate,
};
