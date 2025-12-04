const mongoose = require("mongoose");

const attemptSchema = new mongoose.Schema({
  studentId: { type: String, required: true }, // Hozircha string bo‘ladi
  testId: { type: mongoose.Schema.Types.ObjectId, required: true },
  questions: { type: Array, required: true }, // random tanlangan testlar
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Attempt", attemptSchema);
