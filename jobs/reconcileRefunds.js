// jobs/reconcileRefunds.js
const razorpay = require("../config/razorpay");
const Order = require("../models/Order");

const reconcilePendingRefunds = async () => {
  const stuckOrders = await Order.find({
    paymentStatus: "Refund_Pending",
    refundId: { $exists: true, $ne: "" },
  });

  console.log(`Reconciling ${stuckOrders.length} pending refund(s)`);

  for (const order of stuckOrders) {
    try {
      const refund = await razorpay.refunds.fetch(order.refundId);

      if (refund.status === "processed") {
        order.paymentStatus = "Refunded";
        order.refundStatus = "processed";
        order.refundedAt = new Date();

        order.statusHistory.push({
          status: order.orderStatus,
          note: "Refund confirmed via reconciliation job",
          changedAt: new Date(),
        });

        await order.save();
        console.log(`Order ${order.orderNumber} reconciled -> Refunded`);
      } else if (refund.status === "failed") {
        order.paymentStatus = "Refund_Failed"; // add this to your enum if not present
        order.refundStatus = "failed";

        order.statusHistory.push({
          status: order.orderStatus,
          note: "Refund failed - needs manual review",
          changedAt: new Date(),
        });

        await order.save();
        console.warn(`Order ${order.orderNumber} refund FAILED - needs attention`);
      }
      // if still "pending", leave it - will check again next run
    } catch (err) {
      console.error(`Reconcile failed for order ${order.orderNumber}:`, err.message);
    }
  }
};

module.exports = reconcilePendingRefunds;