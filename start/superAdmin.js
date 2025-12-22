const Admin = require("../model/admin");
const bcrypt = require("bcryptjs");

module.exports = async function createSuperAdmin() {
  try {
    const phone = "997445218"; // super admin phone
    const plainPassword = "siroojidd1n"; // faqat server ichida

    const exists = await Admin.findOne({ phone });
    if (exists) {
      return;
    }

    const hash = await bcrypt.hash(plainPassword, 10);

    await Admin.create({
      name: "Super Admin",
      phone,
      password: hash,
      role: "admin",
    });
  } catch (err) {
    console.error(err);
  }
};
