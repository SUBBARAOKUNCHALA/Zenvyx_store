const mongoose = require("mongoose");
const Cart = require("../models/Cart");
const Address = require("../models/Address");
const Order = require("../models/Order");
const Product = require("../models/Product");

const ALLOWED_PAYMENT_METHODS = ["COD", "RAZORPAY", "UPI"];
const USER_CANCELLABLE_STATUSES = ["Placed", "Confirmed"];
const ADMIN_UPDATABLE_STATUSES = [
  "Placed",
  "Confirmed",
  "Packed",
  "Shipped",
  "OutForDelivery",
  "Delivered",
  "Cancelled",
  "Returned",
  "Refunded",
];

const generateOrderNumber = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const random = Math.floor(100000 + Math.random() * 900000);
  return `ZENVYX-${yyyy}${mm}${dd}-${random}`;
};

const calculateDeliveryCharge = (subtotalAmount) => {
  return subtotalAmount >= 999 ? 50 : 99;
};

const getPaymentStatusFromMethod = (paymentMethod) => {
  if (paymentMethod === "COD") return "COD_Pending";
  return "Pending";
};

const buildAddressSnapshot = (address) => ({
  fullName: address.fullName,
  mobile: address.mobile,
  pincode: address.pincode,
  state: address.state,
  city: address.city,
  houseNo: address.houseNo,
  area: address.area,
  landmark: address.landmark || "",
  addressType: address.addressType || "Home",
});

const validateObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

exports.getCheckoutSummary = async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;

    const cartItems = await Cart.find({ userId }).populate("productId");
    console.log("Chekout item",cartItems)

    if (!cartItems || cartItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cart is empty",
      });
    }

    const defaultAddress = await Address.findOne({ userId, isDefault: true });

    let totalItems = 0;
    let subtotalAmount = 0;

    const items = [];

    for (const item of cartItems) {
      const product = item.productId;

      if (!product) {
        continue;
      }

      const price = Number(product.price || 0);
      const quantity = Number(item.quantity || 1);
      const discount=Number(product.discount || 0)
      const subtotal = price * quantity;

      totalItems += quantity;
      subtotalAmount += subtotal;

      items.push({
        cartItemId: item._id,
        productId: product._id,
        name: product.name || "",
        image: product.image || product.images?.[0] || "",
        price,
        quantity,
        size: item.size || "",
        subtotal,
        discount,
        stock: Number(product.stock || 0),
        category: product.category || "",
      });
    }

    if (items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid products found in cart",
      });
    }

    const deliveryCharge = calculateDeliveryCharge(subtotalAmount);
    const discountAmount = 0;
    const finalAmount = subtotalAmount + deliveryCharge - discountAmount;

    return res.status(200).json({
      success: true,
      data: {
        address: defaultAddress,
        items,
        totalItems,
        subtotalAmount,
        deliveryCharge,
        discountAmount,
        finalAmount,
      },
    });
  } catch (error) {
    console.error("getCheckoutSummary error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch checkout summary",
      error: error.message,
    });
  }
};

