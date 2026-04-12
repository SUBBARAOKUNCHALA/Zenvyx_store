const mongoose = require("mongoose");
const Product = require("./models/Product");

mongoose.connect("mongodb://localhost:27017/zenvyx_Database");

const products = [
  {
    "name": "Classic White Cotton Shirt",
    "description": "Premium white cotton shirt with regular fit for formal and casual wear.",
    "price": 1299,
    "category": "Shirt",
    "stock": 40,
    "sizes": ["M", "L", "XL"],
    "image": "dummy-shirt-1.jpg",
    "cloudinaryId": "dummy_1"
  },
  {
    "name": "Slim Fit Blue Denim Shirt",
    "description": "Stylish blue denim shirt with slim fit design and full sleeves.",
    "price": 1499,
    "category": "Shirt",
    "stock": 25,
    "sizes": ["S", "M", "L"],
    "image": "dummy-shirt-2.jpg",
    "cloudinaryId": "dummy_2"
  },
  {
    "name": "Black Round Neck T-Shirt",
    "description": "Soft black round neck t-shirt made with breathable cotton fabric.",
    "price": 699,
    "category": "T-Shirt",
    "stock": 60,
    "sizes": ["S", "M", "L", "XL"],
    "image": "dummy-tshirt-1.jpg",
    "cloudinaryId": "dummy_3"
  },
  {
    "name": "Oversized Graphic T-Shirt",
    "description": "Trendy oversized t-shirt with front graphic print and soft fabric.",
    "price": 899,
    "category": "T-Shirt",
    "stock": 45,
    "sizes": ["M", "L", "XL", "XXL"],
    "image": "dummy-tshirt-2.jpg",
    "cloudinaryId": "dummy_4"
  },
  {
    "name": "Men's Casual Chinos Pant",
    "description": "Comfortable casual chinos pant suitable for daily wear and office style.",
    "price": 1599,
    "category": "Pant",
    "stock": 35,
    "sizes": ["30", "32", "34", "36"],
    "image": "dummy-pant-1.jpg",
    "cloudinaryId": "dummy_5"
  }
]

const seedData = async () => {
  try {
    await Product.deleteMany();
    await Product.insertMany(products);
    console.log("Products inserted");
    process.exit();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

seedData();