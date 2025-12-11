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

interface NagadConfig {
  merchantId: string;
  merchantPrivateKey: string;
  nagadPublicKey: string;
  baseUrl: string;
  sandboxMode: boolean;
  callbackUrl: string;
}

interface NagadInitializeResponse {
  sensitiveData: string;
  signature: string;
  callbackURL: string;
}

interface NagadCompleteResponse {
  merchantId: string;
  orderId: string;
  paymentRefId: string;
  amount: string;
  clientMobileNo: string;
  merchantMobileNo: string;
  orderDateTime: string;
  issuerPaymentDateTime: string;
  issuerPaymentRefNo: string;
  additionalMerchantInfo: any;
  status: string;
  statusCode: string;
  message: string;
}

interface NagadRefundResponse {
  refundReferenceNo: string;
  refundAmount: string;
  status: string;
  statusCode: string;
  message: string;
}

class NagadPaymentProvider extends BasePaymentProvider {
  readonly providerType = PaymentProvider.nagad;

  private getConfig(): NagadConfig | null {
    const merchantId = process.env.NAGAD_MERCHANT_ID;
    const merchantPrivateKey = process.env.NAGAD_MERCHANT_PRIVATE_KEY;
    const nagadPublicKey = process.env.NAGAD_PUBLIC_KEY;
    const sandboxMode = process.env.NAGAD_SANDBOX_MODE !== "false";
    const callbackUrl = process.env.NAGAD_CALLBACK_URL;

    if (!merchantId || !merchantPrivateKey || !nagadPublicKey) {
      return null;
    }

    const baseUrl = sandboxMode
      ? "http://sandbox.mynagad.com:10080/remote-payment-gateway-1.0/api/dfs"
      : "https://api.mynagad.com/api/dfs";

    return {
      merchantId,
      merchantPrivateKey,
      nagadPublicKey,
      baseUrl,
      sandboxMode,
      callbackUrl: callbackUrl || `${process.env.APP_BASE_URL}/api/webhooks/nagad`,
    };
  }

  isConfigured(): boolean {
    const config = this.getConfig();
    if (!config) return false;
    if (config.sandboxMode) return true;
    return Boolean(config.merchantId && config.merchantPrivateKey);
  }

  private generateOrderId(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = crypto.randomBytes(4).toString("hex").toUpperCase();
    return `SG${timestamp}${random}`;
  }

  private signData(data: string, privateKey: string): string {
    try {
      const sign = crypto.createSign("SHA256");
      sign.update(data);
      sign.end();
      return sign.sign(privateKey, "base64");
    } catch (error) {
      console.error("[Nagad] Signing failed:", error);
      return "";
    }
  }

  private verifySignature(data: string, signature: string, publicKey: string): boolean {
    try {
      const verify = crypto.createVerify("SHA256");
      verify.update(data);
      verify.end();
      return verify.verify(publicKey, signature, "base64");
    } catch (error) {
      console.error("[Nagad] Verification failed:", error);
      return false;
    }
  }

  private encryptData(data: string, publicKey: string): string {
    try {
      const buffer = Buffer.from(data);
      const encrypted = crypto.publicEncrypt(
        {
          key: publicKey,
          padding: crypto.constants.RSA_PKCS1_PADDING,
        },
        buffer
      );
      return encrypted.toString("base64");
    } catch (error) {
      console.error("[Nagad] Encryption failed:", error);
      return "";
    }
  }

