const express = require("express");
const router = express.Router();

const { createRazorpayOrder,verifyRazorpayPayment } = require("../controllers/paymentController");
const protect = require("../middleware/authMiddleware"); // change name if yours is different

router.post("/create-order", protect, createRazorpayOrder);
router.post("/verify", protect, verifyRazorpayPayment);

module.exports = router;