const fs = require("fs");
const os = require("os");
const { execFileSync } = require("child_process");
const path = require("path");
const crypto = require("crypto");
const mammoth = require("mammoth");
const mongoose = require("mongoose");
const TestOne = require("../model/testOne");
const Attempt = require("../model/attempt");
const TestInfo = require("../model/testInfo");
const cheerio = require("cheerio");
const BASE_URL = "http://localhost:3100";

const SOFFICE =
  process.platform === "win32"
    ? "C:\\Program Files\\LibreOffice\\program\\soffice.exe"
    : "soffice";

const PANDOC =
  process.platform === "win32"
    ? "C:\\Users\\eltnk\\AppData\\Local\\Pandoc\\pandoc.exe"
    : "pandoc";

const MAGICK =
  process.platform === "win32"
    ? "C:\\Program Files\\ImageMagick-7.1.2-Q16-HDRI\\magick.exe"
    : "magick";

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
  const createdFiles = [];

  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "File yuklanmadi!" });
    }

    const testId = req.body.testId;
    if (!testId) {
      fs.unlinkSync(req.file.path);
      return res
        .status(400)
        .json({ success: false, message: "testId yuborilishi shart!" });
    }

    const randomCount = Number(req.body.randomCount || 0);
    if (randomCount) {
      await TestInfo.findOneAndUpdate(
        { testId },
        { randomCount },
        { upsert: true, new: true }
      );
    }

    const { html: rawHtml, tmpDir } = convertDocxToHtmlPandoc(req.file.path);

    const html = moveImagesToUploadsAndRewriteHtml(
      rawHtml,
      tmpDir,
      BASE_URL,
      createdFiles
    );

    let tests = parseHtmlToTests(html, BASE_URL);
    tests = tests.map((t) => ({ ...t, testId }));

    if (!tests.length) {
      for (const f of createdFiles) {
        try {
          if (f?.abs && fs.existsSync(f.abs)) fs.unlinkSync(f.abs);
        } catch {}
      }

      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {}
      try {
        fs.unlinkSync(req.file.path);
      } catch {}

      return res.status(400).json({
        success: false,
        message:
          "Word shabloni bo‘yicha savol/variant topilmadi (*, +, = ni tekshiring). Rasmlar ham saqlanmadi.",
      });
    }

    cleanupUnusedUploadedImages(createdFiles, tests);

    const saved = await TestOne.insertMany(tests);

    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
    fs.unlinkSync(req.file.path);

    return res.json({ success: true, totalSaved: saved.length });
  } catch (err) {
    for (const fp of createdFiles) {
      try {
        fs.unlinkSync(fp);
      } catch {}
    }
    try {
      if (req.file?.path) fs.unlinkSync(req.file.path);
    } catch {}

    return res.status(500).json({ success: false, message: err.message });
  }
};

function convertDocxToHtmlPandoc(docxPath) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "docx-"));
  const outHtml = path.join(tmpDir, "out.html");

  try {
    execFileSync(
      PANDOC,
      [
        "-f",
        "docx",
        docxPath,
        "-t",
        "html",
        "--mathjax",
        "--extract-media",
        tmpDir,
        "-o",
        outHtml,
      ],
      { stdio: "pipe" }
    );
  } catch (e) {
    const msg = e?.stderr ? e.stderr.toString() : e.message;
    throw new Error("Pandoc xatosi: " + msg);
  }

  if (!fs.existsSync(outHtml)) {
    throw new Error("Pandoc HTML chiqarmadi (out.html topilmadi)");
  }

  let html = fs.readFileSync(outHtml, "utf8");
  html = html.replace(/<br\s*\/?>/gi, "\n");
  return { html, tmpDir };
}

