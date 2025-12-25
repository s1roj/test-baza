const mongoose = require("mongoose");

const testSchema = new mongoose.Schema(
  {
    testId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "test",
      required: true,
    },
    question: {
      type: String,
      required: true,
    },
    options: {
      type: [String],
      required: true,
      validate: {
        validator: (v) => v.length >= 2,
        message: "Kamida 2 ta variant bo‘lishi kerak!",
      },
    },
    correctIndex: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("testOne", testSchema);
