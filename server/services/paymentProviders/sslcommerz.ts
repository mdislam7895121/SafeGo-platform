import { PaymentProvider, PaymentStatus } from "@prisma/client";
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
} from "./base";
import crypto from "crypto";

interface SSLCommerzConfig {
  storeId: string;
  storePassword: string;
  isSandbox: boolean;
}

interface SSLCommerzSessionResponse {
  status: string;
  sessionkey?: string;
  GatewayPageURL?: string;
  faession?: string;
  storeBanner?: string;
  storeLogo?: string;
  desc?: string[];
  is_direct_pay_enable?: string;
  redirectGatewayURL?: string;
  redirectGatewayURLFailed?: string;
  GatewayPageURLFailed?: string;
  APIConnect?: string;
  validationId?: string;
}

interface SSLCommerzValidationResponse {
  status: string;
  tran_date?: string;
  tran_id?: string;
  val_id?: string;
  amount?: string;
  store_amount?: string;
  currency?: string;
  bank_tran_id?: string;
  card_type?: string;
  card_no?: string;
  card_issuer?: string;
  card_brand?: string;
  card_issuer_country?: string;
  card_issuer_country_code?: string;
  currency_type?: string;
  currency_amount?: string;
  verify_sign?: string;
  verify_key?: string;
  risk_level?: string;
  risk_title?: string;
}

interface SSLCommerzRefundResponse {
  APIConnect: string;
  bank_tran_id?: string;
  trans_id?: string;
  refund_ref_id?: string;
  status?: string;
  errorReason?: string;
}

class SSLCommerzPaymentProvider extends BasePaymentProvider {
  readonly providerType = PaymentProvider.sslcommerz;

  private getConfig(): SSLCommerzConfig | null {
    const isSandbox = process.env.SSLCOMMERZ_SANDBOX_ENABLED_BD === "true";
    
    const storeId = isSandbox
      ? process.env.SSLCOMMERZ_SANDBOX_STORE_ID_BD
      : process.env.SSLCOMMERZ_STORE_ID_BD;
    
    const storePassword = isSandbox
      ? process.env.SSLCOMMERZ_SANDBOX_PASSWORD_BD
      : process.env.SSLCOMMERZ_STORE_PASSWORD_BD;

    if (!storeId || !storePassword) {
      return null;
    }

    return { storeId, storePassword, isSandbox };
  }

  private getBaseUrl(): string {
    const config = this.getConfig();
    return config?.isSandbox
      ? "https://sandbox.sslcommerz.com"
      : "https://securepay.sslcommerz.com";
  }

