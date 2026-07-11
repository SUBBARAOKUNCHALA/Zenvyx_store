const crypto = require("crypto");
const Order = require("../models/Order");

const verifySignature = (rawBody, signature) => {
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  // timing-safe comparison
  return (
    expected.length === signature?.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  );
};

exports.handleRazorpayWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"];

    // req.rawBody must be the untouched buffer/string - set up in app.js (step 3)
    if (!signature || !verifySignature(req.rawBody, signature)) {
      console.error("Webhook signature mismatch");
      return res.status(400).json({ success: false, message: "Invalid signature" });
    }

    const event = req.body.event;
    console.log("Razorpay webhook received:", event);

    switch (event) {
      case "payment.captured":
        await handlePaymentCaptured(req.body.payload.payment.entity);
        break;

      case "payment.failed":
        await handlePaymentFailed(req.body.payload.payment.entity);
        break;

      case "refund.processed":
        await handleRefundProcessed(req.body.payload.refund.entity);
        break;

      default:
        console.log("Unhandled webhook event:", event);
    }

    // Always 200 once verified, or Razorpay will keep retrying the same event
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Webhook processing error:", error);
    // Still return 200 so Razorpay doesn't hammer retries for a bug on our side
    // (log it and fix it, don't let it become a retry storm)
    return res.status(200).json({ success: false, message: "Processed with error" });
  }
};

async function handlePaymentCaptured(payment) {
  const razorpayOrderId = payment.order_id;
  const razorpayPaymentId = payment.id;

  const order = await Order.findOne({ razorpayOrderId });

  if (!order) {
    // Order not created yet on our side (client callback hasn't landed).
    // This is expected sometimes - safe to skip, since placeOrder() will
    // set paymentStatus: "Paid" itself once it runs.
    console.warn(
      `payment.captured for ${razorpayOrderId} - no matching order yet, skipping`
    );
    return;
  }

  // idempotency guard - webhook can be retried / arrive twice
  if (order.paymentStatus === "Paid") {
    console.log(`Order ${order.orderNumber} already marked Paid, skipping`);
    return;
  }

  order.paymentStatus = "Paid";
  order.razorpayPaymentId = razorpayPaymentId;

  order.statusHistory.push({
    status: order.orderStatus,
    note: "Payment confirmed via webhook (payment.captured)",
    changedAt: new Date(),
  });

  await order.save();
  console.log(`Order ${order.orderNumber} marked Paid via webhook`);
}

async function handlePaymentFailed(payment) {
  const razorpayOrderId = payment.order_id;

  const order = await Order.findOne({ razorpayOrderId });

  if (!order) {
    // No order was ever created for this attempt (most common case -
    // client never called placeOrder because payment failed before handler ran).
    // Nothing to update. This is the normal "failed before order creation" path.
    console.log(
      `payment.failed for ${razorpayOrderId} - no order was created, nothing to reconcile`
    );
    return;
  }

  if (order.paymentStatus === "Paid") {
    // Shouldn't normally happen, but never downgrade a confirmed payment
    console.warn(
      `payment.failed received for already-Paid order ${order.orderNumber}, ignoring`
    );
    return;
  }

  order.paymentStatus = "Failed"; // make sure your Order schema's enum includes "Failed"

  order.statusHistory.push({
    status: order.orderStatus,
    note: `Payment failed: ${payment.error_description || "Unknown reason"}`,
    changedAt: new Date(),
  });

  await order.save();
  console.log(`Order ${order.orderNumber} marked Failed via webhook`);
}

async function handleRefundProcessed(refund) {
  const razorpayPaymentId = refund.payment_id;

  const order = await Order.findOne({ razorpayPaymentId });

  if (!order) {
    console.warn(`refund.processed for payment ${razorpayPaymentId} - no matching order`);
    return;
  }

  if (order.paymentStatus === "Refunded") {
    return; // already handled (e.g. by cancelMyOrder's direct refund call)
  }

  order.paymentStatus = "Refunded";
  order.refundId = refund.id;
  order.refundStatus = "processed";
  order.refundAmount = refund.amount ? refund.amount / 100 : order.finalAmount;
  order.refundedAt = new Date();

  order.statusHistory.push({
    status: order.orderStatus,
    note: "Refund confirmed via webhook (refund.processed)",
    changedAt: new Date(),
  });

  await order.save();
  console.log(`Order ${order.orderNumber} refund confirmed via webhook`);
}