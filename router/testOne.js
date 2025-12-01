const express = require("express");
const router = express.Router();
const multer = require("multer");
const md5 = require("md5");
const path = require("path");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./upload");
  },
  filename: (req, file, cb) => {
    cb(null, `${md5(Date.now())}${path.extname(file.originalname)}`);
  },
});

const upload = multer({ storage: storage });

const controller = require("../controller/testOne");

router.post(
  "/api/testOne/upload",
  upload.single("file"),
  controller.uploadWord
);

// router.get("/api/testOne/all", controller.getAll);
// router.put("/api/testOne/update/:id", controller.update);
// router.delete("/api/testOne/delete/:id", controller.delete);

module.exports = router;
