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
    ProductDetails: {
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
     isDeleted: {
      type: Boolean,
      default: false,
    },

    subCategory: {
      type: String,
      enum: [
        "Formal Shirts",
        "Casual Shirts",
        "Printed Shirts",
        "Party Wear",
        "Trending Shirts",
        "Round Neck",
        "Polo T-Shirts",
        "Cotton T-Shirts",
        "Jeans",
        "Cargo Pants",
        "Formal Pants",
      ],
      default: "",
    },

    stock: {
      type: Number,
      default: 0,
    },
    sizes: [
      {
        size: {
          type: String,
          required: true,
        },

        stock: {
          type: Number,
          default: 0,
        },

        measurements: {
          chest: String,
          shoulder: String,
          waist: String,
          length: String,
        },
      },
    ],


    // sizes: [
    //   {
    //     size: {
    //       type: String,
    //       required: true,
    //     },
    //     stock: {
    //       type: Number,
    //       default: 0,
    //     },
    //   },
    // ],

    image: {
      type: String,
      default: "",
    },

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

    tags: {
      type: [String],
      default: [],
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);