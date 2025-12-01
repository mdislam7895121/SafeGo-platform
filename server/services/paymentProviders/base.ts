import { PaymentProvider, PaymentStatus, DeliveryServiceType } from "@prisma/client";

export interface CreatePaymentIntentParams {
  customerId: string;
  serviceType: DeliveryServiceType;
  entityId: string;
  amount: number;
  currency: string;
  countryCode: string;
  paymentMethodId?: string;
  metadata?: Record<string, any>;
  idempotencyKey?: string;
}

export interface CreatePaymentIntentResult {
  success: boolean;
  providerPaymentId?: string;
  clientSecret?: string;
  status: PaymentStatus;
  error?: string;
  errorCode?: string;
}

export interface CapturePaymentParams {
  providerPaymentId: string;
  amount?: number;
}

export interface CapturePaymentResult {
  success: boolean;
  status: PaymentStatus;
  capturedAt?: Date;
  error?: string;
  errorCode?: string;
}

export interface CancelPaymentParams {
  providerPaymentId: string;
  reason?: string;
}

export interface CancelPaymentResult {
  success: boolean;
  status: PaymentStatus;
  cancelledAt?: Date;
  error?: string;
  errorCode?: string;
}

export interface RefundPaymentParams {
  providerPaymentId: string;
  amount?: number;
  reason?: string;
}

export interface RefundPaymentResult {
  success: boolean;
  providerRefundId?: string;
  status: string;
  refundedAt?: Date;
  error?: string;
  errorCode?: string;
}

export interface WebhookEvent {
  type: string;
  providerPaymentId?: string;
  status?: PaymentStatus;
  errorCode?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export interface ParseWebhookParams {
  payload: string | Buffer;
  signature?: string;
  webhookSecret?: string;
}

export interface ParseWebhookResult {
  success: boolean;
  event?: WebhookEvent;
  error?: string;
}

export interface IPaymentProvider {
  readonly providerType: PaymentProvider;
  
  createPaymentIntent(params: CreatePaymentIntentParams): Promise<CreatePaymentIntentResult>;
  
  capturePayment(params: CapturePaymentParams): Promise<CapturePaymentResult>;
  
  cancelPayment(params: CancelPaymentParams): Promise<CancelPaymentResult>;
  
  refundPayment(params: RefundPaymentParams): Promise<RefundPaymentResult>;
  
  parseWebhook(params: ParseWebhookParams): Promise<ParseWebhookResult>;
  
  isConfigured(): boolean;
}

export abstract class BasePaymentProvider implements IPaymentProvider {
  abstract readonly providerType: PaymentProvider;
  
  abstract createPaymentIntent(params: CreatePaymentIntentParams): Promise<CreatePaymentIntentResult>;
  abstract capturePayment(params: CapturePaymentParams): Promise<CapturePaymentResult>;
  abstract cancelPayment(params: CancelPaymentParams): Promise<CancelPaymentResult>;
  abstract refundPayment(params: RefundPaymentParams): Promise<RefundPaymentResult>;
  abstract parseWebhook(params: ParseWebhookParams): Promise<ParseWebhookResult>;
  abstract isConfigured(): boolean;
  
  protected generatePaymentId(): string {
    return `pay_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }
  
  protected generateRefundId(): string {
    return `ref_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }
}
