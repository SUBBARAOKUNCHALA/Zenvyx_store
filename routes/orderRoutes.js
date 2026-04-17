const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const {
  getCheckoutSummary,
  placeOrder,
  getMyOrders,
  getOrderById,
} = require("../controllers/orderController");

router.get("/checkout-summary", protect, getCheckoutSummary);
router.post("/place", protect, placeOrder);
router.get("/my-orders", protect, getMyOrders);
router.get("/:orderId", protect, getOrderById);

module.exports = router;