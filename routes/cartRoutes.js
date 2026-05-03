const express = require("express");
const router = express.Router();

const protect = require("../middleware/authMiddleware");
const { userLimiter } = require("../middleware/rateLimiter");

const {
  addToCart,
  getMyCart,
  updateCartQuantity,
  removeCartItem,
  clearMyCart,
} = require("../controllers/cartController");

router.post("/add", protect, userLimiter, addToCart);
router.get("/", protect, userLimiter, getMyCart);
router.put("/update/:cartItemId", protect, userLimiter, updateCartQuantity);
router.delete("/remove/:cartItemId", protect, userLimiter, removeCartItem);
router.delete("/clear", protect, userLimiter, clearMyCart);

module.exports = router;