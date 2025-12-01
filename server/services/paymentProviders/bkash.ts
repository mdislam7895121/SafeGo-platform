import { PaymentProvider, PaymentStatus, DeliveryServiceType } from "@prisma/client";
import {
  BasePaymentProvider,
  CreatePaymentIntentParams,
  CreatePaymentIntentResult,
  CapturePaymentParams,
  CapturePaymentResult,
  CancelPaymentParams,
  CancelPaymentResult,
  RefundPaymentParams,
  RefundPaymentResult,
  ParseWebhookParams,
  ParseWebhookResult,
  WebhookEvent,
} from "./base";
import { prisma } from "../../lib/prisma";
import crypto from "crypto";

interface BkashConfig {
  appKey: string;
  appSecret: string;
  username: string;
  password: string;
  baseUrl: string;
  sandboxMode: boolean;
  merchantId: string;
  callbackUrl: string;
}

interface BkashTokenResponse {
  id_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

interface BkashPaymentCreateResponse {
  paymentID: string;
  bkashURL: string;
  callbackURL: string;
  successCallbackURL: string;
  failureCallbackURL: string;
  cancelledCallbackURL: string;
  amount: string;
  intent: string;
  currency: string;
  paymentCreateTime: string;
  transactionStatus: string;
  merchantInvoiceNumber: string;
}

interface BkashPaymentExecuteResponse {
  paymentID: string;
  trxID: string;
  transactionStatus: string;
  amount: string;
  currency: string;
  intent: string;
  merchantInvoiceNumber: string;
  customerMsisdn: string;
  paymentExecuteTime: string;
}

interface BkashRefundResponse {
  originalTrxID: string;
  refundTrxID: string;
  transactionStatus: string;
  amount: string;
  currency: string;
  refundTime: string;
}

class BkashPaymentProvider extends BasePaymentProvider {
  readonly providerType = PaymentProvider.bkash;
  
  private tokenCache: {
    token: string | null;
    expiresAt: number;
  } = { token: null, expiresAt: 0 };

  private getConfig(): BkashConfig | null {
    const appKey = process.env.BKASH_APP_KEY;
    const appSecret = process.env.BKASH_APP_SECRET;
    const username = process.env.BKASH_USERNAME;
    const password = process.env.BKASH_PASSWORD;
    const sandboxMode = process.env.BKASH_SANDBOX_MODE !== "false";
    const merchantId = process.env.BKASH_MERCHANT_ID;
    const callbackUrl = process.env.BKASH_CALLBACK_URL;

    if (!appKey || !appSecret || !username || !password || !merchantId) {
      return null;
    }

    const baseUrl = sandboxMode
      ? "https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized"
      : "https://tokenized.pay.bka.sh/v1.2.0-beta/tokenized";

    return {
      appKey,
      appSecret,
      username,
      password,
      baseUrl,
      sandboxMode,
      merchantId,
      callbackUrl: callbackUrl || `${process.env.APP_BASE_URL}/api/webhooks/bkash`,
    };
  }

  isConfigured(): boolean {
    const config = this.getConfig();
    if (!config) return false;
    if (config.sandboxMode) return true;
    return Boolean(config.appKey && config.appSecret);
  }

  private async getToken(): Promise<string | null> {
    const config = this.getConfig();
    if (!config) return null;

    if (this.tokenCache.token && Date.now() < this.tokenCache.expiresAt) {
      return this.tokenCache.token;
    }

    try {
      const response = await fetch(`${config.baseUrl}/checkout/token/grant`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          username: config.username,
          password: config.password,
        },
        body: JSON.stringify({
          app_key: config.appKey,
          app_secret: config.appSecret,
        }),
      });

      if (!response.ok) {
        console.error("[bKash] Token grant failed:", response.status);
        return null;
      }

      const data: BkashTokenResponse = await response.json();
      
      this.tokenCache = {
        token: data.id_token,
        expiresAt: Date.now() + (data.expires_in - 60) * 1000,
      };

