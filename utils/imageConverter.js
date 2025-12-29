const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { exec } = require("child_process");

const UPLOAD_DIR = path.join(__dirname, "../uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

const isWin = process.platform === "win32";
const IM_CMD = isWin ? "magick" : "convert";

function randomName(ext = "png") {
  return crypto.randomBytes(16).toString("hex") + "." + ext;
}

exports.saveImage = async (buffer, contentType) => {
  const isWMF =
    contentType === "image/wmf" ||
    contentType === "image/x-wmf" ||
    contentType === "image/emf" ||
    contentType === "image/x-emf";

  if (!isWMF) {
    const name = randomName("png");
    fs.writeFileSync(path.join(UPLOAD_DIR, name), buffer);
    return "/uploads/" + name;
  }

  const tmpName = randomName("wmf");
  const tmpPath = path.join(UPLOAD_DIR, tmpName);

  const outName = randomName("png");
  const outPath = path.join(UPLOAD_DIR, outName);

  fs.writeFileSync(tmpPath, buffer);

  await new Promise((resolve, reject) => {
    exec(`${IM_CMD} "${tmpPath}" "${outPath}"`, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });

  fs.unlinkSync(tmpPath);

  return "/uploads/" + outName;
};
