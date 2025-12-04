const express = require("express");
const router = express.Router();
const controller = require("../controller/result");

router.post("/api/result/save", controller.saveResult);
router.get("/api/result/:id", controller.getByAttempt);

module.exports = router;
