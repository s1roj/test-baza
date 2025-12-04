const Result = require("../model/result");
const mongoose = require("mongoose");

exports.saveResult = async (req, res) => {
  try {
    const {
      studentId,
      testId,
      attemptId,
      correct,
      wrong,
      total,
      percent,
      grade,
      answers,
    } = req.body;

    const newResult = await Result.create({
      studentId,
      testId: new mongoose.Types.ObjectId(testId),
      attemptId,
      correct,
      wrong,
      total,
      percent,
      grade,
      answers,
    });

    res.json({
      success: true,
      message: "Natija saqlandi!",
      data: newResult,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
exports.getByAttempt = async (req, res) => {
  try {
    const attemptId = req.params.attemptId;

    const result = await Result.findOne({ attemptId });

    if (!result) {
      return res
        .status(404)
        .json({ success: false, message: "Natija topilmadi" });
    }

    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
