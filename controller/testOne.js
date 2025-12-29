const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const mammoth = require("mammoth");
const mongoose = require("mongoose");
const TestOne = require("../model/testOne");
const Attempt = require("../model/attempt");
const TestInfo = require("../model/testInfo");
const { saveImage } = require("../utils/imageConverter");
const BASE_URL = "http://localhost:3100";

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

    // 1) testId tekshir
    const testId = req.body.testId;
    if (!testId) {
      return res
        .status(400)
        .json({ success: false, message: "testId yuborilishi shart!" });
    }

    // 2) randomCount saqlash
    const randomCount = Number(req.body.randomCount || 0);
    if (randomCount) {
      await TestInfo.findOneAndUpdate(
        { testId },
        { randomCount },
        { upsert: true, new: true }
      );
    }

    // 3) Word -> HTML + rasmni uploads ga yozish
    const result = await mammoth.convertToHtml(
      { path: req.file.path },
      {
        convertImage: mammoth.images.inline(async (image) => {
          const buffer = await image.read();
          const src = await saveImage(buffer, image.contentType);

          return { src };
        }),
      }
    );

    const html = result.value || "";

    // 4) HTML -> tests (blocks)
    let tests = parseHtmlToTests(html, BASE_URL);

    // 5) testId qo'shish
    tests = tests.map((t) => ({ ...t, testId }));

    // 6) insert
    const saved = await TestOne.insertMany(tests);

    // 7) temp file o'chirish
    fs.unlinkSync(req.file.path);

    res.json({ success: true, totalSaved: saved.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

function stripOuterP(htmlLine) {
  // <p>...</p> ni tashlab, ichini olib beradi
  return htmlLine
    .replace(/^<p[^>]*>/i, "")
    .replace(/<\/p>$/i, "")
    .trim();
}

function cleanTextOnly(htmlLine) {
  return String(htmlLine || "")
    .replace(/<img[^>]*>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function htmlToBlocks(htmlLine, baseUrl) {
  // line ichida text + <img> + text bo'lishi mumkin
  // buni ketma-ket blocklarga ajratamiz
  const blocks = [];

  let s = stripOuterP(htmlLine);

  // <img ...> lar bo'yicha parchalash
  // regex img taglarini topadi
  const imgRegex = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*\/?>/gi;

  let lastIndex = 0;
  let match;

  while ((match = imgRegex.exec(s)) !== null) {
    const imgTagStart = match.index;
    const imgTagEnd = imgRegex.lastIndex;
    const src = match[1];

    // img dan oldingi text
    const before = s.slice(lastIndex, imgTagStart);
    const beforeText = before
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .trim();
    if (beforeText) blocks.push({ type: "text", value: beforeText });

    // img block
    const abs = src.startsWith("http")
      ? src
      : `${baseUrl}${src.startsWith("/") ? "" : "/"}${src}`;
    blocks.push({ type: "image", value: abs });

    lastIndex = imgTagEnd;
  }

  // oxirgi text
  const after = s.slice(lastIndex);
  const afterText = after
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
  if (afterText) blocks.push({ type: "text", value: afterText });

  // Agar umuman img bo'lmasa, textni block qilamiz
  if (blocks.length === 0) {
    const onlyText = cleanTextOnly(s);
    if (onlyText) blocks.push({ type: "text", value: onlyText });
  }

  return blocks;
}

function parseHtmlToTests(html, baseUrl) {
  // mammoth ko'pincha <p> ... </p> beradi.
  // Har bir <p> ni alohida line deb olamiz.
  const lines = String(html || "")
    .replace(/\r/g, "")
    .replace(/<\/p>/gi, "\n")
    .replace(/<p[^>]*>/gi, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const tests = [];

  let questionBlocks = [];
  let options = []; // { blocks, isCorrect }

  for (const rawLine of lines) {
    // prefixni aniqlash uchun text-only
    const check = cleanTextOnly(rawLine);

    // Savol boshlanishi: "*"
    if (check.startsWith("*")) {
      if (questionBlocks.length && options.length >= 2) {
        tests.push(testBuilder(questionBlocks, options));
      }

      // savolning o'zi ( * ni olib tashlaymiz )
      const qLine = rawLine.replace(/^\s*\*\s*/, "");
      questionBlocks = htmlToBlocks(qLine, baseUrl);
      options = [];
      continue;
    }

    // To'g'ri variant: "+"
    if (check.startsWith("+")) {
      const optLine = rawLine.replace(/^\s*\+\s*/, "");
      options.push({
        blocks: htmlToBlocks(optLine, baseUrl),
        isCorrect: true,
      });
      continue;
    }

    // Oddiy variant: "="
    if (check.startsWith("=")) {
      const optLine = rawLine.replace(/^\s*=\s*/, "");
      options.push({
        blocks: htmlToBlocks(optLine, baseUrl),
        isCorrect: false,
      });
      continue;
    }

    // Savol davomiy qismi: (text yoki img bo'lishi mumkin)
    if (questionBlocks.length) {
      const extraBlocks = htmlToBlocks(rawLine, baseUrl);
      questionBlocks = questionBlocks.concat(extraBlocks);
    }
  }

  // oxirgisi
  if (questionBlocks.length && options.length >= 2) {
    tests.push(testBuilder(questionBlocks, options));
  }

  return tests;
}

function shuffleOptionsKeepCorrect(optionObjs, correctIndex) {
  const arr = optionObjs.map((opt, idx) => ({ opt, idx }));

  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  const newOptions = arr.map((x) => x.opt);
  const newCorrectIndex = arr.findIndex((x) => x.idx === correctIndex);

  return { newOptions, newCorrectIndex };
}

function testBuilder(questionBlocks, opts) {
  const correctIndex = opts.findIndex((o) => o.isCorrect);

  // opts -> DB format (isCorrect olib tashlanadi)
  const optionObjs = opts.map((o) => ({ blocks: o.blocks }));

  if (correctIndex === -1 || optionObjs.length < 2) {
    return {
      questionBlocks,
      options: optionObjs,
      correctIndex: Math.max(correctIndex, 0),
    };
  }

  const { newOptions, newCorrectIndex } = shuffleOptionsKeepCorrect(
    optionObjs,
    correctIndex
  );

  return {
    questionBlocks,
    options: newOptions,
    correctIndex: newCorrectIndex,
  };
}

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

