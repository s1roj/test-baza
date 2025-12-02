const mongoose = require("mongoose");

const testSchema = new mongoose.Schema(
  {
    testId: {
      // <<<<< YANGI QO‘SHILDI
      type: mongoose.Schema.Types.ObjectId,
      ref: "test", // bu sizning other model nomi
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
        validator: (v) => v.length === 4,
        message: "4 ta variant bo‘lishi kerak!",
      },
    },
    correctIndex: {
      type: Number,
      required: true,
      min: 0,
      max: 3,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("testOne", testSchema);
