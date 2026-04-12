const Product = require("../models/Product");
const cloudinary = require("../config/cloudinary");
const streamifier = require("streamifier");

const uploadFromBuffer = (fileBuffer) => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder: "ecommerce_products",
            },
            (error, result) => {
                if (result) resolve(result);
                else reject(error);
            }
        );

        streamifier.createReadStream(fileBuffer).pipe(stream);
    });
};

// @desc Add product
// @route POST /api/products
exports.addProduct = async (req, res) => {
    try {
        const { name, description, price, category, stock, sizes } = req.body;

        if (!name || !description || !price || !category) {
            return res.status(400).json({
                success: false,
                message: "Name, description, price and category are required",
            });
        }

        if (!sizes) {
            return res.status(400).json({
                success: false,
                message: "Sizes are required",
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Product image is required",
            });
        }

        let parsedSizes = [];

        if (Array.isArray(sizes)) {
            parsedSizes = sizes;
        } else if (typeof sizes === "string") {
            parsedSizes = sizes.split(",").map((size) => size.trim());
        }

        if (parsedSizes.length === 0) {
            return res.status(400).json({
                success: false,
                message: "At least one size is required",
            });
        }

        const allowedCategories = ["Shirt", "T-Shirt", "Pant"];
        if (!allowedCategories.includes(category)) {
            return res.status(400).json({
                success: false,
                message: "Category must be Shirt, T-Shirt, or Pant",
            });
        }

        const allowedSizes = ["S", "M", "L", "XL", "XXL", "28", "30", "32", "34", "36", "38"];
        const invalidSizes = parsedSizes.filter((size) => !allowedSizes.includes(size));

        if (invalidSizes.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Invalid sizes: ${invalidSizes.join(", ")}`,
            });
        }

        const uploadResult = await uploadFromBuffer(req.file.buffer);

        const product = await Product.create({
            name: name.trim(),
            description: description.trim(),
            price: Number(price),
            category: category.trim(),
            stock: stock ? Number(stock) : 0,
            sizes: parsedSizes,
            image: uploadResult.secure_url,
            cloudinaryId: uploadResult.public_id,
        });

        res.status(201).json({
            success: true,
            message: "Product added successfully",
            data: product,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc Get all products
// @route GET /api/products
exports.getAllProducts = async (req, res) => {
    try {
        const products = await Product.find().sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: products.length,
            data: products,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};