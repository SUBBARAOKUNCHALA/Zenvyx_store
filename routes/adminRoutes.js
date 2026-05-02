const express = require("express");
const router = express.Router();
const adminProtect = require("../middleware/AdminProtect");
const { getDashboardData } = require("../controllers/adminController");
const {adminLogin}=require("../controllers/adminController")
const {getAllOrders,updateOrderStatusByAdmin,returnMyOrder,getReturnedOrders,updateReturnStatusByAdmin}=require("../controllers/orderController")
router.post("/login", adminLogin);
router.get("/dashboard", adminProtect, getDashboardData);
router.get("/all", adminProtect, getAllOrders);
router.put("/:orderId/status", adminProtect, updateOrderStatusByAdmin);
router.post("/:orderId", adminProtect, returnMyOrder);

router.get("/returns", adminProtect, getReturnedOrders);

router.put(
  "/returns/:returnId/status",
  adminProtect,
  updateReturnStatusByAdmin
);

module.exports = router;