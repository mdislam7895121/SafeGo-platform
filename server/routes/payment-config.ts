import { Router } from "express";
import { PaymentConfigService } from "../services/PaymentConfigService";
import { PayoutConfigService } from "../services/PayoutConfigService";
import { sslcommerzPaymentProvider } from "../services/paymentProviders/sslcommerz";
import { paymentService } from "../services/paymentService";
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

/**
 * GET /api/config/payment/bd/status
 * Diagnostic endpoint to check Bangladesh online payments configuration
 */
router.get("/payment/bd/status", async (req, res) => {
  try {
    const isConfigured = sslcommerzPaymentProvider.isConfigured();
    const isSandbox = process.env.SSLCOMMERZ_SANDBOX_ENABLED_BD === "true";
    const featureEnabled = process.env.FEATURE_BD_ONLINE_PAYMENTS_ENABLED === "true";
    
    const config = {
      featureEnabled,
      sslcommerzConfigured: isConfigured,
      sandboxMode: isSandbox,
      storeIdPresent: !!(process.env.SSLCOMMERZ_STORE_ID_BD || process.env.SSLCOMMERZ_SANDBOX_STORE_ID_BD),
      passwordPresent: !!(process.env.SSLCOMMERZ_STORE_PASSWORD_BD || process.env.SSLCOMMERZ_SANDBOX_PASSWORD_BD),
      callbackUrls: {
        success: "/api/payments/sslcommerz/success",
        fail: "/api/payments/sslcommerz/fail",
        cancel: "/api/payments/sslcommerz/cancel",
        ipn: "/api/payments/sslcommerz/ipn",
      },
      status: isConfigured ? "READY" : "NOT_CONFIGURED",
    };
    
    console.log("[SSLCommerz] Diagnostic check:", config);
    
    res.json(config);
  } catch (error: any) {
    console.error("Error checking BD payment status:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * POST /api/config/payment/bd/test
 * Test endpoint to create a mock SSLCOMMERZ payment session (for sandbox testing)
 * This directly tests the SSLCOMMERZ provider without database dependencies
 */
router.post("/payment/bd/test", async (req, res) => {
  try {
    const { amount = 100, customerName = "Test User", customerEmail = "test@safego.app", customerPhone = "01700000000" } = req.body;
    
    if (process.env.SSLCOMMERZ_SANDBOX_ENABLED_BD !== "true") {
      return res.status(403).json({ 
        error: "Test endpoint only available in sandbox mode",
        sandboxEnabled: false
      });
    }
    
    if (!sslcommerzPaymentProvider.isConfigured()) {
      return res.status(500).json({
        error: "SSLCOMMERZ is not configured properly",
        configured: false
      });
    }
    
    const testEntityId = `test_${Date.now()}`;
    
    console.log("[SSLCommerz TEST] Creating test payment session:", { amount, customerName, customerEmail });
    
    const result = await sslcommerzPaymentProvider.createPaymentIntent({
      customerId: "test-customer-id",
      serviceType: "food",
      entityId: testEntityId,
      amount,
      currency: "BDT",
      countryCode: "BD",
      idempotencyKey: `test_${testEntityId}`,
      metadata: {
        customerName,
        customerEmail,
        customerPhone,
        customerAddress: "Dhaka, Bangladesh",
        customerCity: "Dhaka",
        isTest: true,
      },
    });
    
    console.log("[SSLCommerz TEST] Payment session result:", result);
    
    res.json({
      success: result.success,
      transactionId: result.providerPaymentId,
      redirectUrl: result.clientSecret,
      status: result.status,
      error: result.error,
      errorCode: result.errorCode,
      testEntityId,
      message: result.success 
        ? "Redirect user to the redirectUrl to complete payment in SSLCOMMERZ sandbox" 
        : "Failed to create SSLCOMMERZ payment session",
    });
  } catch (error: any) {
    console.error("[SSLCommerz TEST] Error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

export default router;
