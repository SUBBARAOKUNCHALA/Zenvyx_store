const express = require("express");
const router = express.Router();

const adminProtect = require("../middleware/AdminProtect");

const { adminLogin, getDashboardData } = require("../controllers/adminController");

const {
  getAllOrders,
  updateOrderStatusByAdmin,
  returnMyOrder,
  getReturnedOrders,
  updateReturnStatusByAdmin,
} = require("../controllers/orderController");

const {
  getPaymentReports,
  exportPaymentsCSV,
} = require("../controllers/adminReportController");

const {
  authLimiter,
  adminLimiter,
} = require("../middleware/rateLimiter");

// Admin login - strict limiter
router.post("/login", authLimiter, adminLogin);

// Admin dashboard
router.get("/dashboard", adminProtect, adminLimiter, getDashboardData);

// Orders
router.get("/all", adminProtect, adminLimiter, getAllOrders);
router.put("/:orderId/status", adminProtect, adminLimiter, updateOrderStatusByAdmin);

// Return request from admin side if needed
router.post("/:orderId", adminProtect, adminLimiter, returnMyOrder);

// Reports
router.get("/payments", adminProtect, adminLimiter, getPaymentReports);
router.get("/payments/export/csv", adminProtect, adminLimiter, exportPaymentsCSV);

// Returns
router.get("/returns", adminProtect, adminLimiter, getReturnedOrders);
router.put(
  "/returns/:returnId/status",
  adminProtect,
  adminLimiter,
  updateReturnStatusByAdmin
);

module.exports = router;