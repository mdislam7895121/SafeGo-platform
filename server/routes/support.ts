import { Router } from "express";
import { db } from "../db";
import * as supportService from "../services/supportService";
import { z } from "zod";

const router = Router();
const prisma = db;

router.use((req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
});

router.get("/conversations", async (req, res) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;

    let userType: "driver" | "customer" | "restaurant";
    if (userRole === "driver") {
      userType = "driver";
    } else if (userRole === "restaurant") {
      userType = "restaurant";
    } else if (userRole === "customer") {
      userType = "customer";
    } else {
      return res.status(403).json({ message: "Invalid user role for support" });
    }

    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const status = req.query.status as string | undefined;

    const result = await supportService.listConversations(
      {
        userId,
        page,
        pageSize,
        status: status as any,
      },
      {
        userId,
        userType,
        permissions: [],
      }
    );

    res.json(result);
  } catch (error: any) {
    console.error("Error listing conversations:", error);
    res.status(500).json({ message: error.message || "Failed to list conversations" });
  }
});

router.post("/conversations", async (req, res) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;

    let userType: "driver" | "customer" | "restaurant";
    let countryCode: "BD" | "US";

    if (userRole === "driver") {
      userType = "driver";
      const driver = await prisma.driverProfile.findUnique({ where: { userId } });
      countryCode = (driver?.countryCode as "BD" | "US") || "BD";
    } else if (userRole === "restaurant") {
      userType = "restaurant";
      const restaurant = await prisma.restaurantProfile.findUnique({ where: { userId } });
      countryCode = (restaurant?.countryCode as "BD" | "US") || "BD";
    } else if (userRole === "customer") {
      userType = "customer";
      const user = await prisma.user.findUnique({ where: { id: userId } });
      countryCode = (user?.countryCode as "BD" | "US") || "BD";
    } else {
      return res.status(403).json({ message: "Invalid user role for support" });
    }

    const { subject, initialMessage, priority } = req.body;

    if (!subject || !initialMessage) {
      return res.status(400).json({ message: "Subject and initial message are required" });
    }

    const result = await supportService.createConversation(
      {
        userId,
        userType,
        countryCode,
        subject,
        initialMessage,
        priority,
      },
      {
        userId,
        userType,
        permissions: [],
      }
    );

    res.status(201).json(result);
  } catch (error: any) {
    console.error("Error creating conversation:", error);
    res.status(500).json({ message: error.message || "Failed to create conversation" });
  }
});

router.get("/conversations/:id", async (req, res) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const conversationId = req.params.id;

    let userType: "driver" | "customer" | "restaurant";
    if (userRole === "driver") {
      userType = "driver";
    } else if (userRole === "restaurant") {
      userType = "restaurant";
    } else if (userRole === "customer") {
      userType = "customer";
    } else {
      return res.status(403).json({ message: "Invalid user role for support" });
    }

    const conversation = await supportService.getConversation(
      conversationId,
      {
        userId,
        userType,
        permissions: [],
      },
      false
    );

    res.json(conversation);
  } catch (error: any) {
    console.error("Error getting conversation:", error);
    const statusCode = error.message?.includes("Unauthorized") ? 403 : 404;
    res.status(statusCode).json({ message: error.message || "Conversation not found" });
  }
});

router.get("/conversations/:id/messages", async (req, res) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const conversationId = req.params.id;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 50;

    let userType: "driver" | "customer" | "restaurant";
    if (userRole === "driver") {
      userType = "driver";
    } else if (userRole === "restaurant") {
      userType = "restaurant";
    } else if (userRole === "customer") {
      userType = "customer";
    } else {
      return res.status(403).json({ message: "Invalid user role for support" });
    }

    const conversation = await supportService.getConversation(
      conversationId,
      {
        userId,
        userType,
        permissions: [],
      },
      false
    );

    const result = await supportService.getConversationMessages(conversationId, page, pageSize);

    await supportService.markMessagesAsRead(conversationId, false);

    res.json(result);
  } catch (error: any) {
    console.error("Error getting messages:", error);
    const statusCode = error.message?.includes("Unauthorized") ? 403 : 500;
    res.status(statusCode).json({ message: error.message || "Failed to get messages" });
  }
});

router.post("/conversations/:id/messages", async (req, res) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const conversationId = req.params.id;
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ message: "Message content is required" });
    }

    let userType: "driver" | "customer" | "restaurant";
    if (userRole === "driver") {
      userType = "driver";
    } else if (userRole === "restaurant") {
      userType = "restaurant";
    } else if (userRole === "customer") {
      userType = "customer";
    } else {
      return res.status(403).json({ message: "Invalid user role for support" });
    }

    const message = await supportService.sendMessage(
      {
        conversationId,
        senderType: "user",
        senderId: userId,
        content,
      },
      {
        userId,
        userType,
        permissions: [],
      }
    );

    res.status(201).json(message);
  } catch (error: any) {
    console.error("Error sending message:", error);
    const statusCode = error.message?.includes("Unauthorized") ? 403 : 500;
    res.status(statusCode).json({ message: error.message || "Failed to send message" });
  }
});

export default router;
