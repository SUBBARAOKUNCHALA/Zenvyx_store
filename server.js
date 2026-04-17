const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.resolve(__dirname, ".env") });

const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const productRoutes = require("./routes/productRoutes");
const cartRoutes=require("./routes/cartRoutes")
const addressRoutes=require("./routes/addressRoutes")
const orderRoutes=require("./routes/orderRoutes")

connectDB();

const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://zenvyx-store-ui.vercel.app",
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/address", addressRoutes);
app.use("/api/orders", orderRoutes);

app.get("/", (req, res) => {
  res.send("API Running...");
});

const PORT = process.env.PORT || 5000;

console.log("Loaded CLOUDINARY_CLOUD_NAME:", process.env.CLOUDINARY_CLOUD_NAME);
console.log("Loaded CLOUDINARY_API_KEY:", process.env.CLOUDINARY_API_KEY);
console.log("Loaded CLOUDINARY_API_SECRET exists:", !!process.env.CLOUDINARY_API_SECRET);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});