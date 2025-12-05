import { Router, Response } from "express";
import { prisma } from "../db";
import { AuthRequest, authenticateToken, requireRole } from "../middleware/auth";
import { uploadProfilePhoto, getFileUrl, deleteFile } from "../middleware/upload";
import { appendAuditEntry } from "../services/tamperProofAuditService";
import path from "path";
import fs from "fs";
import sharp from "sharp";

const router = Router();

const ALLOWED_ROLES = ["customer", "driver", "restaurant", "admin"];
const MAIN_IMAGE_SIZE = 512;
const THUMBNAIL_SIZE = 128;

async function processImage(
  inputPath: string,
  outputDir: string,
  baseName: string
): Promise<{ mainUrl: string; thumbnailUrl: string }> {
  const mainFilename = `${baseName}-main.jpg`;
  const thumbnailFilename = `${baseName}-thumb.jpg`;
  const mainPath = path.join(outputDir, mainFilename);
  const thumbnailPath = path.join(outputDir, thumbnailFilename);

  await sharp(inputPath)
    .resize(MAIN_IMAGE_SIZE, MAIN_IMAGE_SIZE, { fit: "cover" })
    .jpeg({ quality: 85 })
    .toFile(mainPath);

  await sharp(inputPath)
    .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, { fit: "cover" })
    .jpeg({ quality: 80 })
    .toFile(thumbnailPath);

  if (fs.existsSync(inputPath)) {
    fs.unlinkSync(inputPath);
  }

  return {
    mainUrl: getFileUrl(mainFilename),
    thumbnailUrl: getFileUrl(thumbnailFilename),
  };
}

async function getOldPhotoUrls(
  userId: string,
  role: string
): Promise<{ oldUrl: string | null; oldThumbnail: string | null }> {
  let oldUrl: string | null = null;
  let oldThumbnail: string | null = null;

  if (role === "customer") {
    const profile = await prisma.customerProfile.findUnique({
      where: { userId },
      select: { profilePhotoUrl: true, profilePhotoThumbnail: true },
    });
    oldUrl = profile?.profilePhotoUrl || null;
    oldThumbnail = profile?.profilePhotoThumbnail || null;
  } else if (role === "driver") {
    const profile = await prisma.driverProfile.findUnique({
      where: { userId },
      select: { profilePhotoUrl: true, profilePhotoThumbnail: true },
    });
    oldUrl = profile?.profilePhotoUrl || null;
    oldThumbnail = profile?.profilePhotoThumbnail || null;
  } else if (role === "restaurant") {
    const profile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      select: { profilePhotoUrl: true, profilePhotoThumbnail: true },
    });
    oldUrl = profile?.profilePhotoUrl || null;
    oldThumbnail = profile?.profilePhotoThumbnail || null;
  } else if (role === "admin") {
    const profile = await prisma.adminProfile.findUnique({
      where: { userId },
      select: { profilePhotoUrl: true, profilePhotoThumbnail: true },
    });
    oldUrl = profile?.profilePhotoUrl || null;
    oldThumbnail = profile?.profilePhotoThumbnail || null;
  }

  return { oldUrl, oldThumbnail };
}

function deleteOldPhotos(oldUrl: string | null, oldThumbnail: string | null) {
  if (oldUrl) {
    const filename = path.basename(oldUrl);
    deleteFile(filename);
  }
  if (oldThumbnail) {
    const filename = path.basename(oldThumbnail);
    deleteFile(filename);
  }
}

