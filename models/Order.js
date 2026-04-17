const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    name: String,
    image: String,
    price: Number,
    quantity: Number,
    size: String,
    subtotal: Number,
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    items: [orderItemSchema],

    address: {
      fullName: String,
      mobile: String,
      pincode: String,
      state: String,
      city: String,
      houseNo: String,
      area: String,
      landmark: String,
      addressType: String,
    },

    totalItems: {
      type: Number,
      default: 0,
    },

    subtotalAmount: {
      type: Number,
      default: 0,
    },

    deliveryCharge: {
      type: Number,
      default: 0,
    },

    discountAmount: {
      type: Number,
      default: 0,
    },

    finalAmount: {
      type: Number,
      required: true,
    },

    paymentMethod: {
      type: String,
      enum: ["COD", "RAZORPAY", "UPI"],
      required: true,
    },

    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Failed"],
      default: "Pending",
    },

    orderStatus: {
      type: String,
      enum: ["Placed", "Confirmed", "Shipped", "Delivered", "Cancelled"],
      default: "Placed",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);