function moveImagesToUploadsAndRewriteHtml(
  html,
  tmpDir,
  baseUrl,
  createdFiles
) {
  html = html.replace(/&lt;(img\b[^&]*)&gt;/gi, "<$1>");

  return html.replace(
    /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi,
    (fullTag, src) => {
      let localPath = src;

      if (localPath.startsWith("file://")) {
        localPath = localPath.replace("file:///", "").replace("file://", "");
        localPath = localPath.replace(/^\/([A-Za-z]:\/)/, "$1");
      } else {
        localPath = path.isAbsolute(localPath)
          ? localPath
          : path.join(tmpDir, localPath);
      }

      if (!fs.existsSync(localPath)) return fullTag;

      const origExt = path.extname(localPath).toLowerCase();
      let finalPath = localPath;

      if (origExt === ".wmf" || origExt === ".emf" || origExt === ".x-wmf") {
        finalPath = convertVectorToPng(localPath, path.dirname(localPath), {
          density: 900,
          padding: 5,
        });
      } else {
        finalPath = normalizeRasterImage(
          localPath,
          path.dirname(localPath),
          70
        );
      }

      const ext = (path.extname(finalPath) || ".png").toLowerCase();

      const fileName = `${Date.now()}-${crypto
        .randomBytes(6)
        .toString("hex")}${ext}`;
      const uploadDir = path.resolve("uploads");
      const uploadAbs = path.join(uploadDir, fileName);

      if (!fs.existsSync(uploadDir))
        fs.mkdirSync(uploadDir, { recursive: true });

      fs.copyFileSync(finalPath, uploadAbs);

      const newSrc = `/uploads/${fileName}`;

      createdFiles.push({
        abs: uploadAbs,
        rel: newSrc,
      });
      return fullTag.replace(src, newSrc);
    }
  );
}

function htmlToBlocks(htmlLine, baseUrl) {
  const blocks = [];
  const $ = cheerio.load(`<root>${htmlLine || ""}</root>`, {
    decodeEntities: true,
  });

  function pushBlock(block) {
    if (!block || !block.value || !String(block.value).trim()) return;

    // ketma-ket bir xil turdagi blocklarni birlashtiramiz
    const last = blocks[blocks.length - 1];
    if (last && last.type === block.type) {
      // text/math birlashadi
      last.value += block.type === "image" ? "" : block.value;
      return;
    }
    blocks.push(block);
  }

  function cleanSrc(src) {
    let s = String(src || "").trim();
    try {
      if (s.startsWith("http")) s = new URL(s).pathname;
    } catch {}
    if (!s.startsWith("/")) s = "/" + s;
    return s;
  }

  // Text ichida ham \(..\), \[..], $$..$$ bo‘lsa ajratib yuboradi
  function splitTextIntoTextAndMath(text) {
    const t = String(text || "").replace(/\u00A0/g, " "); // NBSP->space (ichki space’ga tegmaymiz)
    const re = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\))/g;

    let last = 0;
    let m;
    while ((m = re.exec(t)) !== null) {
      const before = t.slice(last, m.index);
      if (before) pushBlock({ type: "text", value: before });

      // math ichidagi newline larni yumshatamiz (Pandoc ba’zan \n qo‘yadi)
      const math = m[1].replace(/\r?\n/g, " ");
      pushBlock({ type: "math", value: math });

      last = re.lastIndex;
    }

    const after = t.slice(last);
    if (after) pushBlock({ type: "text", value: after });
  }

  function walk(node) {
    if (!node) return;

    // text node
    if (node.type === "text") {
      splitTextIntoTextAndMath(node.data);
      return;
    }

    if (node.type === "tag") {
      const name = (node.name || "").toLowerCase();

      if (name === "img") {
        const src = $(node).attr("src");
        if (src) pushBlock({ type: "image", value: cleanSrc(src) });
        return;
      }

      // Pandoc math: <span class="math inline">\( ... \)</span>
      if (name === "span" && ($(node).attr("class") || "").includes("math")) {
        let tex = $(node).text() || "";
        tex = tex.replace(/\r?\n/g, " ").trim();
        if (tex) pushBlock({ type: "math", value: tex });
        return;
      }

      // boshqa taglar — ichiga kiramiz
      $(node)
        .contents()
        .each((_, ch) => walk(ch));
      return;
    }
  }

  $("root")
    .contents()
    .each((_, n) => walk(n));

  // oxirida bo‘sh blocklarni tashlaymiz
  return blocks.filter((b) => b && b.value && String(b.value).trim() !== "");
}

