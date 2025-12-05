const Attempt = require("../model/attempt");
const TestOne = require("../model/testOne");
const TestInfo = require("../model/testInfo");
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

    // 1) Student oldin boshlaganmi?
    let attempt = await Attempt.findOne({ studentId, testId });

    if (attempt) {
      return res.json({
        success: true,
        questions: attempt.questions,
        attemptId: attempt._id,
      });
    }

    // 2) randomCount olish
    const info = await TestInfo.findOne({ testId });
    if (!info) {
      return res.status(400).json({
        success: false,
        message: "TestInfo topilmadi!",
      });
    }
    const randomCount = info.randomCount;

    // 3) Random savollar tanlash
    const questions = await TestOne.aggregate([
      { $match: { testId: new mongoose.Types.ObjectId(testId) } },
      { $sample: { size: randomCount } },
    ]);

    // 4) Yangi attempt yaratish
    attempt = await Attempt.create({
      studentId,
      testId,
      questions,
    });

    res.json({
      success: true,
      questions,
      attemptId: attempt._id,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
