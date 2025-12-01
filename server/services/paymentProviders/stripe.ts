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
import { getUncachableStripeClient, isStripeConfigured } from "../stripeClient";

export class StripePaymentProvider extends BasePaymentProvider {
  readonly providerType = PaymentProvider.stripe;
  
  private configured: boolean | null = null;
  
  constructor() {
    super();
  }
  
  isConfigured(): boolean {
    if (this.configured === null) {
      isStripeConfigured().then(result => {
        this.configured = result;
      }).catch(() => {
        this.configured = false;
      });
      return false;
    }
    return this.configured;
  }
  
  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<CreatePaymentIntentResult> {
    try {
      const stripe = await getUncachableStripeClient();
      const amountInCents = Math.round(params.amount * 100);
      
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: params.currency.toLowerCase(),
        payment_method_types: ['card'],
        metadata: {
          entityId: params.entityId,
          serviceType: params.serviceType,
          customerId: params.customerId,
          ...(params.metadata || {}),
        },
        capture_method: 'automatic',
      });
      
      console.log(`[StripePaymentProvider] Created payment intent: ${paymentIntent.id}`);
      
      return {
        success: true,
        providerPaymentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret || undefined,
        status: this.mapStripeStatus(paymentIntent.status),
      };
    } catch (error: any) {
      console.error("[StripePaymentProvider] Error creating payment intent:", error);
      return {
        success: false,
        status: PaymentStatus.failed,
        error: error.message,
        errorCode: error.code || "stripe_error",
      };
    }
  }
  
  async capturePayment(params: CapturePaymentParams): Promise<CapturePaymentResult> {
    try {
      const stripe = await getUncachableStripeClient();
      
      const paymentIntent = await stripe.paymentIntents.capture(
        params.providerPaymentId,
        params.amount ? { amount_to_capture: Math.round(params.amount * 100) } : undefined
      );
      
      console.log(`[StripePaymentProvider] Captured payment: ${paymentIntent.id}`);
      
      return {
        success: true,
        providerPaymentId: paymentIntent.id,
        status: this.mapStripeStatus(paymentIntent.status),
      };
    } catch (error: any) {
      console.error("[StripePaymentProvider] Error capturing payment:", error);
      return {
        success: false,
        status: PaymentStatus.failed,
        error: error.message,
        errorCode: error.code || "stripe_error",
      };
    }
  }
  
  async cancelPayment(params: CancelPaymentParams): Promise<CancelPaymentResult> {
    try {
      const stripe = await getUncachableStripeClient();
      
      const paymentIntent = await stripe.paymentIntents.cancel(params.providerPaymentId);
      
      console.log(`[StripePaymentProvider] Cancelled payment: ${paymentIntent.id}`);
      
      return {
        success: true,
        providerPaymentId: paymentIntent.id,
        status: PaymentStatus.cancelled,
      };
    } catch (error: any) {
      console.error("[StripePaymentProvider] Error cancelling payment:", error);
      return {
        success: false,
        status: PaymentStatus.failed,
        error: error.message,
        errorCode: error.code || "stripe_error",
      };
    }
  }
  
  async refundPayment(params: RefundPaymentParams): Promise<RefundPaymentResult> {
    try {
      const stripe = await getUncachableStripeClient();
      
      const refund = await stripe.refunds.create({
        payment_intent: params.providerPaymentId,
        amount: params.amount ? Math.round(params.amount * 100) : undefined,
        reason: (params.reason as any) || 'requested_by_customer',
      });
      
      console.log(`[StripePaymentProvider] Created refund: ${refund.id}`);
      
      return {
        success: true,
        refundId: refund.id,
        status: refund.status === 'succeeded' ? 'succeeded' : 'pending',
        amount: refund.amount / 100,
      };
    } catch (error: any) {
      console.error("[StripePaymentProvider] Error refunding payment:", error);
      return {
        success: false,
        status: "failed",
        error: error.message,
        errorCode: error.code || "stripe_error",
      };
    }
  }
  
  async parseWebhook(params: ParseWebhookParams): Promise<ParseWebhookResult> {
    try {
      const stripe = await getUncachableStripeClient();
      
      const event = stripe.webhooks.constructEvent(
        params.rawBody,
        params.signature,
        process.env.STRIPE_WEBHOOK_SECRET || ''
      );
      
      console.log(`[StripePaymentProvider] Parsed webhook event: ${event.type}`);
      
      let eventType: string;
      let paymentId: string | undefined;
      let status: PaymentStatus | undefined;
      let metadata: Record<string, any> | undefined;
      
      switch (event.type) {
        case 'payment_intent.succeeded':
          eventType = 'payment.succeeded';
          paymentId = (event.data.object as any).id;
          status = PaymentStatus.captured;
          metadata = (event.data.object as any).metadata;
          break;
        case 'payment_intent.payment_failed':
          eventType = 'payment.failed';
          paymentId = (event.data.object as any).id;
          status = PaymentStatus.failed;
          metadata = (event.data.object as any).metadata;
          break;
        case 'payment_intent.canceled':
          eventType = 'payment.cancelled';
          paymentId = (event.data.object as any).id;
          status = PaymentStatus.cancelled;
          metadata = (event.data.object as any).metadata;
          break;
        case 'charge.refunded':
          eventType = 'payment.refunded';
          paymentId = (event.data.object as any).payment_intent;
          status = PaymentStatus.refunded;
          break;
        default:
          eventType = event.type;
      }
      
      return {
        success: true,
        event: {
          type: eventType,
          providerPaymentId: paymentId,
          status,
          metadata,
          rawEvent: event,
        },
      };
    } catch (error: any) {
      console.error("[StripePaymentProvider] Error parsing webhook:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
  
  private mapStripeStatus(stripeStatus: string): PaymentStatus {
    switch (stripeStatus) {
      case 'succeeded':
        return PaymentStatus.captured;
      case 'requires_capture':
        return PaymentStatus.authorized;
      case 'requires_payment_method':
      case 'requires_confirmation':
      case 'requires_action':
        return PaymentStatus.pending;
      case 'processing':
        return PaymentStatus.processing;
      case 'canceled':
        return PaymentStatus.cancelled;
      default:
        return PaymentStatus.pending;
    }
  }
}

export const stripePaymentProvider = new StripePaymentProvider();
