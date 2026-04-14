const cloudinary = require("../config/cloudinary");

/* upload single buffer */
const uploadToCloudinary = (fileBuffer, folder = "products") => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder,
          resource_type: "image",
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result.secure_url);
        }
      )
      .end(fileBuffer);
  });
};

/* upload multiple images (max 4) */
const uploadMultipleImages = async (files, folder = "products") => {
  if (!files || files.length === 0) return [];

  if (files.length > 4) {
    throw new Error("Maximum 4 images allowed");
  }

  const uploadedImages = [];

  for (const file of files) {
    const url = await uploadToCloudinary(file.buffer, folder);
    uploadedImages.push(url);
  }

  return uploadedImages;
};

module.exports = {
  uploadToCloudinary,
  uploadMultipleImages,
};