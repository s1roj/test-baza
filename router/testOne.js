const express = require("express");
const router = express.Router();
const controller = require("../controller/testOne");
const multer = require("multer");
const upload = multer({ dest: "uploads/" });

// Word yuklash
router.post(
  "/api/testOne/upload",
  upload.single("file"),
  controller.uploadWord
);
router.get("/api/testOne/start", controller.startTest);

// CRUD
router.post("/api/testOne/create", controller.create);
router.get("/api/testOne/all", controller.getAll);
router.get("/api/testOne/:id", controller.getById);
router.put("/api/testOne/update/:id", controller.update);
router.delete("/api/testOne/delete/:id", controller.delete);

// TESTLAR APIsi
router.delete("/api/testOne/deleteByTest/:testId", controller.deleteByTestId);
router.delete("/api/test/delete/full/:id", controller.deleteFullTest);

module.exports = router;
