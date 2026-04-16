const mongoose = require("mongoose");
const Cart = require("../models/Cart");
const Product = require("../models/Product");

// Add item to cart
exports.addToCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId, quantity } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const qty = quantity && quantity > 0 ? Number(quantity) : 1;

    const productExists = await Product.findById(productId);
    if (!productExists) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const existingCartItem = await Cart.findOne({ userId, productId });

    if (existingCartItem) {
      existingCartItem.quantity += qty;
      await existingCartItem.save();

      const updatedItem = await Cart.findById(existingCartItem._id).populate("productId");

      return res.status(200).json({
        success: true,
        message: "Cart item quantity updated",
        data: updatedItem,
      });
    }

    const cartItem = await Cart.create({
      userId,
      productId,
      quantity: qty,
    });

    const populatedCartItem = await Cart.findById(cartItem._id).populate("productId");

    return res.status(201).json({
      success: true,
      message: "Item added to cart successfully",
      data: populatedCartItem,
    });
  } catch (error) {
    console.error("addToCart error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to add item to cart",
      error: error.message,
    });
  }
};

// Get logged-in user's cart
exports.getMyCart = async (req, res) => {
  try {
    const userId = req.user.id;

    const cartItems = await Cart.find({ userId })
      .populate("productId")
      .sort({ createdAt: -1 });

    const grandTotal = cartItems.reduce((total, item) => {
      const price = item.productId?.price || 0;
      return total + price * item.quantity;
    }, 0);

    return res.status(200).json({
      success: true,
      count: cartItems.length,
      grandTotal,
      data: cartItems,
    });
  } catch (error) {
    console.error("getMyCart error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch cart items",
      error: error.message,
    });
  }
};

// Update quantity
exports.updateCartQuantity = async (req, res) => {
  try {
    const userId = req.user.id;
    const { cartItemId } = req.params;
    const { quantity } = req.body;

    if (!mongoose.Types.ObjectId.isValid(cartItemId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid cart item ID",
      });
    }

    if (!quantity || quantity < 1) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be at least 1",
      });
    }

    const cartItem = await Cart.findOne({ _id: cartItemId, userId });

    if (!cartItem) {
      return res.status(404).json({
        success: false,
        message: "Cart item not found",
      });
    }

    cartItem.quantity = Number(quantity);
    await cartItem.save();

    const updatedItem = await Cart.findById(cartItem._id).populate("productId");

    return res.status(200).json({
      success: true,
      message: "Cart quantity updated successfully",
      data: updatedItem,
    });
  } catch (error) {
    console.error("updateCartQuantity error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update cart quantity",
      error: error.message,
    });
  }
};

// Remove single item from cart
exports.removeCartItem = async (req, res) => {
  try {
    const userId = req.user.id;
    const { cartItemId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(cartItemId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid cart item ID",
      });
    }

    const cartItem = await Cart.findOneAndDelete({ _id: cartItemId, userId });

    if (!cartItem) {
      return res.status(404).json({
        success: false,
        message: "Cart item not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Cart item removed successfully",
    });
  } catch (error) {
    console.error("removeCartItem error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to remove cart item",
      error: error.message,
    });
  }
};

// Clear full cart
exports.clearMyCart = async (req, res) => {
  try {
    const userId = req.user.id;

    await Cart.deleteMany({ userId });

    return res.status(200).json({
      success: true,
      message: "Cart cleared successfully",
    });
  } catch (error) {
    console.error("clearMyCart error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to clear cart",
      error: error.message,
    });
  }
};