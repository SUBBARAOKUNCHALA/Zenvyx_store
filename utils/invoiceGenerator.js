const PDFDocument = require("pdfkit");

module.exports = (order, res) => {
  const doc = new PDFDocument({
    size: "A4",
    margin: 40,
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=Invoice-${order.orderNumber}.pdf`
  );

  doc.pipe(res);

  const address = order.address || {};

  // =====================================================
  // COMPANY HEADER
  // =====================================================

  doc
    .fillColor("#111827")
    .fontSize(28)
    .font("Helvetica-Bold")
    .text("ZENVYX", { align: "center" });

  doc
    .fontSize(18)
    .fillColor("#555")
    .text("TAX INVOICE", { align: "center" });

  doc.moveDown();

  doc
    .strokeColor("#cccccc")
    .moveTo(40, doc.y)
    .lineTo(555, doc.y)
    .stroke();

  doc.moveDown();

  // =====================================================
  // ORDER DETAILS
  // =====================================================

  doc.font("Helvetica-Bold").fontSize(12);

  doc.text(`Invoice No : INV-${order._id.toString().slice(-6)}`);
  doc.text(`Order No : ${order.orderNumber}`);
  doc.text(
    `Invoice Date : ${new Date(order.createdAt).toLocaleDateString()}`
  );

  if (order.deliveredAt) {
    doc.text(
      `Delivery Date : ${new Date(order.deliveredAt).toLocaleDateString()}`
    );
  }

  doc.moveDown();

  // =====================================================
  // CUSTOMER DETAILS
  // =====================================================

  doc
    .font("Helvetica-Bold")
    .fontSize(15)
    .text("Billing Address");

  doc.moveDown(0.4);

  doc.font("Helvetica").fontSize(11);

  doc.text(address.fullName || "");

  doc.text(address.mobile || "");

  doc.text(`${address.houseNo || ""}`);

  doc.text(`${address.area || ""}`);

  if (address.landmark) {
    doc.text(`Landmark : ${address.landmark}`);
  }

  doc.text(`${address.city || ""}, ${address.state || ""}`);

  doc.text(`PIN : ${address.pincode || ""}`);

  doc.moveDown();

  // =====================================================
  // PRODUCTS TABLE
  // =====================================================

  doc
    .font("Helvetica-Bold")
    .fontSize(15)
    .text("Products");

  doc.moveDown();

  doc.fontSize(11);

  doc.text(
    "--------------------------------------------------------------------------"
  );

  doc.font("Helvetica-Bold");

  doc.text(
    "Product                           Size     Qty     Price      Total"
  );

  doc.text(
    "--------------------------------------------------------------------------"
  );

  doc.font("Helvetica");

  order.items.forEach((item) => {
    const productName =
      item.name.length > 28
        ? item.name.substring(0, 28) + "..."
        : item.name;

    doc.text(
      `${productName.padEnd(32)} ${String(item.size).padEnd(8)} ${String(
        item.quantity
      ).padEnd(7)} ₹${item.price.toFixed(2).padEnd(10)} ₹${item.subtotal.toFixed(
        2
      )}`
    );
  });

  doc.text(
    "--------------------------------------------------------------------------"
  );

  doc.moveDown();

  // =====================================================
  // TOTALS
  // =====================================================

  doc.font("Helvetica-Bold");

  doc.text(
    `Subtotal : ₹${Number(order.subtotalAmount).toFixed(2)}`,
    {
      align: "right",
    }
  );

  doc.text(
    `Delivery Charge : ₹${Number(order.deliveryCharge).toFixed(2)}`,
    {
      align: "right",
    }
  );

  doc.text(
    `Discount : ₹${Number(order.discountAmount).toFixed(2)}`,
    {
      align: "right",
    }
  );

  doc.moveDown(0.5);

  doc
    .fontSize(15)
    .fillColor("#000")
    .text(`Grand Total : ₹${Number(order.finalAmount).toFixed(2)}`, {
      align: "right",
    });

  doc.moveDown();

  // =====================================================
  // PAYMENT DETAILS
  // =====================================================

  doc
    .font("Helvetica-Bold")
    .fontSize(15)
    .fillColor("#111")
    .text("Payment Details");

  doc.moveDown(0.4);

  doc.font("Helvetica").fontSize(11);

  doc.text(`Payment Method : ${order.paymentMethod}`);

  doc.text(`Payment Status : ${order.paymentStatus}`);

  doc.text(`Order Status : ${order.orderStatus}`);

  if (order.razorpayPaymentId) {
    doc.text(`Payment Id : ${order.razorpayPaymentId}`);
  }

  doc.moveDown();

  // =====================================================
  // SHIPPING DETAILS
  // =====================================================

  doc
    .font("Helvetica-Bold")
    .fontSize(15)
    .text("Shipping Details");

  doc.moveDown(0.4);

  doc.font("Helvetica").fontSize(11);

  doc.text(
    `Courier : ${order.shippingProvider || "Not Available"}`
  );

  doc.text(
    `Tracking ID : ${order.trackingId || "Not Available"}`
  );

  doc.moveDown(2);

  // =====================================================
  // FOOTER
  // =====================================================

  doc
    .strokeColor("#cccccc")
    .moveTo(40, doc.y)
    .lineTo(555, doc.y)
    .stroke();

  doc.moveDown();

  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("gray")
    .text(
      "This is a computer generated invoice and does not require a signature.",
      {
        align: "center",
      }
    );

  doc.moveDown(0.5);

  doc
    .fontSize(11)
    .fillColor("#111")
    .text("Thank you for shopping with ZENVYX ❤️", {
      align: "center",
    });

  doc.end();
};