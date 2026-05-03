const express = require("express");
const router = express.Router();

const {
  createRazorpayOrder,
  verifyRazorpayPayment,
} = require("../controllers/paymentController");

const protect = require("../middleware/authMiddleware");
const { paymentLimiter } = require("../middleware/rateLimiter");

//  Create Razorpay Order (critical API)
router.post(
  "/create-order",
  protect,
  paymentLimiter,
  createRazorpayOrder
);

// Verify Payment (VERY critical)
router.post(
  "/verify",
  protect,
  paymentLimiter,
  verifyRazorpayPayment
);

module.exports = router;