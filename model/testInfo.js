const mongoose = require("mongoose");

const testInfoSchema = new mongoose.Schema({
  testId: { type: mongoose.Schema.Types.ObjectId, required: true },
  randomCount: { type: Number, required: true }
});

module.exports = mongoose.model("TestInfo", testInfoSchema);
