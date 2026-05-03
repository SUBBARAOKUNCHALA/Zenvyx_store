const express = require("express");
const router = express.Router();

const protect = require("../middleware/authMiddleware");
const adminProtect = require("../middleware/AdminProtect");

const {
  userLimiter,
  paymentLimiter,
  adminLimiter,
} = require("../middleware/rateLimiter");

const {
  getCheckoutSummary,
  placeOrder,
  getMyOrders,
  getOrderById,
  cancelMyOrder,
  getAllOrders,
  updateOrderStatusByAdmin,
  returnMyOrder,
} = require("../controllers/orderController");

// USER ROUTES

router.get("/checkout-summary", protect, userLimiter, getCheckoutSummary);

//  VERY IMPORTANT → protect order placement
router.post("/place", protect, paymentLimiter, placeOrder);

router.get("/my-orders", protect, userLimiter, getMyOrders);
router.get("/:orderId", protect, userLimiter, getOrderById);

router.put("/:orderId/cancel", protect, userLimiter, cancelMyOrder);
router.put("/:orderId/return", protect, userLimiter, returnMyOrder);


//  ADMIN ROUTES

router.get(
  "/admin/all",
  protect,
  adminProtect,
  adminLimiter,
  getAllOrders
);

router.put(
  "/admin/:orderId/status",
  protect,
  adminProtect,
  adminLimiter,
  updateOrderStatusByAdmin
);

module.exports = router;