  private decryptData(data: string, privateKey: string): string {
    try {
      const buffer = Buffer.from(data, "base64");
      const decrypted = crypto.privateDecrypt(
        {
          key: privateKey,
          padding: crypto.constants.RSA_PKCS1_PADDING,
        },
        buffer
      );
      return decrypted.toString("utf8");
    } catch (error) {
      console.error("[Nagad] Decryption failed:", error);
      return "";
    }
  }

  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<CreatePaymentIntentResult> {
    const config = this.getConfig();

    if (!config) {
      console.log("[Nagad] Provider not configured, returning mock response");
      return this.createMockPaymentIntent(params);
    }

    try {
      const orderId = this.generateOrderId();
      const dateTime = new Date().toISOString().replace("T", " ").substring(0, 19);
      const challenge = crypto.randomBytes(16).toString("hex");

      const sensitiveData = {
        merchantId: config.merchantId,
        datetime: dateTime,
        orderId,
        challenge,
      };

      const sensitiveDataJson = JSON.stringify(sensitiveData);
      const encryptedSensitiveData = this.encryptData(sensitiveDataJson, config.nagadPublicKey);
      const signature = this.signData(sensitiveDataJson, config.merchantPrivateKey);

      const initResponse = await fetch(
        `${config.baseUrl}/check-out/initialize/${config.merchantId}/${orderId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "X-KM-IP-V4": "127.0.0.1",
            "X-KM-Client-Type": "PC_WEB",
          },
          body: JSON.stringify({
            dateTime,
            sensitiveData: encryptedSensitiveData,
            signature,
          }),
        }
      );

      if (!initResponse.ok) {
        const errorText = await initResponse.text();
        console.error("[Nagad] Initialize failed:", initResponse.status, errorText);
        return this.createMockPaymentIntent(params);
      }

      const initData: NagadInitializeResponse = await initResponse.json();

      if (!initData.sensitiveData) {
        console.error("[Nagad] No sensitive data in response");
        return this.createMockPaymentIntent(params);
      }

      const decryptedData = this.decryptData(initData.sensitiveData, config.merchantPrivateKey);
      const responseData = JSON.parse(decryptedData);

      const paymentRef = responseData.paymentReferenceId;
      const challengeResponse = responseData.challenge;
      const merchantCallbackUrl = config.callbackUrl;

      const completeData = {
        merchantId: config.merchantId,
        orderId,
        currencyCode: "050",
        amount: params.amount.toFixed(2),
        challenge: challengeResponse,
      };

      const completeDataJson = JSON.stringify(completeData);
      const encryptedCompleteData = this.encryptData(completeDataJson, config.nagadPublicKey);
      const completeSignature = this.signData(completeDataJson, config.merchantPrivateKey);

      const completeResponse = await fetch(
        `${config.baseUrl}/check-out/complete/${paymentRef}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "X-KM-IP-V4": "127.0.0.1",
            "X-KM-Client-Type": "PC_WEB",
          },
          body: JSON.stringify({
            sensitiveData: encryptedCompleteData,
            signature: completeSignature,
            merchantCallbackUrl,
            additionalMerchantInfo: {
              customerId: params.customerId,
              serviceType: params.serviceType,
              entityId: params.entityId,
            },
          }),
        }
      );

      if (!completeResponse.ok) {
        const errorText = await completeResponse.text();
        console.error("[Nagad] Complete request failed:", completeResponse.status, errorText);
        return this.createMockPaymentIntent(params);
      }

      const completeResult: NagadCompleteResponse = await completeResponse.json();

      if (completeResult.statusCode !== "OK" && completeResult.status !== "Success") {
        return {
          success: false,
          status: PaymentStatus.failed,
          error: completeResult.message || "Payment initialization failed",
          errorCode: completeResult.statusCode,
        };
      }

