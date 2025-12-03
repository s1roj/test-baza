const Test = require("../model/testOne");
const fs = require("fs");
const mammoth = require("mammoth");
const mongoose = require("mongoose");

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

    tests = tests.map((t) => ({
      ...t,
      testId,
    }));

    const saved = await Test.insertMany(tests);

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

exports.getRandom = async (req, res) => {
  try {
    const testId = req.query.testId;
    const limit = parseInt(req.query.limit) || 20;

    if (!testId) {
      return res.status(400).json({
        success: false,
        message: "testId yuborilishi shart!",
      });
    }

    const tests = await Test.aggregate([
      { $match: { testId: new mongoose.Types.ObjectId(testId) } },
      { $sample: { size: limit } }, // random tanlaydi
    ]);

    res.json({ success: true, tests });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// CRUD
exports.getAll = async (req, res) => {
  try {
    const data = await Test.find();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const saved = await Test.create(req.body);
    res.json({ success: true, data: saved });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const updated = await Test.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    await Test.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Test o'chirildi" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
