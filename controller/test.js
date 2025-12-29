const Test = require("../model/test");
const TestOne = require("../model/testOne");
const TestInfo = require("../model/testInfo");
const Attempt = require("../model/attempt");
const Results = require("../model/result");
const mongoose = require("mongoose");

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
    const data = await Test.findById({ _id: req.params.id }).exec();

    if (!data) {
      res.status(404).json({ succes: false, data: "Post not found" });
      return;
    }

    await Test.findByIdAndDelete({ _id: req.params.id });
    await TestOne.deleteMany({ testId: req.params.id });
    await TestInfo.deleteMany({ testId: req.params.id });
    await Attempt.deleteMany({ testId: req.params.id });
    await Results.deleteMany({ testId: req.params.id });
    res.status(200).json({ success: true, data: "Delete Ishladi" });
  } catch {
    res.status(500).json({ success: false, data: "DeleteIshlamadi" });
  }
};