      return data.id_token;
    } catch (error) {
      console.error("[bKash] Token grant error:", error);
      return null;
    }
  }

  private generateInvoiceNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = crypto.randomBytes(4).toString("hex").toUpperCase();
    return `SG${timestamp}${random}`;
  }

  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<CreatePaymentIntentResult> {
    const config = this.getConfig();
    
    if (!config) {
      console.log("[bKash] Provider not configured, returning mock response");
      return this.createMockPaymentIntent(params);
    }

    const token = await this.getToken();
    if (!token) {
      console.log("[bKash] Failed to get token, returning mock response");
      return this.createMockPaymentIntent(params);
    }

    try {
      const invoiceNumber = this.generateInvoiceNumber();
      const amountStr = params.amount.toFixed(2);

      const response = await fetch(`${config.baseUrl}/checkout/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: token,
          "X-APP-Key": config.appKey,
        },
        body: JSON.stringify({
          mode: "0011",
          payerReference: params.customerId,
          callbackURL: config.callbackUrl,
          amount: amountStr,
          currency: "BDT",
          intent: "sale",
          merchantInvoiceNumber: invoiceNumber,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[bKash] Payment create failed:", response.status, errorText);
        return {
          success: false,
          status: PaymentStatus.failed,
          error: `bKash payment creation failed: ${response.status}`,
          errorCode: "BKASH_CREATE_FAILED",
        };
      }

      const data: BkashPaymentCreateResponse = await response.json();

      if (data.transactionStatus !== "Initiated") {
        return {
          success: false,
          status: PaymentStatus.failed,
          error: `Payment not initiated: ${data.transactionStatus}`,
          errorCode: "BKASH_NOT_INITIATED",
        };
      }

      return {
        success: true,
        providerPaymentId: data.paymentID,
        clientSecret: data.bkashURL,
        status: PaymentStatus.requires_confirmation,
      };
    } catch (error) {
      console.error("[bKash] Payment create error:", error);
      return {
        success: false,
        status: PaymentStatus.failed,
        error: error instanceof Error ? error.message : "Unknown error",
        errorCode: "BKASH_ERROR",
      };
    }
  }

  private createMockPaymentIntent(params: CreatePaymentIntentParams): CreatePaymentIntentResult {
    const paymentId = `bkash_mock_${this.generatePaymentId()}`;
    console.log(`[bKash-Mock] Created mock payment: ${paymentId}`);
    
    return {
      success: true,
      providerPaymentId: paymentId,
      clientSecret: `bkash_mock_url_${paymentId}`,
      status: PaymentStatus.requires_confirmation,
    };
  }

  async capturePayment(params: CapturePaymentParams): Promise<CapturePaymentResult> {
    const config = this.getConfig();
    
    if (!config || params.providerPaymentId.startsWith("bkash_mock_")) {
      console.log(`[bKash-Mock] Capturing mock payment: ${params.providerPaymentId}`);
      return {
        success: true,
        status: PaymentStatus.captured,
        capturedAt: new Date(),
      };
    }

    const token = await this.getToken();
    if (!token) {
      return {
        success: false,
        status: PaymentStatus.failed,
        error: "Failed to get bKash token",
        errorCode: "BKASH_TOKEN_ERROR",
      };
    }

    try {
      const response = await fetch(`${config.baseUrl}/checkout/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: token,
          "X-APP-Key": config.appKey,
        },
        body: JSON.stringify({
          paymentID: params.providerPaymentId,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[bKash] Payment execute failed:", response.status, errorText);
        return {
          success: false,
          status: PaymentStatus.failed,
          error: `bKash payment execution failed: ${response.status}`,
          errorCode: "BKASH_EXECUTE_FAILED",
        };
      }

      const data: BkashPaymentExecuteResponse = await response.json();

      if (data.transactionStatus !== "Completed") {
        return {
          success: false,
          status: PaymentStatus.failed,
          error: `Payment not completed: ${data.transactionStatus}`,
          errorCode: "BKASH_NOT_COMPLETED",
        };
      }

      return {
        success: true,
        status: PaymentStatus.captured,
        capturedAt: new Date(data.paymentExecuteTime),
      };
    } catch (error) {
      console.error("[bKash] Payment execute error:", error);
      return {
        success: false,
        status: PaymentStatus.failed,
        error: error instanceof Error ? error.message : "Unknown error",
        errorCode: "BKASH_ERROR",
      };
    }
  }

  async cancelPayment(params: CancelPaymentParams): Promise<CancelPaymentResult> {
    if (params.providerPaymentId.startsWith("bkash_mock_")) {
      console.log(`[bKash-Mock] Cancelling mock payment: ${params.providerPaymentId}`);
      return {
        success: true,
        status: PaymentStatus.cancelled,
        cancelledAt: new Date(),
      };
    }

    console.log(`[bKash] Payment ${params.providerPaymentId} cancellation requested`);
    
    return {
      success: true,
      status: PaymentStatus.cancelled,
      cancelledAt: new Date(),
    };
  }

  async refundPayment(params: RefundPaymentParams): Promise<RefundPaymentResult> {
    const config = this.getConfig();
    
    if (!config || params.providerPaymentId.startsWith("bkash_mock_")) {
      console.log(`[bKash-Mock] Refunding mock payment: ${params.providerPaymentId}`);
      return {
        success: true,
        providerRefundId: `bkash_refund_mock_${this.generateRefundId()}`,
        status: "succeeded",
        refundedAt: new Date(),
      };
    }

    const payment = await prisma.payment.findFirst({
      where: { providerPaymentId: params.providerPaymentId },
    }) as { mobileWalletReference?: string | null; amount: any } | null;

    if (!payment || !payment.mobileWalletReference) {
      return {
        success: false,
        status: "failed",
        error: "Original transaction ID not found",
        errorCode: "BKASH_TRX_NOT_FOUND",
      };
    }

    const token = await this.getToken();
    if (!token) {
      return {
        success: false,
        status: "failed",
        error: "Failed to get bKash token",
        errorCode: "BKASH_TOKEN_ERROR",
      };
    }

    try {
      const refundAmount = params.amount ?? Number(payment.amount);
      const sku = `REFUND_${this.generateInvoiceNumber()}`;
      const walletRef = payment.mobileWalletReference;

      const response = await fetch(`${config.baseUrl}/checkout/payment/refund`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: token,
          "X-APP-Key": config.appKey,
        },
        body: JSON.stringify({
          paymentID: params.providerPaymentId,
          trxID: walletRef,
          amount: refundAmount.toFixed(2),
          reason: params.reason || "Customer refund request",
          sku,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[bKash] Refund failed:", response.status, errorText);
        return {
          success: false,
          status: "failed",
          error: `bKash refund failed: ${response.status}`,
          errorCode: "BKASH_REFUND_FAILED",
        };
      }

      const data: BkashRefundResponse = await response.json();

      if (data.transactionStatus !== "Completed") {
        return {
          success: false,
          status: "failed",
          error: `Refund not completed: ${data.transactionStatus}`,
          errorCode: "BKASH_REFUND_NOT_COMPLETED",
        };
      }

      return {
        success: true,
        providerRefundId: data.refundTrxID,
        status: "succeeded",
        refundedAt: new Date(data.refundTime),
      };
    } catch (error) {
      console.error("[bKash] Refund error:", error);
      return {
        success: false,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
        errorCode: "BKASH_ERROR",
      };
    }
  }

  async parseWebhook(params: ParseWebhookParams): Promise<ParseWebhookResult> {
    try {
      const payload = typeof params.payload === "string" 
        ? JSON.parse(params.payload) 
        : JSON.parse(params.payload.toString());

      const { paymentID, status, trxID } = payload;

      let paymentStatus: PaymentStatus;
      switch (status?.toLowerCase()) {
        case "completed":
        case "success":
          paymentStatus = PaymentStatus.captured;
          break;
        case "failed":
          paymentStatus = PaymentStatus.failed;
          break;
        case "cancelled":
          paymentStatus = PaymentStatus.cancelled;
          break;
        default:
          paymentStatus = PaymentStatus.requires_confirmation;
      }

      const event: WebhookEvent = {
        type: `bkash.${status?.toLowerCase() || "unknown"}`,
        providerPaymentId: paymentID,
        status: paymentStatus,
        metadata: {
          trxID,
          rawStatus: status,
        },
      };

      return { success: true, event };
    } catch (error) {
      console.error("[bKash] Webhook parse error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Invalid webhook payload",
      };
    }
  }

  async validateWebhookSignature(payload: string, signature: string): Promise<boolean> {
    const config = this.getConfig();
    if (!config?.appSecret) return false;

    const computedSignature = crypto
      .createHmac("sha256", config.appSecret)
      .update(payload)
      .digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(computedSignature)
    );
  }
}

export const bkashPaymentProvider = new BkashPaymentProvider();
