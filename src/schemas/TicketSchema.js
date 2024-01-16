const { model, Schema } = require("mongoose");

module.exports = model(
  "TicketSchema",
  new Schema({
    guild: {
      type: String,
    },
    category: {
      type: String,
    },
  })
);
