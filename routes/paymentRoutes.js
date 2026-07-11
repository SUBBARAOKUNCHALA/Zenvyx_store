const express = require("express");
const router = express.Router();

const {
  createRazorpayOrder,
  verifyRazorpayPayment,
  // webhook,
  // checkPaymentStatus,
} = require("../controllers/paymentController");

const protect = require("../middleware/authMiddleware");
const { paymentLimiter } = require("../middleware/rateLimiter");

/*
|--------------------------------------------------------------------------
| Razorpay Payment APIs
|--------------------------------------------------------------------------
*/

// Create Razorpay Order
router.post(
  "/create-order",
  protect,
  paymentLimiter,
  createRazorpayOrder
);

// Verify Payment Signature
router.post(
  "/verify",
  protect,
  paymentLimiter,
  verifyRazorpayPayment
);

/*
|--------------------------------------------------------------------------
| Production APIs (Enable in Step 6 & Step 7)
|--------------------------------------------------------------------------
*/

// Razorpay Webhook
// router.post(
//   "/webhook",
//   express.raw({ type: "application/json" }),
//   webhook
// );

// Check Payment Status
// router.get(
//   "/status/:paymentId",
//   protect,
//   checkPaymentStatus
// );

module.exports = router;