import { z } from "zod";

export const sendChatMessageSchema = z.object({
  rideId: z.string().uuid("Invalid ride ID format").optional(),
  tripId: z.string().uuid("Invalid trip ID format").optional(),
  orderId: z.string().uuid("Invalid order ID format").optional(),
  message: z.string().min(1, "Message is required").max(1000, "Message too long"),
  messageType: z.enum(["text", "image", "location", "audio"]).optional().default("text"),
}).refine((data) => data.rideId || data.tripId || data.orderId, {
  message: "Ride ID, Trip ID, or Order ID is required",
});

export const getChatMessagesSchema = z.object({
  rideId: z.string().uuid("Invalid ride ID format").optional(),
  tripId: z.string().uuid("Invalid trip ID format").optional(),
  orderId: z.string().uuid("Invalid order ID format").optional(),
  limit: z.number().min(1).max(100).optional().default(50),
  before: z.string().datetime().optional(),
}).refine((data) => data.rideId || data.tripId || data.orderId, {
  message: "Ride ID, Trip ID, or Order ID is required",
});
