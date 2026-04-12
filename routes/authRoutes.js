const express = require("express");
const { register,googleAuth, login, sendOtp, validateOtp, resetPasswordWithOtp } = require("../controllers/authController");

const router = express.Router();

router.post("/register", register);
router.post("/google", googleAuth);
router.post("/login", login);
router.post("/send-otp", sendOtp);
router.post("/validate-otp",validateOtp);
router.post("/reset-password", resetPasswordWithOtp);

module.exports = router;