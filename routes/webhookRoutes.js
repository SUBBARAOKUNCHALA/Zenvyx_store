// routes/webhookRoutes.js
const express = require("express");
const router = express.Router();
const { handleRazorpayWebhook } = require("../controllers/webhookController");

router.post(
  "/razorpay",
  express.raw({ type: "application/json" }),
  (req, res, next) => {
    req.rawBody = req.body; // Buffer, needed for signature check
    req.body = JSON.parse(req.body.toString("utf8")); // now parse for use in controller
    next();
  },
  handleRazorpayWebhook
);

module.exports = router;