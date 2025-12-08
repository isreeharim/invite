// src/lib/uploadToCloudinary.js
const streamifier = require("streamifier");
const cloudinary = require("./cloudinary");

/**
 * Upload a multer file buffer to Cloudinary using upload_stream.
 * @param {Buffer} buffer - file buffer (req.file.buffer)
 * @param {Object} options - cloudinary upload options (folder, public_id, transformation, etc)
 * @returns {Promise<Object>} - resolves with Cloudinary upload result
 */
function uploadBufferToCloudinary(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
    streamifier.createReadStream(buffer).pipe(stream);
  });
}

module.exports = uploadBufferToCloudinary;
