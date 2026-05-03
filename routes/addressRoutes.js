const express = require("express");
const router = express.Router();

const protect = require("../middleware/authMiddleware");
const { userLimiter } = require("../middleware/rateLimiter");

const {
  addAddress,
  getMyAddresses,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  getDefaultAddress,
} = require("../controllers/addressController");

router.post("/add", protect, userLimiter, addAddress);
router.get("/my-addresses", protect, userLimiter, getMyAddresses);
router.get("/default", protect, userLimiter, getDefaultAddress);
router.put("/update/:id", protect, userLimiter, updateAddress);
router.delete("/delete/:id", protect, userLimiter, deleteAddress);
router.put("/set-default/:id", protect, userLimiter, setDefaultAddress);

module.exports = router;