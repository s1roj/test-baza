const Attempt = require("../model/attempt");
const TestOne = require("../model/testOne");
const TestInfo = require("../model/testInfo");
const Test = require("../model/test");
const mongoose = require("mongoose");

exports.startAttempt = async (req, res) => {
  try {
    const { studentId, testId } = req.body;

    if (!studentId || !testId) {
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

    let attempt = await Attempt.findOne({ studentId, testId });

    if (attempt) {
      if (attempt.status === "finished") {
        return res.json({
          success: false,
          already: true,
          reason: "already_finished",
          message: "Siz bu testni allaqachon yakunlagansiz.",
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
      studentId,
      testId,
      questions,
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
