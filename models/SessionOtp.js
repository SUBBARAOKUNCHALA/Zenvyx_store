const mongoose = require("mongoose");

const sessionOtpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
  },
  otp: {
    type: String,
    required: true,
  },
  otpExpire: {
    type: Date,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 600,
  },
});

module.exports = mongoose.model("SessionOtp", sessionOtpSchema);