exports.placeOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user.userId || req.user.id;
    const { addressId, paymentMethod, mode, item } = req.body;

    if (!addressId || !paymentMethod) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Address and payment method are required",
      });
    }

    if (!validateObjectId(addressId)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Invalid address id",
      });
    }

    if (!ALLOWED_PAYMENT_METHODS.includes(paymentMethod)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Invalid payment method",
      });
    }

    const address = await Address.findOne({ _id: addressId, userId }).session(session);

    if (!address) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    let orderSourceItems = [];

    // BUY NOW FLOW
    if (mode === "buyNow") {
      if (!item?.productId || !validateObjectId(item.productId)) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: "Invalid buy now product",
        });
      }

      const product = await Product.findById(item.productId).session(session);

      if (!product) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({
          success: false,
          message: "Product not found",
        });
      }

      orderSourceItems = [
        {
          product,
          quantity: Number(item.quantity || 1),
          size: item.size || "",
        },
      ];
    } 
    // CART FLOW
    else {
      const cartItems = await Cart.find({ userId })
        .populate("productId")
        .session(session);

      if (!cartItems || cartItems.length === 0) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: "Cart is empty",
        });
      }

      orderSourceItems = cartItems.map((cartItem) => ({
        product: cartItem.productId,
        quantity: Number(cartItem.quantity || 1),
        size: cartItem.size || "",
        cartItemId: cartItem._id,
      }));
    }

    let totalItems = 0;
    let subtotalAmount = 0;
    let discountAmount = 0;
    const orderItems = [];

    for (const itemData of orderSourceItems) {
      const product = itemData.product;

      if (!product) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: "One or more products no longer exist",
        });
      }

      const quantity = Number(itemData.quantity || 1);
      const currentStock = Number(product.stock || 0);

      if (quantity <= 0) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: "Invalid quantity",
        });
      }

      if (currentStock < quantity) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: `${product.name} is out of stock or has insufficient quantity`,
        });
      }

      const price = Number(product.price || 0);
      const discountPercent = Number(product.discount || 0);

      const itemDiscountAmount = Math.round((price * discountPercent) / 100);
      const finalPrice = price - itemDiscountAmount;
      const subtotal = finalPrice * quantity;

      totalItems += quantity;
      subtotalAmount += subtotal;
      discountAmount += itemDiscountAmount * quantity;

      orderItems.push({
        productId: product._id,
        name: product.name || "",
        image: product.image || product.images?.[0] || "",
        price: finalPrice,
        originalPrice: price,
        discount: discountAmount,
        quantity,
        size: itemData.size || "",
        subtotal,
      });
    }

    const deliveryCharge = calculateDeliveryCharge(subtotalAmount);
    const finalAmount = subtotalAmount + deliveryCharge;

    let orderNumber = generateOrderNumber();
    let exists = await Order.findOne({ orderNumber }).session(session);

    while (exists) {
      orderNumber = generateOrderNumber();
      exists = await Order.findOne({ orderNumber }).session(session);
    }

    const order = await Order.create(
      [
        {
          orderNumber,
          userId,
          items: orderItems,
          address: buildAddressSnapshot(address),
          totalItems,
          subtotalAmount,
          deliveryCharge,
          discountAmount,
          finalAmount,
          paymentMethod,
          paymentStatus: getPaymentStatusFromMethod(paymentMethod),
          orderStatus: "Placed",
          orderType: mode === "buyNow" ? "Buy Now" : "Cart",
          statusHistory: [
            {
              status: "Placed",
              note: "Order placed successfully",
              changedAt: new Date(),
            },
          ],
        },
      ],
      { session }
    );

    for (const itemData of orderSourceItems) {
      await Product.updateOne(
        { _id: itemData.product._id, stock: { $gte: itemData.quantity } },
        { $inc: { stock: -itemData.quantity } },
        { session }
      );
    }

    if (mode !== "buyNow") {
      await Cart.deleteMany({ userId }).session(session);
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      success: true,
      message: "Order placed successfully",
      data: order[0],
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error("placeOrder error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to place order",
      error: error.message,
    });
  }
};

exports.getMyOrders = async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;

    const orders = await Order.find({ userId }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error) {
    console.error("getMyOrders error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
      error: error.message,
    });
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { orderId } = req.params;

    if (!validateObjectId(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order id",
      });
    }

    const order = await Order.findOne({ _id: orderId, userId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error("getOrderById error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch order details",
      error: error.message,
    });
  }
};

exports.cancelMyOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user.userId || req.user.id;
    const { orderId } = req.params;
    const { reason } = req.body;

    if (!validateObjectId(orderId)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Invalid order id",
      });
    }

    const order = await Order.findOne({ _id: orderId, userId }).session(session);

    if (!order) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (!USER_CANCELLABLE_STATUSES.includes(order.orderStatus)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `Order cannot be cancelled once it is ${order.orderStatus}`,
      });
    }

    for (const item of order.items) {
      await Product.updateOne(
        { _id: item.productId },
        { $inc: { stock: item.quantity } },
        { session }
      );
    }

    order.orderStatus = "Cancelled";
    order.cancelReason = reason || "Cancelled by user";
    order.cancelledAt = new Date();
    order.cancelledBy = "user";

    if (order.paymentMethod === "COD") {
      order.paymentStatus = "Pending";
    }

    order.statusHistory.push({
      status: "Cancelled",
      note: reason || "Cancelled by user",
      changedAt: new Date(),
    });

    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
      data: order,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error("cancelMyOrder error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to cancel order",
      error: error.message,
    });
  }
};

exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find({})
      .populate("userId", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error) {
    console.error("getAllOrders error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch all orders",
      error: error.message,
    });
  }
};

// const ADMIN_UPDATABLE_STATUSES = [
//   "Placed",
//   "Confirmed",
//   "Packed",
//   "Shipped",
//   "OutForDelivery",
//   "Delivered",
//   "Cancelled",
//   "Returned",
//   "Refunded",
// ];

