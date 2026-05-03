const { Parser } = require("json2csv");
const Order = require("../models/Order");

const buildReportFilter = (query) => {
  const { from, to, method, status } = query;

  const filter = {};

  if (from || to) {
    filter.createdAt = {};

    if (from) {
      filter.createdAt.$gte = new Date(`${from}T00:00:00.000Z`);
    }

    if (to) {
      filter.createdAt.$lte = new Date(`${to}T23:59:59.999Z`);
    }
  }

  if (method && method !== "ALL") {
    filter.paymentMethod = method;
  }

  if (status && status !== "ALL") {
    filter.paymentStatus = status;
  }

  return filter;
};

exports.getPaymentReports = async (req, res) => {
  try {
    const filter = buildReportFilter(req.query);

    const orders = await Order.find(filter)
      .populate("userId", "name email mobile")
      .sort({ createdAt: -1 });
    //console.log("Reports",orders)
    const rows = orders.map((order) => {
      const finalAmount = Number(order.finalAmount || order.totalAmount || 0);
      const tdsAmount = Math.round(finalAmount * 0.01);
      const netAmount = finalAmount - tdsAmount;

      return {
        orderId: order._id,
        customerName: order.userId?.name || "N/A",
        customerEmail: order.userId?.email || "N/A",
        customerMobile: order.address?.mobile || "N/A",
        date: order.createdAt,
        paymentMethod: order.paymentMethod || "COD",
        paymentStatus: order.paymentStatus || "Pending",
        orderStatus: order.orderStatus || "Pending",
        razorpayOrderId: order.razorpayOrderId || "",
        razorpayPaymentId: order.razorpayPaymentId || "",
        subtotal: order.subtotal || 0,
        discountAmount: order.discountAmount || 0,
        deliveryCharges: order.deliveryCharges || 0,
        finalAmount,
        tdsAmount,
        netAmount,
      };
    });

    const totals = rows.reduce(
      (acc, row) => {
        acc.totalOrders += 1;
        acc.totalAmount += row.finalAmount;
        acc.totalTds += row.tdsAmount;
        acc.totalNet += row.netAmount;
        return acc;
      },
      {
        totalOrders: 0,
        totalAmount: 0,
        totalTds: 0,
        totalNet: 0,
      }
    );

    return res.status(200).json({
      success: true,
      count: rows.length,
      totals,
      data: rows,
    });
  } catch (error) {
    console.error("Get payment reports error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch payment reports",
    });
  }
};

exports.exportPaymentsCSV = async (req, res) => {
  try {
    const filter = buildReportFilter(req.query);

    const orders = await Order.find(filter)
      .populate("userId", "name email mobile")
      .sort({ createdAt: -1 });

    const rows = orders.map((order) => {
      const finalAmount = Number(order.finalAmount || order.totalAmount || 0);
      const tdsAmount = Math.round(finalAmount * 0.01);
      const netAmount = finalAmount - tdsAmount;

      return {
        "Order ID": order._id.toString(),
        "Customer Name": order.userId?.name || "N/A",
        "Customer Email": order.userId?.email || "N/A",
        "Customer Mobile": order.userId?.mobile || "N/A",
        Date: order.createdAt?.toISOString(),
        "Payment Method": order.paymentMethod || "COD",
        "Payment Status": order.paymentStatus || "Pending",
        "Order Status": order.orderStatus || "Pending",
        "Razorpay Order ID": order.razorpayOrderId || "",
        "Razorpay Payment ID": order.razorpayPaymentId || "",
        Subtotal: order.subtotal || 0,
        Discount: order.discountAmount || 0,
        Delivery: order.deliveryCharges || 0,
        "Final Amount": finalAmount,
        "TDS Amount": tdsAmount,
        "Net Amount": netAmount,
      };
    });

    const parser = new Parser();
    const csv = parser.parse(rows);

    const fileName = `zenvyx-payment-report-${Date.now()}.csv`;

    res.header("Content-Type", "text/csv");
    res.attachment(fileName);
    return res.send(csv);
  } catch (error) {
    console.error("Export payment CSV error:", error);
    return res.status(500).json({
      success: false,
      message: "CSV export failed",
    });
  }
};