router.post(
  "/upload-photo",
  authenticateToken,
  requireRole(ALLOWED_ROLES),
  (req: AuthRequest, res: Response) => {
    uploadProfilePhoto(req, res, async (err) => {
      if (err) {
        console.error("[ProfilePhoto] Upload error:", err.message);
        if (err.message.includes("File too large")) {
          return res.status(413).json({ error: "File too large. Maximum size is 5MB." });
        }
        if (err.message.includes("Invalid file type")) {
          return res.status(400).json({ error: "Invalid file type. Only JPEG, PNG, and WebP images are allowed." });
        }
        return res.status(500).json({ error: "Failed to upload file" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No file provided" });
      }

      const userId = req.user!.userId;
      const role = req.user!.role;

      try {
        const { oldUrl, oldThumbnail } = await getOldPhotoUrls(userId, role);
        const uploadDir = path.join(process.cwd(), "uploads");
        const inputPath = req.file.path;
        const baseName = `profile-${role}-${userId}-${Date.now()}`;
        const { mainUrl, thumbnailUrl } = await processImage(inputPath, uploadDir, baseName);
        const now = new Date();

        if (role === "customer") {
          await prisma.customerProfile.update({
            where: { userId },
            data: {
              profilePhotoUrl: mainUrl,
              profilePhotoThumbnail: thumbnailUrl,
              profilePhotoLastUpdated: now,
              avatarUrl: mainUrl,
            },
          });
        } else if (role === "driver") {
          await prisma.driverProfile.update({
            where: { userId },
            data: {
              profilePhotoUrl: mainUrl,
              profilePhotoThumbnail: thumbnailUrl,
              profilePhotoLastUpdated: now,
            },
          });
        } else if (role === "restaurant") {
          await prisma.restaurantProfile.update({
            where: { userId },
            data: {
              profilePhotoUrl: mainUrl,
              profilePhotoThumbnail: thumbnailUrl,
              profilePhotoLastUpdated: now,
            },
          });
        } else if (role === "admin") {
          await prisma.adminProfile.update({
            where: { userId },
            data: {
              profilePhotoUrl: mainUrl,
              profilePhotoThumbnail: thumbnailUrl,
              profilePhotoLastUpdated: now,
            },
          });
        }

        deleteOldPhotos(oldUrl, oldThumbnail);

        await appendAuditEntry({
          category: "ADMIN_ACTION",
          severity: "INFO",
          req: req as any,
          action: "profile_image_uploaded",
          entityType: role,
          entityId: userId,
          description: `Profile photo uploaded for ${role} ${userId}`,
          metadata: {
            old_url: oldUrl,
            new_url: mainUrl,
            thumbnail_url: thumbnailUrl,
          },
        });

        console.log(`[ProfilePhoto] Photo uploaded for ${role} ${userId}`);

        return res.json({
          success: true,
          message: "Your profile picture has been updated.",
          profile_photo_url: mainUrl,
          profile_photo_thumbnail: thumbnailUrl,
        });
      } catch (error) {
        console.error("[ProfilePhoto] Processing error:", error);
        return res.status(500).json({ error: "Failed to process profile photo" });
      }
    });
  }
);

router.delete(
  "/remove-photo",
  authenticateToken,
  requireRole(ALLOWED_ROLES),
  async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const role = req.user!.role;

    try {
      const { oldUrl, oldThumbnail } = await getOldPhotoUrls(userId, role);

      if (!oldUrl) {
        return res.status(404).json({ error: "No profile photo to remove" });
      }

      if (role === "customer") {
        await prisma.customerProfile.update({
          where: { userId },
          data: {
            profilePhotoUrl: null,
            profilePhotoThumbnail: null,
            profilePhotoLastUpdated: new Date(),
            avatarUrl: null,
          },
        });
      } else if (role === "driver") {
        await prisma.driverProfile.update({
          where: { userId },
          data: {
            profilePhotoUrl: null,
            profilePhotoThumbnail: null,
            profilePhotoLastUpdated: new Date(),
          },
        });
      } else if (role === "restaurant") {
        await prisma.restaurantProfile.update({
          where: { userId },
          data: {
            profilePhotoUrl: null,
            profilePhotoThumbnail: null,
            profilePhotoLastUpdated: new Date(),
          },
        });
      } else if (role === "admin") {
        await prisma.adminProfile.update({
          where: { userId },
          data: {
            profilePhotoUrl: null,
            profilePhotoThumbnail: null,
            profilePhotoLastUpdated: new Date(),
          },
        });
      }

      deleteOldPhotos(oldUrl, oldThumbnail);

      await appendAuditEntry({
        category: "ADMIN_ACTION",
        severity: "INFO",
        req: req as any,
        action: "profile_image_deleted",
        entityType: role,
        entityId: userId,
        description: `Profile photo deleted for ${role} ${userId}`,
        metadata: {
          deleted_url: oldUrl,
          deleted_thumbnail: oldThumbnail,
        },
      });

      console.log(`[ProfilePhoto] Photo deleted for ${role} ${userId}`);

      return res.json({
        success: true,
        message: "Your profile picture has been removed.",
      });
    } catch (error) {
      console.error("[ProfilePhoto] Delete error:", error);
      return res.status(500).json({ error: "Failed to remove profile photo" });
    }
  }
);

router.get(
  "/my-photo",
  authenticateToken,
  requireRole(ALLOWED_ROLES),
  async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const role = req.user!.role;

    try {
      let profilePhotoUrl: string | null = null;
      let profilePhotoThumbnail: string | null = null;
      let profilePhotoLastUpdated: Date | null = null;

      if (role === "customer") {
        const profile = await prisma.customerProfile.findUnique({
          where: { userId },
          select: { profilePhotoUrl: true, profilePhotoThumbnail: true, profilePhotoLastUpdated: true },
        });
        profilePhotoUrl = profile?.profilePhotoUrl || null;
        profilePhotoThumbnail = profile?.profilePhotoThumbnail || null;
        profilePhotoLastUpdated = profile?.profilePhotoLastUpdated || null;
      } else if (role === "driver") {
        const profile = await prisma.driverProfile.findUnique({
          where: { userId },
          select: { profilePhotoUrl: true, profilePhotoThumbnail: true, profilePhotoLastUpdated: true },
        });
        profilePhotoUrl = profile?.profilePhotoUrl || null;
        profilePhotoThumbnail = profile?.profilePhotoThumbnail || null;
        profilePhotoLastUpdated = profile?.profilePhotoLastUpdated || null;
      } else if (role === "restaurant") {
        const profile = await prisma.restaurantProfile.findUnique({
          where: { userId },
          select: { profilePhotoUrl: true, profilePhotoThumbnail: true, profilePhotoLastUpdated: true },
        });
        profilePhotoUrl = profile?.profilePhotoUrl || null;
        profilePhotoThumbnail = profile?.profilePhotoThumbnail || null;
        profilePhotoLastUpdated = profile?.profilePhotoLastUpdated || null;
      } else if (role === "admin") {
        const profile = await prisma.adminProfile.findUnique({
          where: { userId },
          select: { profilePhotoUrl: true, profilePhotoThumbnail: true, profilePhotoLastUpdated: true },
        });
        profilePhotoUrl = profile?.profilePhotoUrl || null;
        profilePhotoThumbnail = profile?.profilePhotoThumbnail || null;
        profilePhotoLastUpdated = profile?.profilePhotoLastUpdated || null;
      }

      return res.json({
        profile_photo_url: profilePhotoUrl,
        profile_photo_thumbnail: profilePhotoThumbnail,
        profile_photo_last_updated: profilePhotoLastUpdated,
      });
    } catch (error) {
      console.error("[ProfilePhoto] Get error:", error);
      return res.status(500).json({ error: "Failed to get profile photo" });
    }
  }
);

export default router;
