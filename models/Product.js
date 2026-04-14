const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
    },
    category: {
      type: String,
      enum: ["Shirt", "T-Shirt", "Pant"],
      required: true,
    },
    stock: {
      type: Number,
      default: 0,
    },
    sizes: {
      type: [String],
      default: [],
    },

    /* old single image */
    image: {
      type: String,
      default: "",
    },

    /* new multiple images */
    images: {
      type: [String],
      validate: {
        validator: function (val) {
          return val.length <= 4;
        },
        message: "Maximum 4 images allowed",
      },
      default: [],
    },

    discount: {
      type: Number,
      default: 0,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);