import multer from "multer";
import path from "path";
import fs from "fs";

// Use local disk storage — no Cloudinary dependency required
const uploadDir = "uploads";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, unique + path.extname(file.originalname));
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (_req, file, cb) => {
    const allowedExt = /jpeg|jpg|png|gif|webp|pdf|mp4|mov|avi|webm/;
    const allowedMime = /image\/|video\/|application\/pdf/;
    const ext = allowedExt.test(path.extname(file.originalname).toLowerCase());
    const mime = allowedMime.test(file.mimetype);
    cb(null, ext || mime);
  },
});
