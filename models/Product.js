const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            required: true,
            trim: true,
        },
        price: {
            type: Number,
            required: true,
        },
        category: {
            type: String,
            required: true,
            enum: ["Shirt", "T-Shirt", "Pant"],
            trim: true,
        },
        stock: {
            type: Number,
            required: true,
            default: 0,
        },
        sizes: {
            type: [String],
            required: true,
            validate: {
                validator: function (value) {
                    return value && value.length > 0;
                },
                message: "At least one size is required",
            },
        },
        image: {
            type: String,
            required: true,
        },
        cloudinaryId: {
            type: String,
            required: true,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);