  isConfigured(): boolean {
    const featureEnabled = process.env.FEATURE_BD_ONLINE_PAYMENTS_ENABLED === "true";
    const config = this.getConfig();
    return featureEnabled && config !== null;
  }

  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<CreatePaymentIntentResult> {
    const config = this.getConfig();
    
    if (!config) {
      return {
        success: false,
        status: PaymentStatus.failed,
        error: "SSLCOMMERZ not configured",
        errorCode: "provider_not_configured",
      };
    }

    try {
      const tranId = this.generatePaymentId();
      const baseUrl = this.getBaseUrl();
      
      const successUrl = `${process.env.APP_BASE_URL || ""}/api/payments/sslcommerz/success`;
      const failUrl = `${process.env.APP_BASE_URL || ""}/api/payments/sslcommerz/fail`;
      const cancelUrl = `${process.env.APP_BASE_URL || ""}/api/payments/sslcommerz/cancel`;
      const ipnUrl = `${process.env.APP_BASE_URL || ""}/api/payments/sslcommerz/ipn`;

      const requestData = new URLSearchParams({
        store_id: config.storeId,
        store_passwd: config.storePassword,
        total_amount: params.amount.toString(),
        currency: params.currency || "BDT",
        tran_id: tranId,
        success_url: successUrl,
        fail_url: failUrl,
        cancel_url: cancelUrl,
        ipn_url: ipnUrl,
        cus_name: params.metadata?.customerName || "Customer",
        cus_email: params.metadata?.customerEmail || "customer@safego.app",
        cus_phone: params.metadata?.customerPhone || "01700000000",
        cus_add1: params.metadata?.customerAddress || "Dhaka",
        cus_city: params.metadata?.customerCity || "Dhaka",
        cus_country: "Bangladesh",
        shipping_method: "NO",
        product_name: `SafeGo ${params.serviceType} Payment`,
        product_category: params.serviceType,
        product_profile: "general",
        value_a: params.entityId,
        value_b: params.serviceType,
        value_c: params.customerId,
        value_d: params.idempotencyKey || "",
      });

      const response = await fetch(`${baseUrl}/gwprocess/v4/api.php`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: requestData.toString(),
      });

      const result: SSLCommerzSessionResponse = await response.json();

      if (result.status === "SUCCESS" && result.GatewayPageURL) {
        console.log(`[SSLCommerz] Session created: ${tranId}`);
        return {
          success: true,
          providerPaymentId: tranId,
          clientSecret: result.GatewayPageURL,
          status: PaymentStatus.requires_confirmation,
        };
      }

      console.error(`[SSLCommerz] Session creation failed:`, result.desc);
      return {
        success: false,
        status: PaymentStatus.failed,
        error: result.desc?.join(", ") || "Failed to create payment session",
        errorCode: "session_creation_failed",
      };
    } catch (error) {
      console.error(`[SSLCommerz] Error creating payment intent:`, error);
      return {
        success: false,
        status: PaymentStatus.failed,
        error: error instanceof Error ? error.message : "Unknown error",
        errorCode: "provider_error",
      };
    }
  }

  async capturePayment(params: CapturePaymentParams): Promise<CapturePaymentResult> {
    console.log(`[SSLCommerz] Capture not applicable - payments are captured automatically`);
    return {
      success: true,
      status: PaymentStatus.captured,
      capturedAt: new Date(),
    };
  }

  async cancelPayment(params: CancelPaymentParams): Promise<CancelPaymentResult> {
    console.log(`[SSLCommerz] Payment cancellation: ${params.providerPaymentId}`);
    return {
      success: true,
      status: PaymentStatus.cancelled,
      cancelledAt: new Date(),
    };
  }

  async refundPayment(params: RefundPaymentParams): Promise<RefundPaymentResult> {
    const config = this.getConfig();
    
    if (!config) {
      return {
        success: false,
        status: "failed",
        error: "SSLCOMMERZ not configured",
        errorCode: "provider_not_configured",
      };
    }

    try {
      const baseUrl = this.getBaseUrl();
      
      const requestData = new URLSearchParams({
        store_id: config.storeId,
        store_passwd: config.storePassword,
        bank_tran_id: params.providerPaymentId,
        refund_amount: params.amount?.toString() || "0",
        refund_remarks: params.reason || "Customer requested refund",
      });

      const response = await fetch(`${baseUrl}/validator/api/merchantTransIDvalidationAPI.php`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: requestData.toString(),
      });

      const result: SSLCommerzRefundResponse = await response.json();

      if (result.status === "success" || result.status === "VALID") {
        return {
          success: true,
          providerRefundId: result.refund_ref_id || this.generateRefundId(),
          status: "refunded",
          refundedAt: new Date(),
        };
      }

      return {
        success: false,
        status: "failed",
        error: result.errorReason || "Refund failed",
        errorCode: "refund_failed",
      };
    } catch (error) {
      console.error(`[SSLCommerz] Error processing refund:`, error);
      return {
        success: false,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
        errorCode: "provider_error",
      };
    }
  }

  async parseWebhook(params: ParseWebhookParams): Promise<ParseWebhookResult> {
    try {
      const payload = typeof params.payload === "string" 
        ? params.payload 
        : params.payload.toString();
      
      const data = new URLSearchParams(payload);
      
      const status = data.get("status");
      const tranId = data.get("tran_id");
      const valId = data.get("val_id");
      const amount = data.get("amount");
      const storeAmount = data.get("store_amount");
      const bankTranId = data.get("bank_tran_id");
      const cardType = data.get("card_type");
      const verifySign = data.get("verify_sign");
      const verifyKey = data.get("verify_key");
      const entityId = data.get("value_a");
      const serviceType = data.get("value_b");
      const customerId = data.get("value_c");
      
      if (verifySign && verifyKey) {
        const isValid = this.verifySignature(data, verifySign, verifyKey);
        if (!isValid) {
          console.warn(`[SSLCommerz] Invalid webhook signature for tran_id: ${tranId}`);
          return {
            success: false,
            error: "Invalid webhook signature",
          };
        }
      }

      let paymentStatus: PaymentStatus;
      let eventType: string;

      switch (status) {
        case "VALID":
        case "VALIDATED":
          paymentStatus = PaymentStatus.succeeded;
          eventType = "payment.succeeded";
          break;
        case "FAILED":
          paymentStatus = PaymentStatus.failed;
          eventType = "payment.failed";
          break;
        case "CANCELLED":
          paymentStatus = PaymentStatus.cancelled;
          eventType = "payment.cancelled";
          break;
        default:
          paymentStatus = PaymentStatus.processing;
          eventType = "payment.processing";
      }

      console.log(`[SSLCommerz] Webhook received: ${eventType} for ${tranId}`);

      return {
        success: true,
        event: {
          type: eventType,
          providerPaymentId: tranId || undefined,
          status: paymentStatus,
          metadata: {
            valId,
            amount,
            storeAmount,
            bankTranId,
            cardType,
            entityId,
            serviceType,
            customerId,
          },
        },
      };
    } catch (error) {
      console.error(`[SSLCommerz] Error parsing webhook:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private verifySignature(data: URLSearchParams, signature: string, keys: string): boolean {
    const config = this.getConfig();
    if (!config) return false;

    try {
      const keyArray = keys.split(",");
      const signatureData: Record<string, string> = {};
      
      for (const key of keyArray) {
        const value = data.get(key);
        if (value) {
          signatureData[key] = value;
        }
      }
      
      signatureData["store_passwd"] = crypto
        .createHash("md5")
        .update(config.storePassword)
        .digest("hex");

      const sortedKeys = Object.keys(signatureData).sort();
      const signString = sortedKeys
        .map((key) => `${key}=${signatureData[key]}`)
        .join("&");

      const calculatedSign = crypto
        .createHash("md5")
        .update(signString)
        .digest("hex");

      return calculatedSign === signature;
    } catch (error) {
      console.error(`[SSLCommerz] Signature verification error:`, error);
      return false;
    }
  }

  async validateTransaction(valId: string): Promise<SSLCommerzValidationResponse | null> {
    const config = this.getConfig();
    if (!config) return null;

    try {
      const baseUrl = this.getBaseUrl();
      const url = `${baseUrl}/validator/api/validationserverAPI.php?val_id=${valId}&store_id=${config.storeId}&store_passwd=${config.storePassword}&format=json`;

      const response = await fetch(url);
      const result: SSLCommerzValidationResponse = await response.json();

      return result;
    } catch (error) {
      console.error(`[SSLCommerz] Transaction validation error:`, error);
      return null;
    }
  }
}

export const sslcommerzPaymentProvider = new SSLCommerzPaymentProvider();
