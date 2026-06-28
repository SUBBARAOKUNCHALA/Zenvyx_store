  const jwt = require("jsonwebtoken");

  const adminProtect = async (req, res, next) => {
    try {
      let token;

      if (
        req.headers.authorization &&
        req.headers.authorization.startsWith("Bearer")
      ) {
        token = req.headers.authorization.split(" ")[1];
      }

      if (!token) {
        return res.status(401).json({
          success: false,
          message: "Admin token not found",
        });
      }

      const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET);

      req.admin = decoded;
      next();
    } catch (error) {
      console.error("adminProtect error:", error);

      if (error.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          message: "Admin token expired. Please login again.",
        });
      }

      return res.status(401).json({
        success: false,
        message: "Invalid admin token. Please login again.",
      });
    }
  };

  module.exports = adminProtect;