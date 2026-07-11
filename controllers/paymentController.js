const razorpay = require("../config/razorpay");
const crypto = require("crypto");
exports.createRazorpayOrder = async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid amount",
      });
    }

    const options = {
      amount: Math.round(Number(amount) * 100),
      currency: "INR",
      receipt: `ZENVYX_${Date.now()}`,
      payment_capture: 1,
      notes: {
        source: "zenvyx-store",
      },
    };

    const order = await razorpay.orders.create(options);

    return res.status(200).json({
      success: true,
      message: "Razorpay order created",
      data: order,
    });
  } catch (err) {
    console.log("Create Razorpay Order Error :", err);

    return res.status(500).json({
      success: false,
      message: "Unable to create Razorpay order",
      error: err.message,
    });
  }
};
exports.verifyRazorpayPayment = async (req, res) => {
  try {

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing payment details",
      });
    }

    const generatedSignature = crypto
      .createHmac(
        "sha256",
        process.env.RAZORPAY_KEY_SECRET
      )
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Payment verification failed",
      });
    }

    // Fetch payment details directly from Razorpay

    const payment = await razorpay.payments.fetch(
      razorpay_payment_id
    );

    if (payment.status !== "captured") {
      return res.status(400).json({
        success: false,
        message: "Payment not captured",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      payment,
    });

  } catch (err) {

    console.log("Verify Payment Error :", err);

    return res.status(500).json({
      success: false,
      message: "Payment verification failed",
      error: err.message,
    });

  }
};