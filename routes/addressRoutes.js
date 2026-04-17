const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const {
  addAddress,
  getMyAddresses,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  getDefaultAddress,
} = require("../controllers/addressController");

router.post("/add", protect, addAddress);
router.get("/my-addresses", protect, getMyAddresses);
router.get("/default", protect, getDefaultAddress);
router.put("/update/:id", protect, updateAddress);
router.delete("/delete/:id", protect, deleteAddress);
router.put("/set-default/:id", protect, setDefaultAddress);

module.exports = router;