import { PrismaClient, CallbackStatus } from "@prisma/client";

const prisma = new PrismaClient();

export class SupportCallbackService {
  async createCallback(data: {
    restaurantId: string;
    phoneNumber: string;
    preferredTime: string;
    reason: string;
  }) {
    return await prisma.supportCallback.create({
      data: {
        restaurantId: data.restaurantId,
        phoneNumber: data.phoneNumber,
        preferredTime: data.preferredTime,
        reason: data.reason,
        status: "pending",
      },
    });
  }

  async listCallbacks(restaurantId: string) {
    return await prisma.supportCallback.findMany({
      where: { restaurantId },
      orderBy: { createdAt: "desc" },
    });
  }

  async getCallbackById(callbackId: string, restaurantId: string) {
    const callback = await prisma.supportCallback.findUnique({
      where: { id: callbackId },
    });

    if (!callback) {
      throw new Error("Callback request not found");
    }

    if (callback.restaurantId !== restaurantId) {
      throw new Error("Access denied: You can only view your own callback requests");
    }

    return callback;
  }

  async cancelCallback(callbackId: string, restaurantId: string) {
    const callback = await prisma.supportCallback.findUnique({
      where: { id: callbackId },
    });

    if (!callback) {
      throw new Error("Callback request not found");
    }

    if (callback.restaurantId !== restaurantId) {
      throw new Error("Access denied: You can only cancel your own callback requests");
    }

    if (callback.status !== "pending") {
      throw new Error("Cannot cancel completed callback request");
    }

    return await prisma.supportCallback.update({
      where: { id: callbackId },
      data: { status: "cancelled" },
    });
  }
}

export const supportCallbackService = new SupportCallbackService();
