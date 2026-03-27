import fs from "fs";
import path from "path";
import crypto from "crypto";

const uploadDir = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const localPublicPath = (filename) => `/uploads/${filename}`;

const saveLocal = (file) => {
  const ext = path.extname(file.originalname || "") || "";
  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  const absPath = path.join(uploadDir, filename);
  fs.writeFileSync(absPath, file.buffer);
  return localPublicPath(filename);
};

const buildCloudinarySignature = (params, apiSecret) => {
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return crypto.createHash("sha1").update(`${toSign}${apiSecret}`).digest("hex");
};

const uploadCloudinary = async (file, folder = "chatapp") => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return "";

  const timestamp = Math.floor(Date.now() / 1000);
  const params = { folder, timestamp };
  const signature = buildCloudinarySignature(params, apiSecret);

  const form = new FormData();
  form.append("file", new Blob([file.buffer]), file.originalname || "upload.bin");
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("folder", folder);
  form.append("signature", signature);

  const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;
  const res = await fetch(endpoint, { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || "Cloudinary upload failed");
  }
  return data?.secure_url || data?.url || "";
};

export const storeMediaFile = async (file, options = {}) => {
  if (!file) return "";
  const folder = options.folder || "chatapp";

  // Prefer durable cloud storage in production when configured.
  if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
    try {
      const cloudUrl = await uploadCloudinary(file, folder);
      if (cloudUrl) return cloudUrl;
    } catch {
      // fall through to local storage as last resort
    }
  }

  return saveLocal(file);
};

