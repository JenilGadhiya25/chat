import multer from "multer";
import path from "path";

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (_req, file, cb) => {
    const allowedExt = /jpeg|jpg|png|gif|webp|pdf|mp4|mov|avi|webm/;
    const allowedMime = /image\/|video\/|application\/pdf/;
    const ext = allowedExt.test(path.extname(file.originalname).toLowerCase());
    const mime = allowedMime.test(file.mimetype);
    cb(null, ext || mime);
  },
});
