import { Router, Request, Response } from "express";
import { PaymentProvider } from "@prisma/client";
import { paymentService } from "../services/paymentService";

const router = Router();

router.post("/stripe", async (req: Request, res: Response) => {
  try {
    const signature = req.headers["stripe-signature"] as string;
    
    const rawBody = (req as any).rawBody;
    if (!rawBody) {
      return res.status(400).json({ error: "Missing webhook payload (raw body required for Stripe signature verification)" });
    }
    
    const rawBodyString = Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : String(rawBody);
    
    const result = await paymentService.handleWebhook(
      PaymentProvider.stripe,
      rawBodyString,
      signature
    );
    
    if (!result.success) {
      console.error("[PaymentWebhook] Stripe webhook error:", result.message);
      return res.status(400).json({ error: result.message });
    }
    
    res.json({ received: true });
  } catch (error: any) {
    console.error("[PaymentWebhook] Error processing Stripe webhook:", error);
    res.status(500).json({ error: error.message });
  }
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

export default router;
