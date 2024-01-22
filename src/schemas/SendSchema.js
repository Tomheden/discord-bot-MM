const { model, Schema } = require("mongoose");

module.exports = model(
  "SendSchema",
  new Schema({
    guild: {
      type: String,
    },
    channel: {
      type: String,
    },
  })
);
