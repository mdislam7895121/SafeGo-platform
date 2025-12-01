import { prisma } from "../lib/prisma";
import { PaymentProvider, PaymentStatus, DeliveryServiceType, Prisma } from "@prisma/client";
import {
  IPaymentProvider,
  CreatePaymentIntentParams,
  CreatePaymentIntentResult,
  CapturePaymentResult,
  CancelPaymentResult,
  RefundPaymentResult,
  WebhookEvent,
} from "./paymentProviders/base";
import { mockPaymentProvider } from "./paymentProviders/mock";
import { stripePaymentProvider } from "./paymentProviders/stripe";
import { walletService } from "./walletService";
import { settlementService } from "./settlementService";

interface CreatePaymentParams {
  customerId: string;
  serviceType: DeliveryServiceType;
  entityId: string;
  amount: number;
  currency: string;
  countryCode: string;
  paymentMethodId?: string;
  provider?: PaymentProvider;
  idempotencyKey?: string;
  metadata?: Record<string, any>;
}

interface CreatePaymentResult {
  success: boolean;
  paymentId?: string;
  clientSecret?: string;
  status?: PaymentStatus;
  error?: string;
  errorCode?: string;
}

interface ProcessPaymentResult {
  success: boolean;
  paymentId?: string;
  status?: PaymentStatus;
  error?: string;
}

const COUNTRY_DEFAULT_PROVIDERS: Record<string, PaymentProvider> = {
  US: PaymentProvider.stripe,
  BD: PaymentProvider.bkash,
};

const providerInstances: Record<PaymentProvider, IPaymentProvider> = {
  [PaymentProvider.mock]: mockPaymentProvider,
  [PaymentProvider.stripe]: stripePaymentProvider,
  [PaymentProvider.bkash]: mockPaymentProvider,
  [PaymentProvider.nagad]: mockPaymentProvider,
  [PaymentProvider.paypal]: mockPaymentProvider,
  [PaymentProvider.braintree]: mockPaymentProvider,
};

class PaymentService {
  private getProvider(provider: PaymentProvider): IPaymentProvider {
    const instance = providerInstances[provider];
    if (!instance) {
      console.warn(`[PaymentService] Provider ${provider} not found, falling back to mock`);
      return mockPaymentProvider;
    }
    return instance;
  }

  private async getDefaultProvider(countryCode: string, serviceType?: DeliveryServiceType): Promise<PaymentProvider> {
    const config = await prisma.paymentProviderConfig.findFirst({
      where: {
        countryCode,
        serviceType: serviceType ?? null,
        isEnabled: true,
        isDefault: true,
      },
      orderBy: { priority: "desc" },
    });

    if (config) {
      return config.provider;
    }

    const provider = COUNTRY_DEFAULT_PROVIDERS[countryCode];
    if (provider && this.getProvider(provider).isConfigured()) {
      return provider;
    }

    return PaymentProvider.mock;
  }

