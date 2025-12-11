import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth";
import { paymentService } from "../services/paymentService";
import { getStripePublishableKey, isStripeConfigured } from "../services/stripeClient";
import { PaymentProvider, DeliveryServiceType } from "@prisma/client";
import { z } from "zod";

const router = Router();

const createPaymentSchema = z.object({
  orderType: z.enum(["ride", "food_order", "delivery"]),
  orderId: z.string().min(1),
});

router.get("/config", async (_req: Request, res: Response) => {
  try {
    const featureEnabled = process.env.FEATURE_US_ONLINE_PAYMENTS_ENABLED === "true";
    const stripeConfigured = await isStripeConfigured();

    res.json({
      featureEnabled,
      stripeConfigured,
      status: featureEnabled && stripeConfigured ? "READY" : "NOT_CONFIGURED",
    });
  } catch (error: any) {
    console.error("[StripeUS] Error checking config:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/create", authenticateToken, requireRole(["customer"]), async (req: AuthRequest, res: Response) => {
  try {
    const featureEnabled = process.env.FEATURE_US_ONLINE_PAYMENTS_ENABLED === "true";
    if (!featureEnabled) {
      return res.status(403).json({
        error: "US online payments are not enabled",
        code: "feature_disabled",
      });
    }

    const stripeConfigured = await isStripeConfigured();
    if (!stripeConfigured) {
      return res.status(503).json({
        error: "Stripe payment gateway is not configured",
        code: "gateway_not_configured",
      });
    }

    const userId = req.user!.userId;
    const body = createPaymentSchema.parse(req.body);

    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId },
      include: { user: { select: { countryCode: true } } },
    });

    if (!customerProfile) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    if (customerProfile.user.countryCode !== "US") {
      return res.status(400).json({
        error: "This endpoint is only available for US customers",
        code: "country_mismatch",
      });
    }

    let order: any;
    let serviceType: DeliveryServiceType;
    let amount: number;

    switch (body.orderType) {
      case "ride":
        order = await prisma.ride.findUnique({ where: { id: body.orderId } });
        serviceType = "ride";
        if (!order) {
          return res.status(404).json({ error: "Ride not found" });
        }
        if (order.customerId !== customerProfile.id) {
          return res.status(403).json({ error: "Ride does not belong to this customer" });
        }
        if (order.countryCode !== "US") {
          return res.status(400).json({ error: "This ride is not in the US" });
        }
        amount = Number(order.serviceFare);
        break;

      case "food_order":
        order = await prisma.foodOrder.findUnique({ 
          where: { id: body.orderId },
          include: { restaurant: { select: { countryCode: true } } }
        });
        serviceType = "food";
        if (!order) {
          return res.status(404).json({ error: "Food order not found" });
        }
        if (order.customerId !== customerProfile.id) {
          return res.status(403).json({ error: "Order does not belong to this customer" });
        }
        if (order.restaurant?.countryCode !== "US") {
          return res.status(400).json({ error: "This food order is not in the US" });
        }
        amount = Number(order.serviceFare);
        break;

      case "delivery":
        order = await prisma.delivery.findUnique({ where: { id: body.orderId } });
        serviceType = "parcel";
        if (!order) {
          return res.status(404).json({ error: "Delivery not found" });
        }
        if (order.customerId !== customerProfile.id) {
          return res.status(403).json({ error: "Delivery does not belong to this customer" });
        }
        if (order.countryCode !== "US") {
          return res.status(400).json({ error: "This delivery is not in the US" });
        }
        amount = Number(order.serviceFare);
        break;

      default:
        return res.status(400).json({ error: "Invalid order type" });
    }

    if (order.paymentStatus === "paid") {
      return res.status(400).json({
        error: "Order has already been paid",
        code: "already_paid",
      });
    }

    const idempotencyKey = `stripe_us_${body.orderType}_${body.orderId}`;

    console.log(`[StripeUS] Creating payment intent for ${body.orderType}/${body.orderId}, amount: ${amount} USD`);

    const result = await paymentService.createPayment({
      customerId: customerProfile.id,
      serviceType,
      entityId: body.orderId,
      amount,
      currency: "USD",
      countryCode: "US",
      provider: PaymentProvider.stripe,
      idempotencyKey,
      metadata: {
        orderType: body.orderType,
        orderId: body.orderId,
        customerId: customerProfile.id,
        userId,
      },
    });

    if (!result.success) {
      console.error(`[StripeUS] Payment creation failed:`, result.error);
      return res.status(400).json({
        error: result.error || "Failed to create payment",
        code: result.errorCode,
      });
    }

    switch (body.orderType) {
      case "ride":
        await prisma.ride.update({
          where: { id: body.orderId },
          data: {
            paymentMethod: "online_gateway",
            paymentProvider: "stripe",
            paymentStatus: "pending",
            paymentId: result.paymentId,
            paymentReferenceId: result.paymentId,
            paymentCurrency: "USD",
            paymentCountryCode: "US",
          },
        });
        break;
      case "food_order":
        await prisma.foodOrder.update({
          where: { id: body.orderId },
          data: {
            paymentMethod: "online_gateway",
            paymentProvider: "stripe",
            paymentStatus: "pending",
            paymentId: result.paymentId,
            paymentReferenceId: result.paymentId,
            paymentCurrency: "USD",
            paymentCountryCode: "US",
          },
        });
        break;
      case "delivery":
        await prisma.delivery.update({
          where: { id: body.orderId },
          data: {
            paymentMethod: "online_gateway",
            paymentProvider: "stripe",
            paymentStatus: "pending",
            paymentId: result.paymentId,
            paymentReferenceId: result.paymentId,
            paymentCurrency: "USD",
            paymentCountryCode: "US",
          },
        });
        break;
    }

    const publishableKey = await getStripePublishableKey();

    console.log(`[StripeUS] Payment intent created successfully: ${result.paymentId}`);

    res.json({
      success: true,
      paymentId: result.paymentId,
      clientSecret: result.clientSecret,
      publishableKey,
      amount,
      currency: "USD",
    });
  } catch (error: any) {
    console.error("[StripeUS] Error creating payment:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Invalid request body", details: error.errors });
    }
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

router.get("/status/:orderId", authenticateToken, requireRole(["customer"]), async (req: AuthRequest, res: Response) => {
  try {
    const { orderId } = req.params;
    const userId = req.user!.userId;

    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId },
    });

    if (!customerProfile) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    const payment = await prisma.payment.findFirst({
      where: {
        entityId: orderId,
        customerId: customerProfile.id,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!payment) {
      return res.status(404).json({ error: "Payment not found for this order" });
    }

    res.json({
      paymentId: payment.id,
      status: payment.status,
      amount: Number(payment.amount),
      currency: payment.currency,
      createdAt: payment.createdAt,
      capturedAt: payment.capturedAt,
    });
  } catch (error: any) {
    console.error("[StripeUS] Error fetching payment status:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

export default router;
