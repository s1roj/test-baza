const Test = require("../model/test");
const TestOne = require("../model/testOne");
const TestInfo = require("../model/testInfo");
const Attempt = require("../model/attempt");
const Results = require("../model/result");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

function generateTestCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

exports.create = async (req, res) => {
  try {
    const { title, desc, duration, creator } = req.body;

    // unikal 4 xonali kod yaratish
    let testCode;
    let exists = true;

    while (exists) {
      testCode = generateTestCode();
      exists = await Test.findOne({ testCode });
    }

    const newTest = await Test.create({
      title,
      desc,
      duration,
      testCode, // yangi maydon
      creator,
    });

    res.json({ success: true, data: newTest });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.toggleTestStatus = async (req, res) => {
  try {
    const test = await Test.findById(req.params.id);
    if (!test) {
      return res
        .status(404)
        .json({ success: false, message: "Test topilmadi" });
    }

    test.isActive = !test.isActive; // ochiq ↔ yopiq
    await test.save();

    res.json({
      success: true,
      isActive: test.isActive,
      message: test.isActive ? "Test ochildi" : "Test yopildi",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAll = async (req, res) => {
  const result = await Test.find();

  res.status(200).json({
    succes: true,
    data: result,
  });
};

exports.getById = async (req, res) => {
  try {
    let id = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "ID noto'g'ri",
      });
    }

    const test = await Test.findById(id);

    if (!test) {
      return res.status(404).json({
        success: false,
        message: "Test topilmadi",
      });
    }

    res.json({
      success: true,
      data: test,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.getByCode = async (req, res) => {
  try {
    const test = await Test.findOne({ testCode: req.params.code });

    if (!test) {
      return res.status(404).json({
        success: false,
        message: "Test kod topilmadi!",
      });
    }

    res.json({ success: true, data: test });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const testId = req.params.id;

    const test = await Test.findById(testId);
    if (!test) {
      return res
        .status(404)
        .json({ success: false, message: "Test topilmadi" });
    }

    const questions = await TestOne.find({ testId }).lean();

    // 1) Shu testga tegishli barcha image value'larni yig'amiz
    const images = new Set();

    for (const q of questions) {
      (q.questionBlocks || []).forEach((b) => {
        if (b?.type === "image" && b.value) images.add(b.value);
      });

      (q.options || []).forEach((opt) => {
        (opt.blocks || []).forEach((b) => {
          if (b?.type === "image" && b.value) images.add(b.value);
        });
      });
    }

    // 2) Fayllarni o'chirish (faqat boshqa joyda ishlatilmasa)
    for (const imgValue of images) {
      const filePath = getUploadFilePathFromValue(imgValue);
      if (!filePath) continue;

      const usedElsewhere = await isImageUsedElsewhere(testId, imgValue);
      if (usedElsewhere) continue;

      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch {}
    }

    // 3) DB yozuvlarini o'chirish
    await Test.deleteOne({ _id: testId });
    await TestOne.deleteMany({ testId });
    await TestInfo.deleteMany({ testId });
    await Attempt.deleteMany({ testId });
    await Results.deleteMany({ testId });

    return res.status(200).json({
      success: true,
      message: "Test, savollar va tegishli rasmlar o‘chirildi",
    });
  } catch (err) {
    console.error("DELETE TEST ERROR:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Testni o‘chirishda xatolik",
    });
  }
};
