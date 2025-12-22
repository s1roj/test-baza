const Result = require("../model/result");
const Attempt = require("../model/attempt");
const mongoose = require("mongoose");

exports.saveResult = async (req, res) => {
  try {
    const {
      studentCode,
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
      studentCode: studentCode,
      testId: new mongoose.Types.ObjectId(testId),
      attemptId,
      correct,
      wrong,
      total,
      percent,
      grade,
      answers,
    });

    await Attempt.findByIdAndUpdate(attemptId, { status: "finished" });

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
    const result = await Result.findOne({ attemptId: req.params.id });

    if (!result) {
      return res.json({
        success: false,
        message: "Natija topilmadi",
        data: null,
      });
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
exports.getResultsByTest = async (req, res) => {
  try {
    const testId = req.params.testId;

    // 1) Natijalarni olish
    const results = await Result.find({ testId })
      .populate("studentCode", "name faculty groupNumber")
      .populate("attemptId") // attempts.data
      .populate("testId"); // test mavzusi

    if (!results.length) {
      return res.json({
        success: false,
        message: "Bu test bo‘yicha hali natija yo‘q",
        data: [],
      });
    }

    res.json({
      success: true,
      data: results,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.editResult = async (req, res) => {
  const result = await Result.findByIdAndUpdate({ _id: req.params.id });
  result.correct = req.body.correct;
  result.wrong = req.body.wrong;
  result.percent = req.body.percent;
  result.grade = req.body.grade;

  await result
    .save()
    .then((data) => {
      res.status(200).json({ success: true, data });
    })
    .catch((error) => {
      res.status(500).json({ success: false, data: error });
    });
};
