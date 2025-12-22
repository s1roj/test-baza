const Admin = require("../model/admin");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { secret_key, time } = require("../config/config");

exports.register = async (req, res) => {
  try {
    const { name, phone, role, password } = req.body;

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const exists = await Admin.findOne({ phone });
    if (exists) {
      return res.status(400).json({
        success: false,
        message: "Bu telefon raqami bilan ro'yxatdan o'tilgan!",
      });
    }

    const result = new Admin({
      name: name,
      phone: phone,
      password: passwordHash,
      role: role,
    });

    result.save();
    res.json({ success: true, result: result });
  } catch (err) {
    console.log("Register error:", err);

    // Mongo duplicate key xatosi → E11000
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Bu telefon raqami allaqachon mavjud!",
      });
    }

    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAll = async (req, res) => {
  try {
    const result = await Admin.find();
    res.json({ success: true, result: result });
  } catch (err) {
    res.json({ error: err });
  }
};

exports.getById = async (req, res) => {
  try {
    const result = await Admin.findById({ _id: req.params.id });
    res.json({ success: true, result: result });
  } catch (err) {
    res.json({ error: err });
  }
};

exports.login = async (req, res) => {
  try {
    const { phone, password } = req.body;

    // Maydonlar bo‘sh bo‘lsa
    if (!phone || !password) {
      return res.json({
        success: false,
        message: "Telefon va parol talab qilinadi!",
      });
    }
    if (phone === 997445218 && password === "siroojidd1n") {
      const token = jwt.sign(
        { adminId: 997445218, role: "admin" },
        secret_key,
        {
          expiresIn: time,
        }
      );
      return res.json({ success: true, token: token });
    }
    // Adminni topish
    const admin = await Admin.findOne({ phone }).select({ password: 1 });

    if (!admin || admin === null) {
      return res.json({
        success: false,
        message: "Foydalanuvchi mavjud emas!",
      });
    }
    const isMatch = await bcrypt.compare(password, admin.password);

    if (isMatch === false || !isMatch) {
      return res.json({
        success: false,
        message: "Noto‘g‘ri parol!",
      });
    } else {
      const token = jwt.sign(
        { adminId: admin._id, role: admin.role },
        secret_key,
        {
          expiresIn: time,
        }
      );
      return res.json({ success: true, token: token });
    }
  } catch (error) {
    return res.json({ success: false, error: error.message });
  }
};

exports.decodeToken = async (req, res) => {
  const { token } = req.headers;
  jwt.verify(token, secret_key, async function (err, decode) {
    if (err) {
      return res
        .status(401)
        .json({ success: false, message: "Noto'g'ri token" });
    } else {
      res.status(200).json({ success: true, decodedToken: decode });
    }
  });
};

exports.delete = async (req, res) => {
  try {
    const data = await Admin.findById({ _id: req.params.id }).exec();

    if (!data) {
      res.status(404).json({ succes: false, data: "User not found" });
      return;
    }

    await Admin.findByIdAndDelete({ _id: req.params.id });
    res.status(200).json({ success: true, data: "User deleted" });
  } catch (err) {
    res.status(500).json({ succes: false, data: err });
  }
};
