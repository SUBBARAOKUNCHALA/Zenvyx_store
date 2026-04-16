const express = require("express");
const router = express.Router();

const protect = require("../middleware/authMiddleware");
const {
  addToCart,
  getMyCart,
  updateCartQuantity,
  removeCartItem,
  clearMyCart,
} = require("../controllers/cartController");

router.post("/add", protect, addToCart);
router.get("/", protect, getMyCart);
router.put("/update/:cartItemId", protect, updateCartQuantity);
router.delete("/remove/:cartItemId", protect, removeCartItem);
router.delete("/clear", protect, clearMyCart);

module.exports = router;