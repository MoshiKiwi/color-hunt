// Non-secret: Cloudinary unsigned upload presets are meant to be used client-side.
module.exports = async (req, res) => {
  res.status(200).json({
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET || '',
  });
};
