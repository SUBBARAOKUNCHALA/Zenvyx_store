const mongoose = require("mongoose");
const Cart = require("../models/Cart");
const Address = require("../models/Address");
const Order = require("../models/Order");
const Product = require("../models/Product");
const razorpay = require("../config/razorpay");
const ReturnOrder = require("../models/ReturnOrder")
const ALLOWED_PAYMENT_METHODS = ["COD", "RAZORPAY", "UPI", "NET_BANKING"];
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
    console.log("Chekout item", cartItems)

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
      const discount = Number(product.discount || 0)
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
    const { addressId, paymentMethod, mode, item, razorpayOrderId, razorpayPaymentId, razorpaySignature, paymentStatus, } = req.body;
    console.log("UPI PAyment Order ReqBody", req.body)

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
    } else {
      // CART FLOW
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
      const selectedSize = itemData.size || "";
      const currentStock = Number(product.stock || 0);

      if (quantity <= 0) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: "Invalid quantity",
        });
      }

      // ✅ Normalize old + new size format
      const normalizedSizes = (product.sizes || []).map((s) => {
        if (typeof s === "string") {
          return {
            size: s,
            stock: Number(product.stock || 0),
          };
        }

        return {
          size: s.size,
          stock: Number(s.stock || 0),
        };
      });

      // ✅ Size-wise stock check
      if (selectedSize) {
        const selectedSizeObj = normalizedSizes.find(
          (s) => String(s.size) === String(selectedSize)
        );

        if (!selectedSizeObj) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({
            success: false,
            message: `${product.name} size ${selectedSize} is not available`,
          });
        }

        if (selectedSizeObj.stock < quantity) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({
            success: false,
            message: `${product.name} size ${selectedSize} is out of stock`,
          });
        }
      }

      // ✅ Global stock fallback check
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
        discount: itemDiscountAmount * quantity,
        quantity,
        size: selectedSize,
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
          //paymentStatus: getPaymentStatusFromMethod(paymentMethod),
          paymentStatus:
            paymentStatus ||
            (["UPI", "NET_BANKING"].includes(paymentMethod)
              ? "Paid"
              : getPaymentStatusFromMethod(paymentMethod)),
          orderStatus: "Placed",
          orderType: mode === "buyNow" ? "Buy Now" : "Cart",
          razorpayOrderId:
            ["UPI", "NET_BANKING"].includes(paymentMethod)
              ? razorpayOrderId
              : undefined,

          razorpayPaymentId:
            ["UPI", "NET_BANKING"].includes(paymentMethod)
              ? razorpayPaymentId
              : undefined,

          razorpaySignature:
            ["UPI", "NET_BANKING"].includes(paymentMethod)
              ? razorpaySignature
              : undefined,
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

    // ✅ Reduce stock after successful order creation
    for (const itemData of orderSourceItems) {
      const quantity = Number(itemData.quantity || 1);

      if (itemData.size) {
        await Product.updateOne(
          {
            _id: itemData.product._id,
            "sizes.size": itemData.size,
            "sizes.stock": { $gte: quantity },
            stock: { $gte: quantity },
          },
          {
            $inc: {
              "sizes.$.stock": -quantity,
              stock: -quantity,
            },
          },
          { session }
        );
      } else {
        await Product.updateOne(
          {
            _id: itemData.product._id,
            stock: { $gte: quantity },
          },
          {
            $inc: {
              stock: -quantity,
            },
          },
          { session }
        );
      }
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

// exports.placeOrder = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     const userId = req.user.userId || req.user.id;
//     const { addressId, paymentMethod, mode, item } = req.body;

//     if (!addressId || !paymentMethod) {
//       await session.abortTransaction();
//       session.endSession();
//       return res.status(400).json({
//         success: false,
//         message: "Address and payment method are required",
//       });
//     }

//     if (!validateObjectId(addressId)) {
//       await session.abortTransaction();
//       session.endSession();
//       return res.status(400).json({
//         success: false,
//         message: "Invalid address id",
//       });
//     }

//     if (!ALLOWED_PAYMENT_METHODS.includes(paymentMethod)) {
//       await session.abortTransaction();
//       session.endSession();
//       return res.status(400).json({
//         success: false,
//         message: "Invalid payment method",
//       });
//     }

//     const address = await Address.findOne({ _id: addressId, userId }).session(session);

//     if (!address) {
//       await session.abortTransaction();
//       session.endSession();
//       return res.status(404).json({
//         success: false,
//         message: "Address not found",
//       });
//     }

//     let orderSourceItems = [];

//     // BUY NOW FLOW
//     if (mode === "buyNow") {
//       if (!item?.productId || !validateObjectId(item.productId)) {
//         await session.abortTransaction();
//         session.endSession();
//         return res.status(400).json({
//           success: false,
//           message: "Invalid buy now product",
//         });
//       }

//       const product = await Product.findById(item.productId).session(session);

//       if (!product) {
//         await session.abortTransaction();
//         session.endSession();
//         return res.status(404).json({
//           success: false,
//           message: "Product not found",
//         });
//       }

//       orderSourceItems = [
//         {
//           product,
//           quantity: Number(item.quantity || 1),
//           size: item.size || "",
//         },
//       ];
//     }
//     // CART FLOW
//     else {
//       const cartItems = await Cart.find({ userId })
//         .populate("productId")
//         .session(session);

//       if (!cartItems || cartItems.length === 0) {
//         await session.abortTransaction();
//         session.endSession();
//         return res.status(400).json({
//           success: false,
//           message: "Cart is empty",
//         });
//       }

//       orderSourceItems = cartItems.map((cartItem) => ({
//         product: cartItem.productId,
//         quantity: Number(cartItem.quantity || 1),
//         size: cartItem.size || "",
//         cartItemId: cartItem._id,
//       }));
//     }

//     let totalItems = 0;
//     let subtotalAmount = 0;
//     let discountAmount = 0;
//     const orderItems = [];

//     for (const itemData of orderSourceItems) {
//       const product = itemData.product;

//       if (!product) {
//         await session.abortTransaction();
//         session.endSession();
//         return res.status(400).json({
//           success: false,
//           message: "One or more products no longer exist",
//         });
//       }

//       const quantity = Number(itemData.quantity || 1);
//       const currentStock = Number(product.stock || 0);

//       if (quantity <= 0) {
//         await session.abortTransaction();
//         session.endSession();
//         return res.status(400).json({
//           success: false,
//           message: "Invalid quantity",
//         });
//       }

//       if (currentStock < quantity) {
//         await session.abortTransaction();
//         session.endSession();
//         return res.status(400).json({
//           success: false,
//           message: `${product.name} is out of stock or has insufficient quantity`,
//         });
//       }

//       const price = Number(product.price || 0);
//       const discountPercent = Number(product.discount || 0);

//       const itemDiscountAmount = Math.round((price * discountPercent) / 100);
//       const finalPrice = price - itemDiscountAmount;
//       const subtotal = finalPrice * quantity;

//       totalItems += quantity;
//       subtotalAmount += subtotal;
//       discountAmount += itemDiscountAmount * quantity;

//       orderItems.push({
//         productId: product._id,
//         name: product.name || "",
//         image: product.image || product.images?.[0] || "",
//         price: finalPrice,
//         originalPrice: price,
//         discount: discountAmount,
//         quantity,
//         size: itemData.size || "",
//         subtotal,
//       });
//     }

//     const deliveryCharge = calculateDeliveryCharge(subtotalAmount);
//     const finalAmount = subtotalAmount + deliveryCharge;

//     let orderNumber = generateOrderNumber();
//     let exists = await Order.findOne({ orderNumber }).session(session);

//     while (exists) {
//       orderNumber = generateOrderNumber();
//       exists = await Order.findOne({ orderNumber }).session(session);
//     }

//     const order = await Order.create(
//       [
//         {
//           orderNumber,
//           userId,
//           items: orderItems,
//           address: buildAddressSnapshot(address),
//           totalItems,
//           subtotalAmount,
//           deliveryCharge,
//           discountAmount,
//           finalAmount,
//           paymentMethod,
//           paymentStatus: getPaymentStatusFromMethod(paymentMethod),
//           orderStatus: "Placed",
//           orderType: mode === "buyNow" ? "Buy Now" : "Cart",
//           statusHistory: [
//             {
//               status: "Placed",
//               note: "Order placed successfully",
//               changedAt: new Date(),
//             },
//           ],
//         },
//       ],
//       { session }
//     );

//     for (const itemData of orderSourceItems) {
//       await Product.updateOne(
//         { _id: itemData.product._id, stock: { $gte: itemData.quantity } },
//         { $inc: { stock: -itemData.quantity } },
//         { session }
//       );
//     }

//     if (mode !== "buyNow") {
//       await Cart.deleteMany({ userId }).session(session);
//     }

//     await session.commitTransaction();
//     session.endSession();

//     return res.status(201).json({
//       success: true,
//       message: "Order placed successfully",
//       data: order[0],
//     });
//   } catch (error) {
//     await session.abortTransaction();
//     session.endSession();

//     console.error("placeOrder error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Failed to place order",
//       error: error.message,
//     });
//   }
// };

exports.getMyOrders = async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;

    const orders = await Order.find({ userId }).sort({ createdAt: -1 });

    const ordersWithReturnData = await Promise.all(
      orders.map(async (order) => {
        const returnData = await ReturnOrder.findOne({
          orderId: order._id,
          userId,
        });

        return {
          ...order.toObject(),
          returnData: returnData || null,
        };
      })
    );

    return res.status(200).json({
      success: true,
      count: ordersWithReturnData.length,
      data: ordersWithReturnData,
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

    const isOnlinePaidOrder =
      ["UPI", "NET_BANKING", "RAZORPAY"].includes(order.paymentMethod) &&
      order.paymentStatus === "Paid" &&
      order.razorpayPaymentId;

    let refund = null;

    if (isOnlinePaidOrder) {
      const refundAmountInPaise = Math.round(Number(order.finalAmount || 0) * 100);

      refund = await razorpay.payments.refund(order.razorpayPaymentId, {
        amount: refundAmountInPaise,
        speed: "optimum",
        notes: {
          orderId: order._id.toString(),
          orderNumber: order.orderNumber,
          reason: reason || "Cancelled by user",
        },
      });

      if (order.refundId) {
        return res.status(400).json({
          success: false,
          message: "Refund already initiated",
        });
      }

      order.paymentStatus =
        refund.status === "processed" ? "Refunded" : "Refund_Pending";

      order.refundId = refund.id;
      order.refundStatus = refund.status || "created";
      order.refundAmount = refund.amount ? refund.amount / 100 : order.finalAmount;

      if (refund.status === "processed") {
        order.refundedAt = new Date();
      }
    }

    if (order.paymentMethod === "COD") {
      order.paymentStatus = "COD_Pending";
    }

    for (const item of order.items) {
      if (item.size) {
        await Product.updateOne(
          {
            _id: item.productId,
            "sizes.size": item.size,
          },
          {
            $inc: {
              "sizes.$.stock": item.quantity,
              stock: item.quantity,
            },
          },
          { session }
        );
      } else {
        await Product.updateOne(
          { _id: item.productId },
          { $inc: { stock: item.quantity } },
          { session }
        );
      }
    }

    order.orderStatus = "Cancelled";
    order.cancelReason = reason || "Cancelled by user";
    order.cancelledAt = new Date();
    order.cancelledBy = "user";

    order.statusHistory.push({
      status: "Cancelled",
      note: isOnlinePaidOrder
        ? "Order cancelled by user. Refund initiated."
        : reason || "Cancelled by user",
      changedAt: new Date(),
    });

    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      message: isOnlinePaidOrder
        ? "Order cancelled successfully. Refund initiated."
        : "Order cancelled successfully",
      data: {
        order,
        refund,
      },
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
  try {
    const userId = req.user.userId || req.user.id;
    const { orderId } = req.params;
    const { reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order id",
      });
    }

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: "Return reason is required",
      });
    }

    const order = await Order.findOne({ _id: orderId, userId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.orderStatus !== "Delivered") {
      return res.status(400).json({
        success: false,
        message: "Only delivered orders can be returned",
      });
    }

    const alreadyReturn = await ReturnOrder.findOne({ orderId });

    if (alreadyReturn) {
      return res.status(400).json({
        success: false,
        message: "Return request already submitted",
      });
    }

    const returnOrder = await ReturnOrder.create({
      orderId: order._id,
      userId,
      orderNumber: order.orderNumber,
      items: order.items,
      customerAddress: order.address,
      returnReason: reason,
      refundAmount: order.finalAmount,
      returnStatus: "ReturnRequested",
      statusHistory: [
        {
          status: "ReturnRequested",
          note: reason,
          changedAt: new Date(),
        },
      ],
    });

    order.orderStatus = "ReturnRequested";
    order.paymentStatus = "Refund_Pending";

    order.statusHistory.push({
      status: "ReturnRequested",
      note: reason,
      changedAt: new Date(),
    });

    await order.save();

    return res.status(200).json({
      success: true,
      message: "Return request submitted successfully",
      data: returnOrder,
    });
  } catch (error) {
    console.error("returnMyOrder error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to request return",
      error: error.message,
    });
  }
};

