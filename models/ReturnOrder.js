const mongoose = require("mongoose");

const returnItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    name: String,
    image: String,
    price: Number,
    originalPrice: Number,
    discount: Number,
    quantity: Number,
    size: String,
    subtotal: Number,
  },
  { _id: false }
);

const returnStatusHistorySchema = new mongoose.Schema(
  {
    status: String,
    note: String,
    changedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const returnOrderSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      unique: true,
      index: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    orderNumber: {
      type: String,
      required: true,
      index: true,
    },

    items: {
      type: [returnItemSchema],
      required: true,
    },

    customerAddress: {
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

    returnReason: {
      type: String,
      required: true,
      trim: true,
    },

    returnStatus: {
      type: String,
      enum: [
        "ReturnRequested",
        "ReturnAccepted",
        "PickedUp",
        "Refunded",
        "Rejected",
      ],
      default: "ReturnRequested",
    },

    refundAmount: {
      type: Number,
      default: 0,
    },

    pickupDate: {
      type: Date,
      default: null,
    },

    pickupPartner: {
      type: String,
      default: "",
    },

    pickupTrackingId: {
      type: String,
      default: "",
    },

    pickedUpAt: {
      type: Date,
      default: null,
    },

    refundMode: {
      type: String,
      default: "",
    },

    refundTransactionId: {
      type: String,
      default: "",
    },

    refundedAt: {
      type: Date,
      default: null,
    },

    adminNote: {
      type: String,
      default: "",
    },

    statusHistory: {
      type: [returnStatusHistorySchema],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ReturnOrder", returnOrderSchema);