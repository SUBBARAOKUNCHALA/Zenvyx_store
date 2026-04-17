const Cart = require("../models/Cart");
const Address = require("../models/Address");
const Order = require("../models/Order");

exports.getCheckoutSummary = async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;

    // since Cart schema stores one document per product
    const cartItems = await Cart.find({ userId }).populate("productId");

    if (!cartItems || cartItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cart is empty",
      });
    }

    const defaultAddress = await Address.findOne({ userId, isDefault: true });

    let totalItems = 0;
    let subtotalAmount = 0;

    const items = cartItems.map((item) => {
      const product = item.productId;

      const price = Number(product?.price || 0);
      const quantity = Number(item.quantity || 1);
      const subtotal = price * quantity;

      totalItems += quantity;
      subtotalAmount += subtotal;

      return {
        cartItemId: item._id,
        productId: product?._id,
        name: product?.name || "",
        image: product?.image || product?.images?.[0] || "",
        price,
        quantity,
        size: item?.size || "",
        subtotal,
        stock: product?.stock || 0,
        category: product?.category || "",
      };
    });

    const deliveryCharge = subtotalAmount >= 999 ? 0 : 50;
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
  try {
    const userId = req.user.userId || req.user.id;
    const { addressId, paymentMethod } = req.body;

    if (!addressId || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "Address and payment method are required",
      });
    }

    const cartItems = await Cart.find({ userId }).populate("productId");

    if (!cartItems || cartItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cart is empty",
      });
    }

    const address = await Address.findOne({ _id: addressId, userId });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    let totalItems = 0;
    let subtotalAmount = 0;

    const orderItems = cartItems.map((item) => {
      const product = item.productId;

      const price = Number(product?.price || 0);
      const quantity = Number(item.quantity || 1);
      const subtotal = price * quantity;

      totalItems += quantity;
      subtotalAmount += subtotal;

      return {
        productId: product?._id,
        name: product?.name || "",
        image: product?.image || product?.images?.[0] || "",
        price,
        quantity,
        size: item?.size || "",
        subtotal,
      };
    });

    const deliveryCharge = subtotalAmount >= 999 ? 0 : 50;
    const discountAmount = 0;
    const finalAmount = subtotalAmount + deliveryCharge - discountAmount;

    const order = await Order.create({
      userId,
      items: orderItems,
      address: {
        fullName: address.fullName,
        mobile: address.mobile,
        pincode: address.pincode,
        state: address.state,
        city: address.city,
        houseNo: address.houseNo,
        area: address.area,
        landmark: address.landmark,
        addressType: address.addressType,
      },
      totalItems,
      subtotalAmount,
      deliveryCharge,
      discountAmount,
      finalAmount,
      paymentMethod,
      paymentStatus: paymentMethod === "COD" ? "Pending" : "Pending",
      orderStatus: "Placed",
    });

    // clear user cart after successful order
    await Cart.deleteMany({ userId });

    return res.status(201).json({
      success: true,
      message: "Order placed successfully",
      data: order,
    });
  } catch (error) {
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
    });
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { orderId } = req.params;

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
    });
  }
};