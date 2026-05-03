const Product = require("../models/Product");
const cloudinary = require("../config/cloudinary");
const streamifier = require("streamifier");
const { uploadMultipleImages } = require("../utils/cloudinaryUpload");

const normalizeSizes = (sizes = [], fallbackStock = 0) => {
  return sizes.map((item) => {
    if (typeof item === "string") {
      return {
        size: item,
        stock: Number(fallbackStock || 0),
      };
    }

    return {
      size: item.size,
      stock: Number(item.stock || 0),
    };
  });
};

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
    const {
      name,
      description,
      ProductDetails,
      price,
      category,
      subCategory,
      stock,
      discount,
      sizes,
      tags,
    } = req.body;

    if (!name || !description || !price || !category || !ProductDetails) {
      return res.status(400).json({
        success: false,
        message: "Name, description,ProductDetails, price, and category are required",
      });
    }

    let parsedSizes = [];
    parsedSizes = normalizeSizes(parsedSizes, stock);
    if (sizes) {
      try {
        parsedSizes = JSON.parse(sizes);
        if (!Array.isArray(parsedSizes)) {
          return res.status(400).json({
            success: false,
            message: "Sizes must be an array",
          });
        }
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: 'Sizes must be valid JSON array. Example: ["S","M","L"]',
        });
      }
    }

    let parsedTags = [];
    if (tags) {
      try {
        parsedTags = JSON.parse(tags);
        if (!Array.isArray(parsedTags)) {
          return res.status(400).json({
            success: false,
            message: "Tags must be an array",
          });
        }
      } catch (error) {
        parsedTags = String(tags)
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
      }
    }

    const files = req.files || [];

    if (!files.length) {
      return res.status(400).json({
        success: false,
        message: "At least one product image is required",
      });
    }

    if (files.length > 4) {
      return res.status(400).json({
        success: false,
        message: "Maximum 4 images allowed",
      });
    }

    const uploadedImages = await uploadMultipleImages(files, "products");

    const createdBy =
      req.user?.userId ||
      req.user?.id ||
      req.user?._id ||
      req.admin?.userId ||
      req.admin?.id ||
      req.admin?._id;

    if (!createdBy) {
      return res.status(401).json({
        success: false,
        message: "Admin token missing or invalid",
      });
    }

    const product = await Product.create({
      name: name.trim(),
      description: description.trim(),
      ProductDetails: ProductDetails.trim(),
      price: Number(price),
      category,
      subCategory,
      stock: Number(stock || 0),
      discount: Number(discount || 0),
      sizes: parsedSizes,
      tags: parsedTags,
      image: uploadedImages[0] || "",
      images: uploadedImages,
      createdBy: createdBy,
    });

    return res.status(201).json({
      success: true,
      message: "Product added successfully",
      data: product,
    });
  } catch (error) {
    console.error("addProduct error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to add product",
      error: error.message,
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
      //data: products,
      data: products.map((product) => ({
        ...product.toObject(),
        sizes: normalizeSizes(product.sizes, product.stock),
      })),
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
    const { name, description, ProductDetails, price, category, stock, discount, sizes } = req.body;

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
    product.ProductDetails = ProductDetails || product.ProductDetails;
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
      //data: product,
      data: {
        ...product.toObject(),
        sizes: normalizeSizes(product.sizes, product.stock),
      },
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