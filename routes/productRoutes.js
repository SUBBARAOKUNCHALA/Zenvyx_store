const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const {
    addProduct,
    getAllProducts,
    updateProduct,
    getSimilarProducts,
    getProductById
} = require("../controllers/productController");

// public get products
router.get("/", getAllProducts);
router.get("/:productId/similar",getSimilarProducts); // first
router.get("/:productId", getProductById); // after

// public add product for now
router.post("/", upload.array("images", 4),addProduct);
router.put(
  "/update/:productId",
  upload.array("images", 4),updateProduct
);

module.exports = router;