const Address = require("../models/Address");

exports.addAddress = async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;

    const {
      fullName,
      mobile,
      pincode,
      state,
      city,
      houseNo,
      area,
      landmark,
      addressType,
      isDefault,
    } = req.body;

    if (!fullName || !mobile || !pincode || !state || !city || !houseNo || !area) {
      return res.status(400).json({
        success: false,
        message: "All required address fields must be provided",
      });
    }

    if (isDefault) {
      await Address.updateMany({ userId }, { $set: { isDefault: false } });
    }

    const address = await Address.create({
      userId,
      fullName,
      mobile,
      pincode,
      state,
      city,
      houseNo,
      area,
      landmark,
      addressType,
      isDefault: !!isDefault,
    });

    return res.status(201).json({
      success: true,
      message: "Address added successfully",
      data: address,
    });
  } catch (error) {
    console.error("addAddress error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to add address",
    });
  }
};

exports.getMyAddresses = async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;

    const addresses = await Address.find({ userId }).sort({ isDefault: -1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: addresses.length,
      data: addresses,
    });
  } catch (error) {
    console.error("getMyAddresses error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch addresses",
    });
  }
};

exports.getDefaultAddress = async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;

    const address = await Address.findOne({ userId, isDefault: true });

    return res.status(200).json({
      success: true,
      data: address,
    });
  } catch (error) {
    console.error("getDefaultAddress error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch default address",
    });
  }
};

exports.updateAddress = async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { id } = req.params;
    const updateData = req.body;

    const existing = await Address.findOne({ _id: id, userId });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    if (updateData.isDefault) {
      await Address.updateMany({ userId }, { $set: { isDefault: false } });
    }

    const updated = await Address.findByIdAndUpdate(id, updateData, { new: true });

    return res.status(200).json({
      success: true,
      message: "Address updated successfully",
      data: updated,
    });
  } catch (error) {
    console.error("updateAddress error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update address",
    });
  }
};

exports.deleteAddress = async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { id } = req.params;

    const deleted = await Address.findOneAndDelete({ _id: id, userId });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Address deleted successfully",
    });
  } catch (error) {
    console.error("deleteAddress error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete address",
    });
  }
};

exports.setDefaultAddress = async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { id } = req.params;

    const address = await Address.findOne({ _id: id, userId });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    await Address.updateMany({ userId }, { $set: { isDefault: false } });
    address.isDefault = true;
    await address.save();

    return res.status(200).json({
      success: true,
      message: "Default address updated successfully",
      data: address,
    });
  } catch (error) {
    console.error("setDefaultAddress error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to set default address",
    });
  }
};