function extractLeadingMarker(blocks) {
  const out = Array.isArray(blocks) ? blocks.map((b) => ({ ...b })) : [];
  let marker = null;

  for (let i = 0; i < out.length; i++) {
    const b = out[i];
    if (!b || b.type !== "text") continue;

    // faqat boshidagi marker
    const m = String(b.value || "").match(/^[\s\u00A0]*([*+=])[\s\u00A0]*/);
    if (!m) break;

    marker = m[1];
    // marker va uning ortidan kelgan bo‘sh joylarni olib tashlaymiz
    b.value = String(b.value).replace(/^[\s\u00A0]*([*+=])[\s\u00A0]*/, "");
    // agar text bo‘sh bo‘lib qolsa, blockni o‘chirib yuboramiz
    if (!b.value || !b.value.trim()) out.splice(i, 1);
    break;
  }

  return { marker, blocks: out };
}

function parseHtmlToTests(html, baseUrl) {
  const lines = extractLogicalLinesFromHtml(html);

  const tests = [];

  let questionBlocks = [];
  let options = [];
  let mode = null; // "question" | "option" | null

  const normalizeBlocks = (blocks) =>
    (Array.isArray(blocks) ? blocks : []).filter(
      (b) => b && typeof b.value === "string" && b.value.trim() !== ""
    );

  const flush = () => {
    questionBlocks = normalizeBlocks(questionBlocks);
    if (questionBlocks.length === 0) return;

    const cleaned = options
      .map((o) => ({ ...o, blocks: normalizeBlocks(o.blocks) }))
      .filter((o) => o.blocks.length > 0);

    if (cleaned.length < 2) return;

    const correctIndex = cleaned.findIndex((o) => o.isCorrect);
    if (correctIndex === -1) return; // to‘g‘ri javob yo‘q bo‘lsa tashlaymiz

    const optionObjs = cleaned.map((o) => ({ blocks: o.blocks }));
    const { newOptions, newCorrectIndex } = shuffleOptionsKeepCorrect(
      optionObjs,
      correctIndex
    );

    tests.push({
      questionBlocks,
      options: newOptions,
      correctIndex: newCorrectIndex,
    });
  };

  for (const lineHtml of lines) {
    const blocks = htmlToBlocks(lineHtml, baseUrl);

    // marker faqat satr boshida: * + =
    const markerInfo = extractLeadingMarker(blocks); // { marker: "*|+|=" | null, blocks }

    if (markerInfo.marker === "*") {
      flush();
      questionBlocks = markerInfo.blocks;
      options = [];
      mode = "question";
      continue;
    }

    if (markerInfo.marker === "+") {
      options.push({ blocks: markerInfo.blocks, isCorrect: true });
      mode = "option";
      continue;
    }

    if (markerInfo.marker === "=") {
      options.push({ blocks: markerInfo.blocks, isCorrect: false });
      mode = "option";
      continue;
    }

    // marker yo‘q — davom satr
    if (!markerInfo.blocks.length) continue;

    if (mode === "option" && options.length > 0) {
      options[options.length - 1].blocks = (
        options[options.length - 1].blocks || []
      ).concat(markerInfo.blocks);
    } else if (mode === "question") {
      questionBlocks = (questionBlocks || []).concat(markerInfo.blocks);
    }
  }

  flush();
  return tests;
}

function extractLogicalLinesFromHtml(html) {
  const $ = cheerio.load(html || "", { decodeEntities: true });

  const root = $("body").length ? $("body") : $.root();
  const lines = [];

  function pushLine(parts) {
    const s = parts.join("");
    if (String(s).replace(/\s+/g, "").length > 0) lines.push(s);
  }

  function splitByBr($container) {
    const parts = [];
    let current = [];

    $container.contents().each((_, node) => {
      if (
        node.type === "tag" &&
        node.name &&
        node.name.toLowerCase() === "br"
      ) {
        pushLine(current);
        current = [];
      } else {
        current.push($.html(node));
      }
    });

    pushLine(current);
  }

  // Pandoc odatda <p> bilan beradi, ba’zan div/section ham bo‘lishi mumkin
  root.find("p").each((_, p) => {
    splitByBr($(p));
  });

  // agar p topilmasa (kam holat) — body ichidagi br bo‘yicha bo‘lamiz
  if (lines.length === 0) {
    splitByBr(root);
  }

  return lines;
}

