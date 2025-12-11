import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth";
import { z } from "zod";
import { PaymentOptionsService } from "../services/PaymentOptionsService";
import { paymentService } from "../services/paymentService";

const router = Router();

router.use(authenticateToken);
router.use(requireRole(["customer"]));

const addPaymentMethodSchema = z.object({
  methodCode: z.string().min(1),
  provider: z.string().min(1),
  providerToken: z.string().optional(),
  label: z.string().optional(),
  setAsDefault: z.boolean().optional().default(false),
});

router.get("/options", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const serviceType = (req.query.service as string) || "GLOBAL";

    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId },
    });

    if (!customerProfile) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    const options = await PaymentOptionsService.getAvailableMethodsForCustomer(
      customerProfile.id,
      serviceType
    );

    res.json(options);
  } catch (error: any) {
    console.error("[CustomerPayment] Error fetching payment options:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

router.get("/methods", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId },
      include: {
        user: { select: { countryCode: true } },
        paymentMethods: {
          where: { status: "active" },
          orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
        },
      },
    });

    if (!customerProfile) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    const methods = customerProfile.paymentMethods.map((pm) => ({
      id: pm.id,
      methodCode: pm.providerType === "mobile_wallet" ? (pm.walletBrand || "mobile_wallet") : "stripe_card",
      provider: pm.provider,
      label: pm.billingName || `${pm.brand || "Card"} ending in ${pm.last4}`,
      maskedDetails: pm.providerType === "mobile_wallet"
        ? (pm.walletPhoneMasked || "••••")
        : `•••• ${pm.last4}`,
      isDefault: pm.isDefault,
      brand: pm.brand,
      last4: pm.last4,
      expMonth: pm.expMonth,
      expYear: pm.expYear,
      providerType: pm.providerType || "card",
      walletBrand: pm.walletBrand,
      createdAt: pm.createdAt,
    }));

    res.json({
      countryCode: customerProfile.user.countryCode,
      methods,
    });
  } catch (error: any) {
    console.error("[CustomerPayment] Error fetching saved methods:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

router.post("/methods", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const body = addPaymentMethodSchema.parse(req.body);

    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId },
      include: {
        user: { select: { countryCode: true, email: true } },
      },
    });

    if (!customerProfile) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    const countryCode = customerProfile.user.countryCode || "US";
    const isValid = await PaymentOptionsService.validateMethodForCountry(
      body.methodCode,
      countryCode
    );

    if (!isValid) {
      return res.status(400).json({
        error: `Payment method ${body.methodCode} is not available in your country`,
      });
    }

    if (body.methodCode === "cash") {
      return res.status(400).json({
        error: "Cash payments do not need to be saved as a payment method",
      });
    }

    let paymentMethod;

    if (body.provider === "stripe" && body.providerToken) {
      const existingMethods = await prisma.paymentMethod.count({
        where: { customerId: customerProfile.id, status: "active" },
      });

      const isFirstMethod = existingMethods === 0;
      const shouldBeDefault = body.setAsDefault || isFirstMethod;

      if (shouldBeDefault) {
        await prisma.paymentMethod.updateMany({
          where: { customerId: customerProfile.id },
          data: { isDefault: false },
        });
      }

      paymentMethod = await prisma.paymentMethod.create({
        data: {
          customerId: customerProfile.id,
          provider: body.provider,
          providerMethodId: body.providerToken,
          brand: "Card",
          last4: "****",
          isDefault: shouldBeDefault,
          status: "active",
          type: "card",
          providerType: "card",
          billingName: body.label,
        },
      });
    } else if (["bkash", "nagad", "rocket", "upay"].includes(body.provider)) {
      const existingMethods = await prisma.paymentMethod.count({
        where: { customerId: customerProfile.id, status: "active" },
      });

      const isFirstMethod = existingMethods === 0;
      const shouldBeDefault = body.setAsDefault || isFirstMethod;

      if (shouldBeDefault) {
        await prisma.paymentMethod.updateMany({
          where: { customerId: customerProfile.id },
          data: { isDefault: false },
        });
      }

      paymentMethod = await prisma.paymentMethod.create({
        data: {
          customerId: customerProfile.id,
          provider: body.provider,
          providerMethodId: body.providerToken || `${body.provider}_pending`,
          brand: body.provider.charAt(0).toUpperCase() + body.provider.slice(1),
          last4: "****",
          isDefault: shouldBeDefault,
          status: "active",
          type: "mobile_money",
          providerType: "mobile_wallet",
          walletBrand: body.provider,
          billingName: body.label,
          walletVerified: false,
        },
      });
    } else {
      return res.status(400).json({
        error: `Unsupported provider: ${body.provider}`,
      });
    }

    res.status(201).json({
      id: paymentMethod.id,
      methodCode: paymentMethod.providerType === "mobile_wallet"
        ? paymentMethod.walletBrand
        : "stripe_card",
      provider: paymentMethod.provider,
      label: paymentMethod.billingName || `${paymentMethod.brand} ending in ${paymentMethod.last4}`,
      maskedDetails: `•••• ${paymentMethod.last4}`,
      isDefault: paymentMethod.isDefault,
      createdAt: paymentMethod.createdAt,
    });
  } catch (error: any) {
    console.error("[CustomerPayment] Error adding payment method:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Invalid request data", details: error.errors });
    }
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

router.patch("/methods/:id/set-default", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId },
    });

    if (!customerProfile) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    const paymentMethod = await prisma.paymentMethod.findFirst({
      where: {
        id,
        customerId: customerProfile.id,
        status: "active",
      },
    });

    if (!paymentMethod) {
      return res.status(404).json({ error: "Payment method not found" });
    }

    await prisma.$transaction([
      prisma.paymentMethod.updateMany({
        where: { customerId: customerProfile.id },
        data: { isDefault: false },
      }),
      prisma.paymentMethod.update({
        where: { id },
        data: { isDefault: true },
      }),
    ]);

    res.json({
      success: true,
      message: "Default payment method updated",
    });
  } catch (error: any) {
    console.error("[CustomerPayment] Error setting default method:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

router.delete("/methods/:id", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId },
    });

    if (!customerProfile) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    const paymentMethod = await prisma.paymentMethod.findFirst({
      where: {
        id,
        customerId: customerProfile.id,
      },
    });

    if (!paymentMethod) {
      return res.status(404).json({ error: "Payment method not found" });
    }

    const wasDefault = paymentMethod.isDefault;

    await prisma.paymentMethod.update({
      where: { id },
      data: { status: "inactive" },
    });

    if (wasDefault) {
      const nextMethod = await prisma.paymentMethod.findFirst({
        where: {
          customerId: customerProfile.id,
          status: "active",
        },
        orderBy: { createdAt: "desc" },
      });

      if (nextMethod) {
        await prisma.paymentMethod.update({
          where: { id: nextMethod.id },
          data: { isDefault: true },
        });
      }
    }

    res.json({
      success: true,
      message: "Payment method removed",
    });
  } catch (error: any) {
    console.error("[CustomerPayment] Error removing payment method:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

export default router;
