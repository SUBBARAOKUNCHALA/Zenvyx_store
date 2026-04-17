const mongoose = require("mongoose");

const cartSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    size: {
      type: String,
      default: "",
    },
    quantity: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },
  },
  { timestamps: true }
);

// if you want same product with different sizes, use this:
cartSchema.index({ userId: 1, productId: 1, size: 1 }, { unique: true });

module.exports = mongoose.model("Cart", cartSchema);