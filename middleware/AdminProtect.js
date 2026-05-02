// const jwt = require("jsonwebtoken");
// const User = require("../models/User");

// const adminProtect = async (req, res, next) => {
//   try {
//     let token;

//     if (
//       req.headers.authorization &&
//       req.headers.authorization.startsWith("Bearer")
//     ) {
//       token = req.headers.authorization.split(" ")[1];
//     }

//     if (!token) {
//       return res.status(401).json({
//         success: false,
//         message: "Not authorized, no token",
//       });
//     }

//     const decoded = jwt.verify(token, process.env.JWT_SECRET);

//     const user = await User.findById(decoded.userId).select("-password");

//     if (!user) {
//       return res.status(401).json({
//         success: false,
//         message: "User not found",
//       });
//     }

//     if (user.userType !== "admin") {
//       return res.status(403).json({
//         success: false,
//         message: "Access denied. Admin only",
//       });
//     }

//     req.user = {
//       userId: user._id,
//       email: user.email,
//       userType: user.userType,
//     };

//     next();
//   } catch (error) {
//     console.error("adminProtect error:", error);
//     return res.status(401).json({
//       success: false,
//       message: "Not authorized, token failed",
//     });
//   }
// };

// module.exports = adminProtect;

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

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

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