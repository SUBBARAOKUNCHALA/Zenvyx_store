const Product = require("../models/Product");
const cloudinary = require("../config/cloudinary");
const streamifier = require("streamifier");
const { uploadMultipleImages } = require("../utils/cloudinaryUpload");

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
    const { name, description, price, category, stock, discount, sizes } = req.body;

    const files = req.files; // from multer

    const images = await uploadMultipleImages(files);

    const parsedSizes = sizes ? JSON.parse(sizes) : [];

    const product = await Product.create({
      name,
      description,
      price,
      category,
      stock,
      discount,
      sizes: parsedSizes,
      image: images[0], // fallback
      images,
      createdBy: req.userId,
    });

    res.status(201).json({
      success: true,
      data: product,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: err.message,
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
exports.updateProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const { name, description, price, category, stock, discount, sizes } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    let images = product.images;

    if (req.files && req.files.length > 0) {
      images = await uploadMultipleImages(req.files);
    }

    const parsedSizes = sizes ? JSON.parse(sizes) : product.sizes;

    product.name = name || product.name;
    product.description = description || product.description;
    product.price = price || product.price;
    product.category = category || product.category;
    product.stock = stock || product.stock;
    product.discount = discount || product.discount;
    product.sizes = parsedSizes;
    product.images = images;
    product.image = images[0];

    await product.save();

    res.json({
      success: true,
      data: product,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.getProductById = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      data: product,
    });

  } catch (error) {
    console.error("getProductById error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch product",
    });
  }
};

exports.getSimilarProducts = async (req, res) => {
  try {
    const { productId } = req.params;

    // Step 1: find current product
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Step 2: find similar products
    const similarProducts = await Product.find({
      _id: { $ne: product._id }, // exclude current product
      category: product.category, // same category
    })
      .sort({ createdAt: -1 }) // latest first
      .limit(8); // limit results

    res.status(200).json({
      success: true,
      count: similarProducts.length,
      data: similarProducts,
    });

  } catch (error) {
    console.error("getSimilarProducts error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch similar products",
    });
  }
};