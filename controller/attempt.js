const Attempt = require("../model/attempt");
const TestOne = require("../model/testOne");
const TestInfo = require("../model/testInfo");
const Test = require("../model/test");
const mongoose = require("mongoose");

exports.startAttempt = async (req, res) => {
  try {
    const { studentCode, testId, studentInfo } = req.body;

    if (!studentCode || !testId) {
      return res.status(400).json({
        success: false,
        message: "studentId va testId yuborilishi shart!",
      });
    }

    const test = await Test.findById(testId);

    if (!test.isActive) {
      return res.json({
        success: false,
        reason: "closed",
      });
    }

    const duration = Number(test.duration || 0);
    const now = new Date();
    const finishTime =
      duration > 0 ? new Date(now.getTime() + duration * 60000) : null;

    let attempt = await Attempt.findOne({ studentCode, testId });

    if (attempt) {
      if (attempt.status === "finished") {
        return res.json({
          success: false,
          already: true,
          reason: "already_finished",
          message: "Siz bu testni allaqachon yakunlagansiz.",
          attemptId: attempt._id,
        });
      }

      if (attempt.finishTime && new Date() > attempt.finishTime) {
        return res.json({
          success: false,
          already: true,
          reason: "time_over",
          message: "Test vaqti tugagan.",
        });
      }

      return res.json({
        success: true,
        attemptId: attempt._id,
        questions: attempt.questions || [],
        finishTime: attempt.finishTime,
      });
    }

    const info = await TestInfo.findOne({ testId });
    if (!info || !info.randomCount) {
      return res.status(400).json({
        success: false,
        message: "Ushbu test uchun randomCount topilmadi (TestInfo yo‘q).",
      });
    }

    const randomCount = info.randomCount;

    const questions = await TestOne.aggregate([
      { $match: { testId: new mongoose.Types.ObjectId(testId) } },
      { $sample: { size: randomCount } },
    ]);

    if (!questions.length) {
      return res.status(400).json({
        success: false,
        message: "Bu test uchun savollar topilmadi (TestOne bo‘sh).",
      });
    }

    attempt = await Attempt.create({
      studentCode,
      testId,
      questions,
      studentInfo,
      startTime: now,
      finishTime,
    });

    return res.json({
      success: true,
      attemptId: attempt._id,
      questions,
      finishTime,
    });
  } catch (err) {
    console.error("startAttempt error:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
exports.delete = async (req, res) => {
  try {
    const data = await Attempt.findById({ _id: req.params.id }).exec();

    if (!data) {
      res.status(404).json({ success: false, data: "Post not found" });
      return;
    }

    await Attempt.findByIdAndDelete({ _id: req.params.id });
    res.status(200).json({ success: true, data: "Post deleted" });
  } catch {
    res.status(500).json({ success: false, data: "DeleteIshlamadi" });
  }
};
