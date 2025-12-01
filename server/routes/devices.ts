import { Router } from "express";
import { prisma } from "../lib/prisma";
import { DevicePlatform } from "@prisma/client";
import { authenticateToken } from "../middleware/authz";
import { z } from "zod";

const router = Router();

const registerDeviceSchema = z.object({
  fcmToken: z.string().min(1, "FCM token is required"),
  platform: z.enum(["ios", "android", "web"]),
  deviceId: z.string().optional(),
  deviceModel: z.string().optional(),
  osVersion: z.string().optional(),
  appVersion: z.string().optional(),
  locale: z.string().optional(),
});

router.post("/register", authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.userId || !user?.role) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const validated = registerDeviceSchema.parse(req.body);
    
    const platformMap: Record<string, DevicePlatform> = {
      ios: DevicePlatform.ios,
      android: DevicePlatform.android,
      web: DevicePlatform.web,
    };

    const existingDevice = await prisma.userDevice.findFirst({
      where: {
        userId: user.userId,
        fcmToken: validated.fcmToken,
      },
    });

    if (existingDevice) {
      const updated = await prisma.userDevice.update({
        where: { id: existingDevice.id },
        data: {
          role: user.role,
          platform: platformMap[validated.platform],
          deviceId: validated.deviceId,
          deviceModel: validated.deviceModel,
          osVersion: validated.osVersion,
          appVersion: validated.appVersion,
          locale: validated.locale,
          isActive: true,
          revokedAt: null,
          revokeReason: null,
          lastSeenAt: new Date(),
          failureCount: 0,
        },
      });

      return res.json({
        success: true,
        deviceId: updated.id,
        message: "Device token updated",
      });
    }

    const device = await prisma.userDevice.create({
      data: {
        userId: user.userId,
        role: user.role,
        platform: platformMap[validated.platform],
        fcmToken: validated.fcmToken,
        deviceId: validated.deviceId,
        deviceModel: validated.deviceModel,
        osVersion: validated.osVersion,
        appVersion: validated.appVersion,
        locale: validated.locale,
        isActive: true,
        lastSeenAt: new Date(),
      },
    });

    res.status(201).json({
      success: true,
      deviceId: device.id,
      message: "Device registered successfully",
    });
  } catch (error: any) {
    console.error("[DeviceRoutes] Error registering device:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(500).json({ error: error.message || "Failed to register device" });
  }
});

router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;

    const device = await prisma.userDevice.findUnique({
      where: { id },
    });

    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    if (device.userId !== user.userId) {
      return res.status(403).json({ error: "Forbidden: You can only remove your own devices" });
    }

    await prisma.userDevice.update({
      where: { id },
      data: {
        isActive: false,
        revokedAt: new Date(),
        revokeReason: "User requested removal",
      },
    });

    res.json({ success: true, message: "Device removed" });
  } catch (error: any) {
    console.error("[DeviceRoutes] Error removing device:", error);
    res.status(500).json({ error: error.message || "Failed to remove device" });
  }
});

router.get("/", authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const devices = await prisma.userDevice.findMany({
      where: {
        userId: user.userId,
        isActive: true,
      },
      select: {
        id: true,
        platform: true,
        deviceId: true,
        deviceModel: true,
        osVersion: true,
        appVersion: true,
        locale: true,
        lastSeenAt: true,
        createdAt: true,
      },
      orderBy: { lastSeenAt: "desc" },
    });

    res.json({ devices });
  } catch (error: any) {
    console.error("[DeviceRoutes] Error listing devices:", error);
    res.status(500).json({ error: error.message || "Failed to list devices" });
  }
});

router.post("/logout-all", authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const result = await prisma.userDevice.updateMany({
      where: {
        userId: user.userId,
        isActive: true,
      },
      data: {
        isActive: false,
        revokedAt: new Date(),
        revokeReason: "Logged out from all devices",
      },
    });

    res.json({
      success: true,
      message: `Logged out from ${result.count} device(s)`,
      devicesRemoved: result.count,
    });
  } catch (error: any) {
    console.error("[DeviceRoutes] Error logging out all devices:", error);
    res.status(500).json({ error: error.message || "Failed to logout from all devices" });
  }
});

export default router;
