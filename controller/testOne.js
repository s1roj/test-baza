const Test = require("../model/test");
const TestOne = require("../model/testOne");
const fs = require("fs");
const mammoth = require("mammoth");
const mongoose = require("mongoose");
const Attempt = require("../model/attempt");
const TestInfo = require("../model/testInfo");

exports.startTest = async (req, res) => {
  try {
    const { studentCode, testId } = req.query;

    // 1) Student oldin test boshlaganmi?
    let attempt = await Attempt.findOne({ studentCode, testId });

    if (attempt) {
      return res.json({
        success: true,
        questions: attempt.questions,
        attemptId: attempt._id,
      });
    }

    // 2) randomCount ni olish
    const info = await TestInfo.findOne({ testId });
    const randomCount = info.randomCount;

    // 3) Random test tanlash
    const questions = await TestOne.aggregate([
      { $match: { testId: new mongoose.Types.ObjectId(testId) } },
      { $sample: { size: randomCount } },
    ]);

    // 4) yangi attempt yaratish
    attempt = await Attempt.create({
      studentCode,
      testId,
      questions,
    });

    res.json({
      success: true,
      questions,
      attemptId: attempt._id,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.uploadWord = async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "File yuklanmadi!" });
    }

    const result = await mammoth.extractRawText({ path: req.file.path });
    const text = result.value;

    let tests = parseWord(text);

    // testId ni testslarga qo‘shamiz
    const testId = req.body.testId;

    if (!testId) {
      return res.status(400).json({
        success: false,
        message: "testId yuborilishi shart!",
      });
    }

    const randomCount = req.body.randomCount;

    if (randomCount) {
      await TestInfo.findOneAndUpdate(
        { testId },
        { randomCount },
        { upsert: true, new: true }
      );
    }

    tests = tests.map((t) => ({
      ...t,
      testId,
    }));

    const saved = await TestOne.insertMany(tests);

    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      totalSaved: saved.length,
      tests: saved,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// WORD PARSER FUNKSIYASI
function parseWord(text) {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const tests = [];
  let question = "";
  let options = [];

  for (let line of lines) {
    // SAVOL — * bilan boshlansa
    if (line.startsWith("*")) {
      if (question && options.length >= 2) {
        tests.push(testBuilder(question, options));
      }

      question = line.substring(1).trim();
      options = [];
      continue;
    }

    // TO‘G‘RI VARIANT — faqat QATOR boshidagi +
    if (/^\+\s*/.test(line)) {
      const text = line.replace(/^\+\s*/, "").trim();
      options.push({ text, isCorrect: true });
      continue;
    }

    // ODDIY VARIANT — faqat QATOR boshidagi =
    if (/^=\s*/.test(line)) {
      const text = line.replace(/^=\s*/, "").trim();
      options.push({ text, isCorrect: false });
      continue;
    }
  }

  // Oxirgi savolni ham saqlash
  if (question && options.length >= 2) {
    tests.push(testBuilder(question, options));
  }

  return tests;
}

// WORD → MODEL FORMATIGA O‘GIRISH
function testBuilder(question, opts) {
  const optionTexts = opts.map((o) => o.text);
  const correctIndex = opts.findIndex((o) => o.isCorrect);

  return {
    question,
    options: optionTexts,
    correctIndex,
  };
}

// CRUD
exports.getAll = async (req, res) => {
  try {
    const data = await TestOne.find();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
exports.getById = async (req, res) => {
  try {
    const data = await TestOne.find({ testId: req.params.id });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const saved = await TestOne.create(req.body);
    res.json({ success: true, data: saved });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const updated = await TestOne.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    await TestOne.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "TestOne o'chirildi" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// TESTLAR APIsi

exports.deleteByTestId = async (req, res) => {
  try {
    const { testId } = req.params;

    await TestOne.deleteMany({
      testId: new mongoose.Types.ObjectId(testId.trim()),
    });

    res.json({
      success: true,
      message: "Ushbu testId ga tegishli barcha savollar o‘chirildi",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteFullTest = async (req, res) => {
  try {
    const { id } = req.params;

    await Test.findByIdAndDelete(id);

    await TestOne.deleteMany({
      testId: new mongoose.Types.ObjectId(id),
    });

    await TestInfo.deleteMany({
      testId: new mongoose.Types.ObjectId(id),
    });

    await Attempt.deleteMany({
      testId: new mongoose.Types.ObjectId(id),
    });

    res.json({
      success: true,
      message: "Test, savollar, testInfo va attemptlar tozalandi!",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
