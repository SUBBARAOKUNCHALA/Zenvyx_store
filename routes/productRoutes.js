const express = require("express");
const router = express.Router();

const upload = require("../middleware/upload");
const adminProtect = require("../middleware/AdminProtect");
const { adminLimiter } = require("../middleware/rateLimiter");

const {
  addProduct,
  getAllProducts,
  updateProduct,
  getSimilarProducts,
  getProductById,
} = require("../controllers/productController");

// public get products
router.get("/", getAllProducts);
router.get("/:productId/similar", getSimilarProducts);
router.get("/:productId", getProductById);

// admin add product
router.post(
  "/add",
  adminProtect,
  adminLimiter,
  upload.array("images", 4),
  addProduct
);


// admin update product
router.put(
  "/update/:productId",
  adminProtect,
  adminLimiter,
  upload.array("images", 4),
  updateProduct
);

module.exports = router;