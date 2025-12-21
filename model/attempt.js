const mongoose = require("mongoose");

const attemptSchema = new mongoose.Schema({
  studentCode: {
    type: String,
    required: true, 
  },
  studentInfo: {
    fullName: String,
    faculty: String,
    group: String,
  },
  testId: { type: mongoose.Schema.Types.ObjectId, required: true },
  questions: { type: Array, required: true }, // random tanlangan testlar
  createdAt: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ["pending", "finished"],
    default: "pending",
  },
});

module.exports = mongoose.model("attempt", attemptSchema);
