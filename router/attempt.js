const express = require("express");
const router = express.Router();
const Attempt = require("../model/attempt");
const controller = require("../controller/attempt");

// Testni boshlash (random savollar + attempt yaratish)
router.post("/api/attempt/start", controller.startAttempt);

// GET /api/attempt/:id → Attemptni olish
router.get("/api/attempt/:id", async (req, res) => {
  try {
    const attempt = await Attempt.findById(req.params.id);

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: "Attempt topilmadi",
      });
    }

    res.json({
      success: true,
      data: attempt,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