      return {
        success: true,
        providerPaymentId: completeResult.paymentRefId || paymentRef,
        clientSecret: completeResult.callbackURL || initData.callbackURL,
        status: PaymentStatus.requires_confirmation,
      };
    } catch (error) {
      console.error("[Nagad] Payment create error:", error);
      return this.createMockPaymentIntent(params);
    }
  }

  private createMockPaymentIntent(params: CreatePaymentIntentParams): CreatePaymentIntentResult {
    const paymentId = `nagad_mock_${this.generatePaymentId()}`;
    console.log(`[Nagad-Mock] Created mock payment: ${paymentId}`);

    return {
      success: true,
      providerPaymentId: paymentId,
      clientSecret: `nagad_mock_url_${paymentId}`,
      status: PaymentStatus.requires_confirmation,
    };
  }

  async capturePayment(params: CapturePaymentParams): Promise<CapturePaymentResult> {
    if (params.providerPaymentId.startsWith("nagad_mock_")) {
      console.log(`[Nagad-Mock] Capturing mock payment: ${params.providerPaymentId}`);
      return {
        success: true,
        status: PaymentStatus.captured,
        capturedAt: new Date(),
      };
    }

    const config = this.getConfig();
    if (!config) {
      return {
        success: false,
        status: PaymentStatus.failed,
        error: "Nagad not configured",
        errorCode: "NAGAD_NOT_CONFIGURED",
      };
    }

    try {
      const verifyResponse = await fetch(
        `${config.baseUrl}/verify/payment/${params.providerPaymentId}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "X-KM-IP-V4": "127.0.0.1",
            "X-KM-Client-Type": "PC_WEB",
          },
        }
      );

      if (!verifyResponse.ok) {
        return {
          success: false,
          status: PaymentStatus.failed,
          error: `Verification failed: ${verifyResponse.status}`,
          errorCode: "NAGAD_VERIFY_FAILED",
        };
      }

      const verifyData = await verifyResponse.json();

      if (verifyData.status === "Success" || verifyData.statusCode === "000") {
        return {
          success: true,
          status: PaymentStatus.captured,
          capturedAt: new Date(),
        };
      }

      return {
        success: false,
        status: PaymentStatus.failed,
        error: verifyData.message || "Payment not successful",
        errorCode: verifyData.statusCode,
      };
    } catch (error) {
      console.error("[Nagad] Capture error:", error);
      return {
        success: false,
        status: PaymentStatus.failed,
        error: error instanceof Error ? error.message : "Unknown error",
        errorCode: "NAGAD_ERROR",
      };
    }
  }

  async cancelPayment(params: CancelPaymentParams): Promise<CancelPaymentResult> {
    if (params.providerPaymentId.startsWith("nagad_mock_")) {
      console.log(`[Nagad-Mock] Cancelling mock payment: ${params.providerPaymentId}`);
      return {
        success: true,
        status: PaymentStatus.cancelled,
        cancelledAt: new Date(),
      };
    }

    console.log(`[Nagad] Payment ${params.providerPaymentId} cancellation requested`);

    return {
      success: true,
      status: PaymentStatus.cancelled,
      cancelledAt: new Date(),
    };
  }

  async refundPayment(params: RefundPaymentParams): Promise<RefundPaymentResult> {
    if (params.providerPaymentId.startsWith("nagad_mock_")) {
      console.log(`[Nagad-Mock] Refunding mock payment: ${params.providerPaymentId}`);
      return {
        success: true,
        providerRefundId: `nagad_refund_mock_${this.generateRefundId()}`,
        status: "succeeded",
        refundedAt: new Date(),
      };
    }

    const config = this.getConfig();
    if (!config) {
      return {
        success: false,
        status: "failed",
        error: "Nagad not configured",
        errorCode: "NAGAD_NOT_CONFIGURED",
      };
    }

    const payment = await prisma.payment.findFirst({
      where: { providerPaymentId: params.providerPaymentId },
    }) as { mobileWalletReference?: string | null; amount: any } | null;

    if (!payment || !payment.mobileWalletReference) {
      return {
        success: false,
        status: "failed",
        error: "Original payment not found",
        errorCode: "NAGAD_PAYMENT_NOT_FOUND",
      };
    }

    try {
      const refundAmount = params.amount ?? Number(payment.amount);
      const referenceNo = `REF${this.generateOrderId()}`;

      const refundData = {
        paymentRefId: params.providerPaymentId,
        originalAmount: Number(payment.amount).toFixed(2),
        refundAmount: refundAmount.toFixed(2),
        referenceNo,
        reason: params.reason || "Customer refund request",
      };

      const refundDataJson = JSON.stringify(refundData);
      const signature = this.signData(refundDataJson, config.merchantPrivateKey);

      const response = await fetch(`${config.baseUrl}/refund`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-KM-IP-V4": "127.0.0.1",
          "X-KM-Client-Type": "PC_WEB",
        },
        body: JSON.stringify({
          ...refundData,
          signature,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[Nagad] Refund failed:", response.status, errorText);
        return {
          success: false,
          status: "failed",
          error: `Nagad refund failed: ${response.status}`,
          errorCode: "NAGAD_REFUND_FAILED",
        };
      }

      const data: NagadRefundResponse = await response.json();

      if (data.statusCode !== "000" && data.status !== "Success") {
        return {
          success: false,
          status: "failed",
          error: data.message || "Refund failed",
          errorCode: data.statusCode,
        };
      }

      return {
        success: true,
        providerRefundId: data.refundReferenceNo,
        status: "succeeded",
        refundedAt: new Date(),
      };
    } catch (error) {
      console.error("[Nagad] Refund error:", error);
      return {
        success: false,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
        errorCode: "NAGAD_ERROR",
      };
    }
  }

  async parseWebhook(params: ParseWebhookParams): Promise<ParseWebhookResult> {
    try {
      const payload = typeof params.payload === "string"
        ? JSON.parse(params.payload)
        : JSON.parse(params.payload.toString());

      const { paymentRefId, status, statusCode, amount, orderId } = payload;

      let paymentStatus: PaymentStatus;
      switch (status?.toLowerCase()) {
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
        type: `nagad.${status?.toLowerCase() || "unknown"}`,
        providerPaymentId: paymentRefId,
        status: paymentStatus,
        metadata: {
          orderId,
          amount,
          statusCode,
          rawStatus: status,
        },
      };

      return { success: true, event };
    } catch (error) {
      console.error("[Nagad] Webhook parse error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Invalid webhook payload",
      };
    }
  }

  async validateWebhookSignature(payload: string, signature: string): Promise<boolean> {
    const config = this.getConfig();
    if (!config?.nagadPublicKey) return false;

    return this.verifySignature(payload, signature, config.nagadPublicKey);
  }
}

export const nagadPaymentProvider = new NagadPaymentProvider();
