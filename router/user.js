const express = require("express");
const router = express.Router();
const controller = require("../controller/user");

router.post("/api/user/register", controller.register);
router.post("/api/user/student/login", controller.studentLogin);
router.get("/api/student/me", controller.getStudentMe);
router.get("/api/user/all", controller.getAll);
router.get("/api/user/:id", controller.getById);
router.delete("/api/user/delete/all", controller.deleteAllStudents);

module.exports = router;
