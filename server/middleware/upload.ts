import multer from "multer";
import path from "path";
import fs from "fs";

// Ensure upload directory exists
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Sanitize filename to prevent path traversal
function sanitizeFilename(filename: string): string {
  // Remove path separators and null bytes
  return filename
    .replace(/[/\\]/g, "")
    .replace(/\0/g, "")
    .replace(/\.\./g, "")
    .trim();
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // SECURITY: Sanitize original filename to prevent path traversal
    const sanitizedOriginal = sanitizeFilename(file.originalname);
    const ext = path.extname(sanitizedOriginal);
    const nameWithoutExt = path.basename(sanitizedOriginal, ext);
    
    // Generate unique filename with sanitized components
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${nameWithoutExt.substring(0, 50)}-${uniqueSuffix}${ext}`);
  },
});

// File filter for images only
const imageFileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only JPEG, PNG, and WebP images are allowed."));
  }
};

// File filter for documents (images and PDFs)
const documentFileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "application/pdf",
  ];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only JPEG, PNG, WebP, and PDF files are allowed."));
  }
};

// Upload configurations
export const uploadProfilePhoto = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
}).single("file");

export const uploadLicenseImage = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
}).single("licenseImage");

export const uploadVehicleDocument = multer({
  storage,
  fileFilter: documentFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
}).single("document");

// Helper to get file URL from filename
export function getFileUrl(filename: string): string {
  return `/uploads/${filename}`;
}

// File filter for support attachments (images and PDFs)
const supportAttachmentFileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "application/pdf",
  ];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only JPEG, PNG, WebP, and PDF files are allowed."));
  }
};

// Upload configuration for support attachments
export const uploadSupportAttachment = multer({
  storage,
  fileFilter: supportAttachmentFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB default (configurable via settings)
  },
}).single("attachment");

// Upload configuration for menu item images
export const uploadMenuItemImage = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
}).single("menuItemImage");

// Upload configuration for review images (multiple)
export const uploadReviewImages = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file
  },
}).array("reviewImages", 5); // Max 5 images per review

// Helper to delete file
export function deleteFile(filename: string): void {
  const filePath = path.join(uploadDir, filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

// Upload configuration for shop partner images (logo and banner)
export const uploadShopImage = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for shop images
  },
}).single("file");
