import { z } from "zod";

export const acceptRideSchema = z.object({
  rideId: z.string().uuid("Invalid ride ID format"),
});

export const startRideSchema = z.object({
  rideId: z.string().uuid("Invalid ride ID format"),
  odometerStart: z.number().optional(),
});

export const completeRideSchema = z.object({
  rideId: z.string().uuid("Invalid ride ID format"),
  odometerEnd: z.number().optional(),
  actualDistance: z.number().optional(),
});

export const cancelRideSchema = z.object({
  rideId: z.string().uuid("Invalid ride ID format"),
  reason: z.string().min(1, "Cancellation reason is required").max(500),
  cancelledBy: z.enum(["driver", "customer", "system"]).optional(),
});

export const noShowRideSchema = z.object({
  rideId: z.string().uuid("Invalid ride ID format"),
  waitTimeMinutes: z.number().min(0).max(30).optional(),
  notes: z.string().max(500).optional(),
});

export const rideLocationUpdateSchema = z.object({
  rideId: z.string().uuid("Invalid ride ID format"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().optional(),
  heading: z.number().optional(),
  speed: z.number().optional(),
});
