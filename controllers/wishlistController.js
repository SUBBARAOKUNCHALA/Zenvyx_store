const Wishlist = require("../models/Wishlist");

exports.toggleWishlist = async (req, res) => {
  try {
    const userId = req.user.id;
    const productId = req.params.productId;

    // console.log("userId:", userId);
    // console.log("productId:", productId);

    const existing = await Wishlist.findOne({
      userId,
      productId,
    });

    if (existing) {
      await Wishlist.findByIdAndDelete(existing._id);

      return res.json({
        success: true,
        liked: false,
        message: "Removed from wishlist",
      });
    }

    await Wishlist.create({
      userId,
      productId,
    });

    return res.json({
      success: true,
      liked: true,
      message: "Added to wishlist",
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.getWishlist = async (req, res) => {
  try {
    const wishlist = await Wishlist.find({
      userId: req.user.id,
    }).populate("productId");

    console.log("wish List",wishlist)

    return res.status(200).json({
      success: true,
      wishlist,
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};


exports.removeWishlist = async (req, res) => {
  try {
    await Wishlist.findOneAndDelete({
      userId: req.userId,
      productId: req.params.productId,
    });

    res.json({
      success: true,
      message: "Removed successfully",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};