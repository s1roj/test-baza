const mongoose = require("mongoose");

const test = mongoose.Schema(
  {
    title: { type: String, required: true },
    desc: { type: String, required: true },
    start: { type: String, required: true, },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("test", test);
