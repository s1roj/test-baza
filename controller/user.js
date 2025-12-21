const User = require("../model/user");
const Result = require("../model/result");
const axios = require("axios");

exports.register = async (req, res) => {
  try {
    const { name, faculty, groupNumber } = req.body;

    const result = new User({
      name: name,
      faculty: faculty,
      groupNumber: groupNumber,
    });

    result.save();
    res.json({ success: true, result: result });
  } catch (err) {
    res.json({ error: err });
  }
};

exports.studentLogin = async (req, res) => {
  try {
    const response = await axios.post(
      "https://student.tdmau.uz/rest/v1/auth/login",
      req.body,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    // student API javobini to‘liq qaytaramiz
    res.json(response.data);
  } catch (error) {
    console.error(
      "Student login error:",
      error.response?.data || error.message
    );

    res.status(401).json({
      success: false,
      message: "Talaba loginida xatolik",
    });
  }
};

exports.getStudentMe = async (req, res) => {
  try {
    const token = req.headers.authorization;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Token yuborilmadi",
      });
    }

    const response = await axios.get(
      "https://student.tdmau.uz/rest/v1/account/me",
      {
        headers: {
          Authorization: token, // Bearer token shu yerda
          Accept: "application/json",
        },
      }
    );

    res.json({
      success: true,
      data: response.data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Student API dan ma'lumot olinmadi",
      error: error.response?.data || error.message,
    });
  }
};

exports.getAll = async (req, res) => {
  try {
    const result = await User.find();
    res.json({ success: true, result: result });
  } catch (err) {
    res.json({ error: err });
  }
};

exports.getById = async (req, res) => {
  try {
    const result = await User.findById({ _id: req.params.id });
    res.json({ success: true, result: result });
  } catch (err) {
    res.json({ error: err });
  }
};

exports.deleteAllStudents = async (req, res) => {
  try {
    // faqat admin o‘chira oladi
    if (req.body.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Ruxsat yo‘q! Buni faqat admin bajarishi mumkin.",
      });
    }

    // 1) Barcha studentlarni o‘chirish
    const deleteStudents = await User.deleteMany({ role: "student" });

    // 2) Barcha resultlarni o‘chirish
    const deleteResults = await Result.deleteMany({});

    res.json({
      success: true,
      message: "Barcha talabalar va barcha natijalar o‘chirildi!",
      deletedStudents: deleteStudents.deletedCount,
      deletedResults: deleteResults.deletedCount,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