  async createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult> {
    try {
      if (params.idempotencyKey) {
        const existing = await prisma.payment.findUnique({
          where: { idempotencyKey: params.idempotencyKey },
        });
        if (existing) {
          console.log(`[PaymentService] Found existing payment with idempotency key: ${params.idempotencyKey}`);
          return {
            success: true,
            paymentId: existing.id,
            clientSecret: existing.clientSecret ?? undefined,
            status: existing.status,
          };
        }
      }

      const provider = params.provider ?? await this.getDefaultProvider(params.countryCode, params.serviceType);
      const providerInstance = this.getProvider(provider);

      if (!providerInstance.isConfigured() && provider !== PaymentProvider.mock) {
        console.warn(`[PaymentService] Provider ${provider} not configured, falling back to mock`);
      }

      const payment = await prisma.payment.create({
        data: {
          serviceType: params.serviceType,
          entityId: params.entityId,
          customerId: params.customerId,
          amount: params.amount,
          currency: params.currency,
          countryCode: params.countryCode,
          provider: providerInstance.isConfigured() ? provider : PaymentProvider.mock,
          status: PaymentStatus.created,
          paymentMethodId: params.paymentMethodId,
          idempotencyKey: params.idempotencyKey,
          metadata: params.metadata ?? Prisma.JsonNull,
        },
      });

      const createResult = await providerInstance.createPaymentIntent({
        customerId: params.customerId,
        serviceType: params.serviceType,
        entityId: params.entityId,
        amount: params.amount,
        currency: params.currency,
        countryCode: params.countryCode,
        paymentMethodId: params.paymentMethodId,
        metadata: params.metadata,
        idempotencyKey: params.idempotencyKey,
      });

      if (!createResult.success) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.failed,
            errorCode: createResult.errorCode,
            errorMessage: createResult.error,
          },
        });

        return {
          success: false,
          paymentId: payment.id,
          status: PaymentStatus.failed,
          error: createResult.error,
          errorCode: createResult.errorCode,
        };
      }

      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          providerPaymentId: createResult.providerPaymentId,
          clientSecret: createResult.clientSecret,
          status: createResult.status,
          capturedAt: createResult.status === PaymentStatus.succeeded || createResult.status === PaymentStatus.captured
            ? new Date()
            : null,
        },
      });

      if (createResult.status === PaymentStatus.succeeded || createResult.status === PaymentStatus.captured) {
        await this.onPaymentCaptured(payment.id, params.serviceType, params.entityId);
      }

      return {
        success: true,
        paymentId: payment.id,
        clientSecret: createResult.clientSecret,
        status: createResult.status,
      };
    } catch (error: any) {
      console.error("[PaymentService] Error creating payment:", error);
      return {
        success: false,
        error: error.message,
        errorCode: "internal_error",
      };
    }
  }

  async capturePayment(paymentId: string): Promise<CapturePaymentResult> {
    try {
      const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
      if (!payment) {
        return {
          success: false,
          status: PaymentStatus.failed,
          error: "Payment not found",
          errorCode: "payment_not_found",
        };
      }

      if (payment.status === PaymentStatus.captured || payment.status === PaymentStatus.succeeded) {
        return {
          success: true,
          status: payment.status,
          capturedAt: payment.capturedAt ?? undefined,
        };
      }

      if (!payment.providerPaymentId) {
        return {
          success: false,
          status: PaymentStatus.failed,
          error: "No provider payment ID",
          errorCode: "missing_provider_id",
        };
      }

      const provider = this.getProvider(payment.provider);
      const result = await provider.capturePayment({
        providerPaymentId: payment.providerPaymentId,
      });

      await prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: result.status,
          capturedAt: result.capturedAt,
          errorCode: result.errorCode,
          errorMessage: result.error,
        },
      });

      if (result.success) {
        await this.onPaymentCaptured(paymentId, payment.serviceType, payment.entityId);
      }

      return result;
    } catch (error: any) {
      console.error("[PaymentService] Error capturing payment:", error);
      return {
        success: false,
        status: PaymentStatus.failed,
        error: error.message,
        errorCode: "internal_error",
      };
    }
  }

  async cancelPayment(paymentId: string, reason?: string): Promise<CancelPaymentResult> {
    try {
      const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
      if (!payment) {
        return {
          success: false,
          status: PaymentStatus.failed,
          error: "Payment not found",
          errorCode: "payment_not_found",
        };
      }

      if (payment.status === PaymentStatus.cancelled) {
        return {
          success: true,
          status: PaymentStatus.cancelled,
          cancelledAt: payment.cancelledAt ?? undefined,
        };
      }

      if (!payment.providerPaymentId) {
        await prisma.payment.update({
          where: { id: paymentId },
          data: {
            status: PaymentStatus.cancelled,
            cancelledAt: new Date(),
          },
        });
        return {
          success: true,
          status: PaymentStatus.cancelled,
          cancelledAt: new Date(),
        };
      }

      const provider = this.getProvider(payment.provider);
      const result = await provider.cancelPayment({
        providerPaymentId: payment.providerPaymentId,
        reason,
      });

      await prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: result.status,
          cancelledAt: result.cancelledAt,
          errorCode: result.errorCode,
          errorMessage: result.error,
        },
      });

      if (result.success) {
        await this.updateEntityPaymentStatus(payment.serviceType, payment.entityId, "cancelled");
      }

      return result;
    } catch (error: any) {
      console.error("[PaymentService] Error cancelling payment:", error);
      return {
        success: false,
        status: PaymentStatus.failed,
        error: error.message,
        errorCode: "internal_error",
      };
    }
  }

  async refundPayment(paymentId: string, amount?: number, reason?: string): Promise<RefundPaymentResult> {
    try {
      const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
      if (!payment) {
        return {
          success: false,
          status: "failed",
          error: "Payment not found",
          errorCode: "payment_not_found",
        };
      }

      if (!payment.providerPaymentId) {
        return {
          success: false,
          status: "failed",
          error: "No provider payment ID",
          errorCode: "missing_provider_id",
        };
      }

      const provider = this.getProvider(payment.provider);
      const result = await provider.refundPayment({
        providerPaymentId: payment.providerPaymentId,
        amount,
        reason,
      });

      if (result.success && result.providerRefundId) {
        await prisma.paymentRefund.create({
          data: {
            paymentId,
            amount: new Prisma.Decimal(amount ?? Number(payment.amount)),
            currency: payment.currency,
            reason,
            providerRefundId: result.providerRefundId,
            status: result.status,
            processedAt: result.refundedAt,
          },
        });

        const isFullRefund = !amount || amount >= Number(payment.amount);
        await prisma.payment.update({
          where: { id: paymentId },
          data: {
            status: isFullRefund ? PaymentStatus.refunded : PaymentStatus.partially_refunded,
            refundedAt: result.refundedAt,
          },
        });
      }

      return result;
    } catch (error: any) {
      console.error("[PaymentService] Error refunding payment:", error);
      return {
        success: false,
        status: "failed",
        error: error.message,
        errorCode: "internal_error",
      };
    }
  }

  async handleWebhook(provider: PaymentProvider, payload: string | Buffer, signature?: string): Promise<{ success: boolean; message?: string }> {
    try {
      const providerInstance = this.getProvider(provider);
      const webhookSecret = this.getWebhookSecret(provider);

      const result = await providerInstance.parseWebhook({
        payload,
        signature,
        webhookSecret,
      });

      if (!result.success || !result.event) {
        console.warn(`[PaymentService] Failed to parse webhook: ${result.error}`);
        return { success: false, message: result.error };
      }

      const event = result.event;
      console.log(`[PaymentService] Processing webhook event: ${event.type} for ${event.providerPaymentId}`);

      if (!event.providerPaymentId) {
        return { success: true, message: "No payment ID in event" };
      }

      const payment = await prisma.payment.findFirst({
        where: {
          provider,
          providerPaymentId: event.providerPaymentId,
        },
      });

      if (!payment) {
        console.warn(`[PaymentService] Payment not found for webhook: ${event.providerPaymentId}`);
        return { success: true, message: "Payment not found" };
      }

      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          webhookPayload: payload.toString() as any,
        },
      });

      if (event.status) {
        const statusChanged = payment.status !== event.status;
        
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: event.status,
            capturedAt: (event.status === PaymentStatus.captured || event.status === PaymentStatus.succeeded) && !payment.capturedAt
              ? new Date()
              : payment.capturedAt,
            cancelledAt: event.status === PaymentStatus.cancelled && !payment.cancelledAt
              ? new Date()
              : payment.cancelledAt,
            errorCode: event.errorCode,
            errorMessage: event.errorMessage,
          },
        });

        if (statusChanged) {
          if (event.status === PaymentStatus.captured || event.status === PaymentStatus.succeeded) {
            await this.onPaymentCaptured(payment.id, payment.serviceType, payment.entityId);
          } else if (event.status === PaymentStatus.failed) {
            await this.onPaymentFailed(payment.id, payment.serviceType, payment.entityId);
          } else if (event.status === PaymentStatus.cancelled) {
            await this.updateEntityPaymentStatus(payment.serviceType, payment.entityId, "cancelled");
          }
        }
      }

      return { success: true, message: "Webhook processed" };
    } catch (error: any) {
      console.error("[PaymentService] Error handling webhook:", error);
      return { success: false, message: error.message };
    }
  }

  private async onPaymentCaptured(paymentId: string, serviceType: DeliveryServiceType, entityId: string): Promise<void> {
    console.log(`[PaymentService] Payment captured: ${paymentId}, triggering settlement for ${serviceType}/${entityId}`);

    await this.updateEntityPaymentStatus(serviceType, entityId, "paid");
  }

  private async onPaymentFailed(paymentId: string, serviceType: DeliveryServiceType, entityId: string): Promise<void> {
    console.log(`[PaymentService] Payment failed: ${paymentId} for ${serviceType}/${entityId}`);

    await this.updateEntityPaymentStatus(serviceType, entityId, "failed");
  }

  private async updateEntityPaymentStatus(serviceType: DeliveryServiceType, entityId: string, status: string): Promise<void> {
    try {
      switch (serviceType) {
        case "ride":
          await prisma.ride.update({
            where: { id: entityId },
            data: { paymentStatus: status },
          });
          break;
        case "food":
          await prisma.foodOrder.update({
            where: { id: entityId },
            data: { paymentStatus: status },
          });
          break;
        case "parcel":
          await prisma.delivery.update({
            where: { id: entityId },
            data: { paymentStatus: status },
          });
          break;
      }
    } catch (error) {
      console.error(`[PaymentService] Error updating entity payment status:`, error);
    }
  }

  private getWebhookSecret(provider: PaymentProvider): string | undefined {
    switch (provider) {
      case PaymentProvider.stripe:
        return process.env.STRIPE_WEBHOOK_SECRET;
      default:
        return undefined;
    }
  }

  async getPayment(paymentId: string) {
    return prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        refunds: true,
        paymentMethod: true,
      },
    });
  }

  async getPaymentsForEntity(serviceType: DeliveryServiceType, entityId: string) {
    return prisma.payment.findMany({
      where: {
        serviceType,
        entityId,
      },
      orderBy: { createdAt: "desc" },
      include: {
        refunds: true,
      },
    });
  }

  async getCustomerPayments(customerId: string, limit = 50) {
    return prisma.payment.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        refunds: true,
      },
    });
  }
}

export const paymentService = new PaymentService();
