const express = require("express");

const {
  register,
  googleAuth,
  login,
  sendOtp,
  validateOtp,
  resetPasswordWithOtp,
} = require("../controllers/authController");

const { authLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

router.post("/register", authLimiter, register);
router.post("/google", authLimiter, googleAuth);
router.post("/login", authLimiter, login);
router.post("/send-otp", authLimiter, sendOtp);
router.post("/validate-otp", authLimiter, validateOtp);
router.post("/reset-password", authLimiter, resetPasswordWithOtp);

module.exports = router;