function convertVectorToPng(localPath, workDir) {
  const ext = path.extname(localPath).toLowerCase();
  if (![".wmf", ".emf"].includes(ext)) return localPath;

  const base = path.basename(localPath, ext);
  const outPng = path.join(workDir, base + ".png");

  try {
    execFileSync(
      MAGICK,
      [
        "-density",
        "900",
        localPath,
        "-colorspace",
        "sRGB",
        "-background",
        "white",
        "-alpha",
        "remove",
        "-alpha",
        "off",

        "-fuzz",
        "10%",
        "-trim",
        "+repage",

        "-resize",
        "250%",
        "-bordercolor",
        "white",
        "-border",
        "5x5",

        "-quality",
        "100",
        outPng,
      ],
      { stdio: "pipe" }
    );

    if (fs.existsSync(outPng)) return outPng;
  } catch (e) {}

  const before = new Set(fs.readdirSync(workDir));

  try {
    execFileSync(
      SOFFICE,
      [
        "--headless",
        "--nologo",
        "--nolockcheck",
        "--norestore",
        "--convert-to",
        "png",
        "--outdir",
        workDir,
        localPath,
      ],
      { stdio: "pipe" }
    );
  } catch (e) {
    const msg = e?.stderr ? e.stderr.toString() : e.message;
    throw new Error("WMF/EMF ni LibreOffice ham PNG qila olmadi: " + msg);
  }

  const after = fs.readdirSync(workDir);
  const newPng = after
    .filter((f) => !before.has(f))
    .find((f) => f.toLowerCase().endsWith(".png"));

  const produced = newPng
    ? path.join(workDir, newPng)
    : fs.existsSync(outPng)
    ? outPng
    : null;

  if (!produced) {
    throw new Error("WMF/EMF PNG ga aylantirilmadi (png fayl topilmadi).");
  }

  try {
    const out2 = path.join(workDir, base + ".opt.png");
    execFileSync(
      MAGICK,
      [
        produced,
        "-background",
        "white",
        "-alpha",
        "remove",
        "-alpha",
        "off",
        "-trim",
        "+repage",
        "-resize",
        "170%",
        "-bordercolor",
        "white",
        "-border",
        "5x5",
        "-quality",
        "100",
        out2,
      ],
      { stdio: "pipe" }
    );
    if (fs.existsSync(out2)) return out2;
  } catch (_) {}

  return produced;
}

function normalizeRasterImage(localPath, workDir, targetWidth = 250) {
  const ext = path.extname(localPath).toLowerCase();
  if (![".png", ".jpg", ".jpeg", ".webp"].includes(ext)) return localPath;

  const MAGICK = process.platform === "win32" ? "magick" : "magick";
  const base = path.basename(localPath, ext);
  const out = path.join(workDir, base + `.w${targetWidth}.png`);

  try {
    execFileSync(
      MAGICK,
      [
        localPath,
        "-auto-orient",
        "-resize",
        `${targetWidth}x`, // faqat width, height auto
        "-strip",
        "-quality",
        "92",
        out,
      ],
      { stdio: "ignore" }
    );
    if (fs.existsSync(out)) return out;
  } catch (_) {}

  return localPath;
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

function normalizeImgValueToRel(v) {
  if (!v) return "";
  let s = String(v).trim();
  try {
    if (s.startsWith("http://") || s.startsWith("https://")) {
      s = new URL(s).pathname;
    }
  } catch {}
  s = s.split("?")[0].split("#")[0];
  if (!s.startsWith("/")) s = "/" + s;
  return s;
}

function collectUsedImagesFromTests(tests) {
  const used = new Set();

  for (const t of tests || []) {
    (t.questionBlocks || []).forEach((b) => {
      if (b?.type === "image") used.add(normalizeImgValueToRel(b.value));
    });

    (t.options || []).forEach((opt) => {
      (opt.blocks || []).forEach((b) => {
        if (b?.type === "image") used.add(normalizeImgValueToRel(b.value));
      });
    });
  }

  return used;
}

function cleanupUnusedUploadedImages(createdFiles, tests) {
  const used = collectUsedImagesFromTests(tests);

  for (const f of createdFiles || []) {
    const rel = normalizeImgValueToRel(f?.rel);
    if (!rel) continue;

    // testlarda ishlatilmagan bo'lsa o'chiramiz
    if (!used.has(rel)) {
      try {
        if (f?.abs && fs.existsSync(f.abs)) fs.unlinkSync(f.abs);
      } catch {}
    }
  }
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
