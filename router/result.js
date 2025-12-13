const express = require("express");
const router = express.Router();
const controller = require("../controller/result");

router.post("/api/result/save", controller.saveResult);
router.put("/api/result/edit/:id", controller.editResult);
router.get("/api/result/:id", controller.getByAttempt);
router.get("/api/test/:testId/results", controller.getResultsByTest);

module.exports = router;