exports.getReturnedOrders = async (req, res) => {
  try {
    const returnedOrders = await ReturnOrder.find()
      .populate("userId", "name email")
      .populate("orderId")
      .sort({ createdAt: -1 });
    //console.log("Subbu")

    return res.status(200).json({
      success: true,
      count: returnedOrders.length,
      data: returnedOrders,
    });
  } catch (error) {
    console.error("getReturnedOrders error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch returned orders",
      error: error.message,
    });
  }
};

exports.updateReturnStatusByAdmin = async (req, res) => {
  try {
    const { returnId } = req.params;

    const {
      returnStatus,
      pickupDate,
      pickupPartner,
      pickupTrackingId,
      refundMode,
      refundTransactionId,
      adminNote,
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(returnId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid return id",
      });
    }

    const allowedStatuses = [
      "ReturnAccepted",
      "PickedUp",
      "Refunded",
      "Rejected",
    ];

    if (!allowedStatuses.includes(returnStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid return status",
      });
    }

    const returnOrder = await ReturnOrder.findById(returnId);

    if (!returnOrder) {
      return res.status(404).json({
        success: false,
        message: "Return order not found",
      });
    }

    const order = await Order.findById(returnOrder.orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Original order not found",
      });
    }

    const currentStatus = returnOrder.returnStatus;

    const validFlow = {
      ReturnRequested: ["ReturnAccepted", "Rejected"],
      ReturnAccepted: ["PickedUp"],
      PickedUp: ["Refunded"],
      Refunded: [],
      Rejected: [],
    };

    if (!validFlow[currentStatus].includes(returnStatus)) {
      return res.status(400).json({
        success: false,
        message: `Cannot change return status from ${currentStatus} to ${returnStatus}`,
      });
    }

    returnOrder.returnStatus = returnStatus;

    if (pickupDate !== undefined) {
      returnOrder.pickupDate = pickupDate ? new Date(pickupDate) : null;
    }

    if (pickupPartner !== undefined) {
      returnOrder.pickupPartner = pickupPartner;
    }

    if (pickupTrackingId !== undefined) {
      returnOrder.pickupTrackingId = pickupTrackingId;
    }

    if (adminNote !== undefined) {
      returnOrder.adminNote = adminNote;
    }

    if (returnStatus === "ReturnAccepted") {
      order.paymentStatus = "Refund_Pending";
    }

    if (returnStatus === "PickedUp") {
      returnOrder.pickedUpAt = new Date();

      for (const item of returnOrder.items) {
        await Product.updateOne(
          { _id: item.productId },
          { $inc: { stock: item.quantity } }
        );
      }
    }

    if (returnStatus === "Refunded") {
      returnOrder.refundedAt = new Date();
      returnOrder.refundMode = refundMode || "Manual";
      returnOrder.refundTransactionId = refundTransactionId || "";

      order.paymentStatus = "Refunded";
    }

    if (returnStatus === "Rejected") {
      order.orderStatus = "Delivered";
      order.paymentStatus =
        order.paymentMethod === "COD" ? "COD_Collected" : "Paid";
    }

    if (returnStatus !== "Rejected") {
      order.orderStatus = "ReturnRequested";
    }

    // returnOrder.statusHistory.push({
    //   status: returnStatus,
    //   note: adminNote || `Return status changed from ${currentStatus} to ${returnStatus}`,
    //   changedAt: new Date(),
    // });

    // order.statusHistory.push({
    //   status: returnStatus,
    //   note: adminNote || `Return status changed from ${currentStatus} to ${returnStatus}`,
    //   changedAt: new Date(),
    // });

    returnOrder.statusHistory.push({
      status: returnStatus,
      note:
        adminNote ||
        `Return status changed from ${currentStatus} to ${returnStatus}`,
      changedAt: historyDate,
    });

    order.statusHistory.push({
      status: returnStatus,
      note:
        adminNote ||
        `Return status changed from ${currentStatus} to ${returnStatus}`,
      changedAt: historyDate,
    });

    await returnOrder.save();
    await order.save();

    return res.status(200).json({
      success: true,
      message: "Return status updated successfully",
      data: returnOrder,
    });
  } catch (error) {
    console.error("updateReturnStatusByAdmin error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update return status",
      error: error.message,
    });
  }
};
