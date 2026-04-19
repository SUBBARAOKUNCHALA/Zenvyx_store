const express = require("express");
const router = express.Router();

const protect = require("../middleware/authMiddleware");
// const adminProtect = require("../middleware/adminMiddleware");

const {
  getCheckoutSummary,
  placeOrder,
  getMyOrders,
  getOrderById,
  cancelMyOrder,
  getAllOrders,
  updateOrderStatusByAdmin,
} = require("../controllers/orderController");

router.get("/checkout-summary", protect, getCheckoutSummary);
router.post("/place", protect, placeOrder);
router.get("/my-orders", protect, getMyOrders);
router.get("/:orderId", protect, getOrderById);
router.put("/:orderId/cancel", protect, cancelMyOrder);

// admin
// router.get("/admin/all", protect, getAllOrders);
// router.put("/admin/:orderId/status", protect, updateOrderStatusByAdmin);
// better:
// router.get("/admin/all", protect, adminProtect, getAllOrders);
// router.put("/admin/:orderId/status", protect, adminProtect, updateOrderStatusByAdmin);

module.exports = router;