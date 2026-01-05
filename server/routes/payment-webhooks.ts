import { Router, Request, Response } from "express";
import { PaymentProvider } from "@prisma/client";
import { paymentService } from "../services/paymentService";
import { recordStripeEventOnce, markEventProcessed } from "../services/stripeWebhookDedup";

const router = Router();

async function handleStripeWithDedup(
  req: Request,
  res: Response,
  rawBodyString: string,
  signature: string,
  source: string
) {
  let eventId: string | undefined;
  let eventType: string | undefined;
  let dedupEventId: string | undefined;

  try {
    const parsedBody = JSON.parse(rawBodyString);
    eventId = parsedBody.id;
    eventType = parsedBody.type;
  } catch {
    console.error(`[${source}] Failed to parse webhook body for dedup check`);
    return res.status(400).json({ error: "Invalid JSON payload" });
  }

  if (!eventId || !eventType) {
    console.error(`[${source}] Missing event id or type in webhook payload`);
    return res.status(400).json({ error: "Missing event id or type" });
  }

  const dedupResult = await recordStripeEventOnce(eventId, eventType);

  if (dedupResult.isDuplicate) {
    return res.status(200).json({ received: true, duplicate: true });
  }

  dedupEventId = dedupResult.eventId;

  try {
    const result = await paymentService.handleWebhook(
      PaymentProvider.stripe,
      rawBodyString,
      signature
    );

    if (!result.success) {
      console.error(`[${source}] Stripe webhook error:`, result.message);
      if (dedupEventId) {
        await markEventProcessed(dedupEventId, false, result.message);
      }
      return res.status(400).json({ error: result.message });
    }

    if (dedupEventId) {
      await markEventProcessed(dedupEventId, true);
    }

    res.json({ received: true });
  } catch (error: any) {
    console.error(`[${source}] Error processing webhook:`, error);
    if (dedupEventId) {
      await markEventProcessed(dedupEventId, false, error.message);
    }
    res.status(500).json({ error: error.message });
  }
}

router.post("/stripe", async (req: Request, res: Response) => {
  const signature = req.headers["stripe-signature"] as string;

  const rawBody = (req as any).rawBody;
  if (!rawBody) {
    return res.status(400).json({ error: "Missing webhook payload (raw body required for Stripe signature verification)" });
  }

  const rawBodyString = Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : String(rawBody);

  await handleStripeWithDedup(req, res, rawBodyString, signature, "PaymentWebhook/Stripe");
});

router.post("/mock", async (req: Request, res: Response) => {
  try {
    const payload = req.body;

    if (!payload) {
      return res.status(400).json({ error: "Missing webhook payload" });
    }

    const result = await paymentService.handleWebhook(
      PaymentProvider.mock,
      JSON.stringify(payload)
    );

    if (!result.success) {
      console.error("[PaymentWebhook] Mock webhook error:", result.message);
      return res.status(400).json({ error: result.message });
    }

    res.json({ received: true, message: result.message });
  } catch (error: any) {
    console.error("[PaymentWebhook] Error processing mock webhook:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/bkash", async (req: Request, res: Response) => {
  try {
    const payload = req.body;

    const result = await paymentService.handleWebhook(
      PaymentProvider.bkash,
      JSON.stringify(payload)
    );

    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    res.json({ received: true });
  } catch (error: any) {
    console.error("[PaymentWebhook] Error processing bKash webhook:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/sslcommerz/ipn", async (req: Request, res: Response) => {
  try {
    console.log("[SSLCommerz IPN] Received callback:", JSON.stringify(req.body, null, 2));
    const payload = new URLSearchParams(req.body).toString();

    const result = await paymentService.handleWebhook(
      PaymentProvider.sslcommerz,
      payload
    );

    console.log("[SSLCommerz IPN] Processing result:", result);

    if (!result.success) {
      console.error("[PaymentWebhook] SSLCOMMERZ IPN error:", result.message);
      return res.status(400).json({ error: result.message });
    }

    res.json({ received: true });
  } catch (error: any) {
    console.error("[PaymentWebhook] Error processing SSLCOMMERZ IPN:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/sslcommerz/success", async (req: Request, res: Response) => {
  try {
    console.log("[SSLCommerz SUCCESS] Received callback:", JSON.stringify(req.body, null, 2));
    const payload = new URLSearchParams(req.body).toString();

    const result = await paymentService.handleWebhook(
      PaymentProvider.sslcommerz,
      payload
    );

    console.log("[SSLCommerz SUCCESS] Processing result:", result);

    const redirectUrl = result.success 
      ? "/payment/success"
      : "/payment/failed";

    res.redirect(redirectUrl);
  } catch (error: any) {
    console.error("[PaymentWebhook] Error processing SSLCOMMERZ success:", error);
    res.redirect("/payment/failed");
  }
});

router.post("/sslcommerz/fail", async (req: Request, res: Response) => {
  try {
    console.log("[SSLCommerz FAIL] Received callback:", JSON.stringify(req.body, null, 2));
    const payload = new URLSearchParams(req.body).toString();

    const result = await paymentService.handleWebhook(
      PaymentProvider.sslcommerz,
      payload
    );

    console.log("[SSLCommerz FAIL] Processing result:", result);

    res.redirect("/payment/failed");
  } catch (error: any) {
    console.error("[PaymentWebhook] Error processing SSLCOMMERZ fail:", error);
    res.redirect("/payment/failed");
  }
});

router.post("/sslcommerz/cancel", async (req: Request, res: Response) => {
  try {
    console.log("[SSLCommerz CANCEL] Received callback:", JSON.stringify(req.body, null, 2));
    const payload = new URLSearchParams(req.body).toString();

    const result = await paymentService.handleWebhook(
      PaymentProvider.sslcommerz,
      payload
    );

    console.log("[SSLCommerz CANCEL] Processing result:", result);

    res.redirect("/payment/cancelled");
  } catch (error: any) {
    console.error("[PaymentWebhook] Error processing SSLCOMMERZ cancel:", error);
    res.redirect("/payment/cancelled");
  }
});

router.post("/stripe/us", async (req: Request, res: Response) => {
  const featureEnabled = process.env.FEATURE_US_ONLINE_PAYMENTS_ENABLED === "true";
  if (!featureEnabled) {
    console.warn("[PaymentWebhook] US Stripe webhook received but feature is disabled");
    return res.status(200).json({ received: true, message: "Feature disabled" });
  }

  const signature = req.headers["stripe-signature"] as string;

  const rawBody = (req as any).rawBody;
  if (!rawBody) {
    console.error("[PaymentWebhook] Missing raw body for Stripe US webhook");
    return res.status(400).json({ error: "Missing webhook payload (raw body required for Stripe signature verification)" });
  }

  const rawBodyString = Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : String(rawBody);

  await handleStripeWithDedup(req, res, rawBodyString, signature, "StripeUS Webhook");
});

export default router;
