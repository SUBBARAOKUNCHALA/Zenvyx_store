const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Order = require("../models/Order");
const Product = require("../models/Product");
const mongoose = require("mongoose");


const generateToken = (user) => {
  return jwt.sign(
    {
      userId: user._id,
      email: user.email,
      userType: user.userType,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    if (user.userType !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin only",
      });
    }

    if (!user.password) {
      return res.status(400).json({
        success: false,
        message: "This admin account does not have password login enabled",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      message: "Admin login successful",
      token,
      admin: {
        _id: user._id,
        name: user.name,
        email: user.email,
        userType: user.userType,
      },
    });
  } catch (error) {
    console.error("adminLogin error:", error);
    return res.status(500).json({
      success: false,
      message: "Admin login failed",
      error: error.message,
    });
  }
};

exports.getDashboardData = async (req, res) => {
  try {
    // 1. Summary counts
    const totalOrders = await Order.countDocuments();
    const totalProducts = await Product.countDocuments();
    const totalUsers = await User.countDocuments();

    // 2. Revenue from delivered/paid orders
    const revenueResult = await Order.aggregate([
      {
        $match: {
          paymentStatus: "Paid"
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$finalAmount" }
        }
      }
    ]);

    const totalRevenue = revenueResult[0]?.totalRevenue || 0;

    // 3. Pending orders count
    const pendingOrders = await Order.countDocuments({ orderStatus: "Pending" });

    // 4. Low stock products count
    const lowStockProductsCount = await Product.countDocuments({ stock: { $lt: 5 } });

    // 5. Recent orders
    const recentOrders = await Order.find()
      .populate("userId", "name email")
      .sort({ createdAt: -1 })
      .limit(5);

    const formattedRecentOrders = recentOrders.map((order) => ({
      _id: order._id,
      customerName: order.userId?.name || "User",
      amount: order.finalAmount || 0,
      paymentStatus: order.paymentStatus || "Pending",
      orderStatus: order.orderStatus || "Pending",
      createdAt: order.createdAt
    }));

    // 6. Low stock products
    const lowStockProducts = await Product.find({ stock: { $lt: 5 } })
      .select("name image stock category")
      .sort({ stock: 1 })
      .limit(5);

    // 7. Latest users
    const latestUsers = await User.find()
      .select("name email createdAt")
      .sort({ createdAt: -1 })
      .limit(5);

    // 8. Order status counts
    const orderStatusData = await Order.aggregate([
      {
        $group: {
          _id: "$orderStatus",
          count: { $sum: 1 }
        }
      }
    ]);

    const orderStatusCounts = {
      pending: 0,
      confirmed: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0
    };

    orderStatusData.forEach((item) => {
      const key = item._id?.toLowerCase();
      if (key && orderStatusCounts.hasOwnProperty(key)) {
        orderStatusCounts[key] = item.count;
      }
    });

    // 9. Sales overview for last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const salesOverviewRaw = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: sevenDaysAgo },
          paymentStatus: "Paid"
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
          },
          sales: { $sum: "$finalAmount" }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const salesOverview = salesOverviewRaw.map((item) => ({
      date: item._id,
      sales: item.sales
    }));

    // 10. Top selling products
    const topSellingProducts = await Order.aggregate([
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.productId",
          totalSold: { $sum: "$items.quantity" },
          revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } }
        }
      },
      { $sort: { totalSold: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product"
        }
      },
      { $unwind: "$product" },
      {
        $project: {
          _id: 1,
          name: "$product.name",
          totalSold: 1,
          revenue: 1
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalOrders,
          totalProducts,
          totalUsers,
          totalRevenue,
          pendingOrders,
          lowStockProducts: lowStockProductsCount
        },
        salesOverview,
        orderStatusCounts,
        recentOrders: formattedRecentOrders,
        lowStockProducts,
        topSellingProducts,
        latestUsers
      }
    });
  } catch (error) {
    console.error("getDashboardData error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard data"
    });
  }
};