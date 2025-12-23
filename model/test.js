const mongoose = require("mongoose");

const test = mongoose.Schema(
  {
    title: { type: String, required: true },
    desc: { type: String, required: true },
    duration: {
      type: Number, // minutlarda
      required: true,
    },
    testCode: {
      type: Number,
      unique: true,
    },
    isActive: {
      type: Boolean,
      default: false, // test yaratilganda YOPIQ
    },
    creator: { type: String, required: true },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("test", test);
