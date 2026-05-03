require("dotenv").config();

const mongoose = require("mongoose");
const Product = require("./models/Product");

const migrateSizes = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI not found in .env file");
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");

    const products = await Product.find({}).lean();

    let updatedCount = 0;
    let skippedCount = 0;

    for (const product of products) {
      if (!Array.isArray(product.sizes)) {
        skippedCount++;
        continue;
      }

      if (
        product.sizes.length > 0 &&
        typeof product.sizes[0] === "object" &&
        product.sizes[0].size
      ) {
        console.log(`Skipped already migrated: ${product.name}`);
        skippedCount++;
        continue;
      }

      const newSizes = product.sizes.map((size) => ({
        size: String(size),
        stock: product.stock || 0,
      }));

      await Product.updateOne(
        { _id: product._id },
        {
          $set: {
            sizes: newSizes,
          },
        },
        {
          runValidators: false,
        }
      );

      console.log(`Migrated: ${product.name}`);
      updatedCount++;
    }

    console.log("Migration completed");
    console.log(`Updated products: ${updatedCount}`);
    console.log(`Skipped products: ${skippedCount}`);

    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error.message);
    process.exit(1);
  }
};

migrateSizes();