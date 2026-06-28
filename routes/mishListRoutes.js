const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const { userLimiter } = require("../middleware/rateLimiter");
const {toggleWishlist,getWishlist,removeWishlist} = require("../controllers/wishlistController");


router.post("/toggle/:productId", protect, toggleWishlist);

router.get("/", protect, getWishlist);

router.delete("/:productId", protect, removeWishlist);

module.exports = router;