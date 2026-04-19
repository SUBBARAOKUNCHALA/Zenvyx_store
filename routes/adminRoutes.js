const express = require("express");
const router = express.Router();
const adminProtect = require("../middleware/AdminProtect");
const { getDashboardData } = require("../controllers/adminController");
const {adminLogin}=require("../controllers/adminController")
const {getAllOrders,updateOrderStatusByAdmin}=require("../controllers/orderController")
router.post("/login", adminLogin);
router.get("/dashboard", adminProtect, getDashboardData);
router.get("/all", adminProtect, getAllOrders);
router.put("/:orderId/status", adminProtect, updateOrderStatusByAdmin);

module.exports = router;