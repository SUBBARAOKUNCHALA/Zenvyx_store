const jwt = require("jsonwebtoken");

const protect = (req, res, next) => {
  let token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({
      success: false,
      code: "NO_TOKEN",
      message: "No token provided",
    });
  }

  if (!token.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      code: "INVALID_FORMAT",
      message: "Token must start with Bearer",
    });
  }

  try {
    token = token.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        code: "TOKEN_EXPIRED",
        message: "Session expired, please login again",
      });
    }

    return res.status(401).json({
      success: false,
      code: "INVALID_TOKEN",
      message: "Invalid token",
    });
  }
};

module.exports = protect;