// const validateObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const VALID_STATUS_FLOW = {
  Placed: ["Confirmed", "Cancelled"],
  Confirmed: ["Packed", "Cancelled"],
  Packed: ["Shipped", "Cancelled"],
  Shipped: ["OutForDelivery"],
  OutForDelivery: ["Delivered"],
  Delivered: ["Returned"],
  Returned: ["Refunded"],
  Cancelled: [],
  Refunded: [],
};


exports.updateOrderStatusByAdmin = async (req, res) => {
  try {
    const { orderId } = req.params;
    const {
      orderStatus,
      note,
      trackingId,
      shippingProvider,
      estimatedDeliveryDate,
      cancelReason,
    } = req.body;

    if (!validateObjectId(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order id",
      });
    }

    if (!orderStatus || !ADMIN_UPDATABLE_STATUSES.includes(orderStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order status",
      });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const currentStatus = order.orderStatus;

    if (currentStatus !== orderStatus) {
      const allowedNextStatuses = VALID_STATUS_FLOW[currentStatus] || [];

      if (!allowedNextStatuses.includes(orderStatus)) {
        return res.status(400).json({
          success: false,
          message: `Cannot change order status from ${currentStatus} to ${orderStatus}`,
        });
      }
    }

    order.orderStatus = orderStatus;

    if (trackingId !== undefined) {
      order.trackingId = trackingId;
    }

    if (shippingProvider !== undefined) {
      order.shippingProvider = shippingProvider;
    }

    if (estimatedDeliveryDate !== undefined) {
      order.estimatedDeliveryDate = estimatedDeliveryDate
        ? new Date(estimatedDeliveryDate)
        : null;
    }

    // Reset cancel fields if moving away from cancelled
    if (orderStatus !== "Cancelled") {
      order.cancelledAt = null;
      order.cancelledBy = "";
      order.cancelReason = "";
    }

    if (orderStatus === "Shipped" && !order.shippedAt) {
      order.shippedAt = new Date();
    }

    if (orderStatus === "Delivered") {
      order.deliveredAt = new Date();

      if (order.paymentMethod === "COD") {
        order.paymentStatus = "COD_Collected";
      }
    }

    if (orderStatus === "Cancelled") {
      order.cancelledAt = new Date();
      order.cancelledBy = "admin";
      order.cancelReason = cancelReason || note || "Cancelled by admin";
    }

    if (orderStatus === "Refunded") {
      order.paymentStatus = "Refunded";
    }

    order.statusHistory.push({
      status: orderStatus,
      note: note || `Order status changed from ${currentStatus} to ${orderStatus}`,
      changedAt: new Date(),
    });

    await order.save();

    return res.status(200).json({
      success: true,
      message: "Order status updated successfully",
      data: order,
    });
  } catch (error) {
    console.error("updateOrderStatusByAdmin error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update order status",
      error: error.message,
    });
  }
};

exports.returnMyOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user.userId || req.user.id;
    const { orderId } = req.params;
    const { reason } = req.body;

    if (!validateObjectId(orderId)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Invalid order id",
      });
    }

    const order = await Order.findOne({ _id: orderId, userId }).session(session);

    if (!order) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // ✅ Only delivered orders can be returned
    if (order.orderStatus !== "Delivered") {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Only delivered orders can be returned",
      });
    }

    // ✅ prevent duplicate return
    if (order.orderStatus === "Returned") {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Return already requested",
      });
    }

    // OPTIONAL: Return within 7 days
    if (order.deliveredAt) {
      const diffDays =
        (new Date() - new Date(order.deliveredAt)) / (1000 * 60 * 60 * 24);

      if (diffDays > 7) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: "Return window expired (7 days)",
        });
      }
    }

    // ✅ Update status
    order.orderStatus = "Returned";
    order.returnReason = reason || "Return requested by user";
    order.returnRequestedAt = new Date();
    order.returnedBy = "user";

    // Payment handling
    if (order.paymentMethod === "COD") {
      order.paymentStatus = "Refund_Pending";
    } else {
      order.paymentStatus = "Refund_Processing";
    }

    order.statusHistory.push({
      status: "Returned",
      note: reason || "Return requested by user",
      changedAt: new Date(),
    });

    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      message: "Return request submitted successfully",
      data: order,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error("returnMyOrder error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to request return",
      error: error.message,
    });
  }
};
