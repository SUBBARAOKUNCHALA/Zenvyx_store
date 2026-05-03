const rateLimit = require("express-rate-limit");

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 200, // max 200 requests
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // only 10 login attempts
  message: {
    success: false,
    message: "Too many login attempts. Try after 15 minutes.",
  },
});

const paymentLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    message: "Too many payment requests. Please wait.",
  },
});

// 🧑‍💼 Admin limiter
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    message: "Admin API limit exceeded.",
  },
});

const userLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 mins
  max: 100, // allow more requests
  message: {
    success: false,
    message: "Too many cart actions. Please slow down.",
  },
});

module.exports = {
  globalLimiter,
  authLimiter,
  paymentLimiter,
  adminLimiter,
  userLimiter
};