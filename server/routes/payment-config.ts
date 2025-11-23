import { Router } from "express";
import { PaymentConfigService } from "../services/PaymentConfigService";
import { PayoutConfigService } from "../services/PayoutConfigService";
import type { CountryCode, ServiceType, ActorType, KycLevel } from "../../shared/types";

const router = Router();

/**
 * GET /api/config/payment/customer
 * Get enabled customer payment methods for a country and service type
 * Query params: country (BD, US), service (FOOD, RIDE, PARCEL), kycLevel (optional)
 */
router.get("/payment/customer", async (req, res) => {
  try {
    const { country, service, kycLevel } = req.query;

    if (!country || !service) {
      return res.status(400).json({
        error: "Missing required parameters: country and service",
      });
    }

    const paymentMethods = await PaymentConfigService.getCustomerPaymentMethods({
      countryCode: country as CountryCode,
      serviceType: service as ServiceType,
      kycLevel: kycLevel as KycLevel | undefined,
    });

    res.json({
      country,
      service,
      paymentMethods,
    });
  } catch (error: any) {
    console.error("Error fetching customer payment methods:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * GET /api/config/payout/restaurant
 * Get enabled payout rails for restaurants in a country
 * Query params: country (BD, US), kycLevel (optional)
 */
router.get("/payout/restaurant", async (req, res) => {
  try {
    const { country, kycLevel } = req.query;

    if (!country) {
      return res.status(400).json({
        error: "Missing required parameter: country",
      });
    }

    const payoutRails = await PayoutConfigService.getPayoutRails({
      countryCode: country as CountryCode,
      actorType: "RESTAURANT" as ActorType,
      kycLevel: kycLevel as KycLevel | undefined,
    });

    res.json({
      country,
      actorType: "RESTAURANT",
      payoutRails,
    });
  } catch (error: any) {
    console.error("Error fetching restaurant payout rails:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * GET /api/config/payout/driver
 * Get enabled payout rails for drivers in a country
 * Query params: country (BD, US), kycLevel (optional)
 */
router.get("/payout/driver", async (req, res) => {
  try {
    const { country, kycLevel } = req.query;

    if (!country) {
      return res.status(400).json({
        error: "Missing required parameter: country",
      });
    }

    const payoutRails = await PayoutConfigService.getPayoutRails({
      countryCode: country as CountryCode,
      actorType: "DRIVER" as ActorType,
      kycLevel: kycLevel as KycLevel | undefined,
    });

    res.json({
      country,
      actorType: "DRIVER",
      payoutRails,
    });
  } catch (error: any) {
    console.error("Error fetching driver payout rails:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

export default router;
