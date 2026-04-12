const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const {
    addProduct,
    getAllProducts,
} = require("../controllers/productController");

// public get products
router.get("/", getAllProducts);

// public add product for now
router.post("/", upload.single("image"), addProduct);

module.exports = router;