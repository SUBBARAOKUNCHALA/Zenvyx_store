const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmail = async (to, subject, html) => {
    console.log("user mail",to)
    console.log("from mail",process.env.RESEND_FROM_EMAIL)
  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL, // use your domain later
      to,
      subject,
      html,
    });
  } catch (error) {
    console.log("Resend error:", error);
    throw error;
  }
};

module.exports = sendEmail;