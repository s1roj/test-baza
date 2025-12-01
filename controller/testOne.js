const fs = require("fs");
const docxParser = require("docx-parser");
const test0ne = require("../model/testOne");

exports.uploadWord = async (req, res) => {
  try {
    const filePath = req.file.path;
    res.json(filePath);
    // docxParser.parseDocx(filePath, async (text) => {
    //   const blocks = text.split(/\n\s*\n/).filter((b) => b.trim() !== "");

    //   const tests = [];

    //   for (let block of blocks) {
    //     const lines = block.split("\n").map((l) => l.trim());

    //     const question = lines[0].replace(/^\d+\.\s*/, "");

    //     const options = [
    //       lines[1].replace(/^A\)\s*/, ""),
    //       lines[2].replace(/^B\)\s*/, ""),
    //       lines[3].replace(/^C\)\s*/, ""),
    //       lines[4].replace(/^D\)\s*/, ""),
    //     ];

    //     const correctLine = lines.find((l) => l.startsWith("Correct:"));
    //     const correctLetter = correctLine.split(":")[1].trim();
    //     const correctIndex = ["A", "B", "C", "D"].indexOf(correctLetter);

    //     tests.push({ question, options, correctIndex });
    //   }

    //   const savedTests = await test0ne.insertMany(tests);

    //   fs.unlinkSync(filePath);

    //   return res.json({
    //     success: true,
    //     saved: savedTests.length,
    //     data: savedTests,
    //   });
    // });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// exports.getAll = async (req, res) => {
//   try {
//     const tests = await test0ne.find();
//     res.json({ success: true, data: tests });
//   } catch (error) {
//     res.status(500).json({ success: false, message: error.message });
//   }
// };

// exports.update = async (req, res) => {
//   try {
//     const test = await test0ne.findByIdAndUpdate(req.params.id, req.body, {
//       new: true,
//     });

//     res.json({ success: true, data: test });
//   } catch (error) {
//     res.status(500).json({ success: false, message: error.message });
//   }
// };

// exports.delete = async (req, res) => {
//   try {
//     const test = await test0ne.findById(req.params.id);

//     if (!test)
//       return res
//         .status(404)
//         .json({ success: false, message: "test0ne topilmadi" });

//     await test0ne.findByIdAndDelete(req.params.id);

//     res.json({ success: true, message: "test0ne o‘chirildi" });
//   } catch (error) {
//     res.status(500).json({ success: false, message: error.message });
//   }
// };
