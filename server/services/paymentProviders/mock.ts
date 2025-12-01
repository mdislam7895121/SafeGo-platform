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

interface MockPaymentState {
  status: PaymentStatus;
  amount: number;
  currency: string;
  capturedAt?: Date;
  cancelledAt?: Date;
  refundedAt?: Date;
  metadata?: Record<string, any>;
}

const mockPaymentStore = new Map<string, MockPaymentState>();

export class MockPaymentProvider extends BasePaymentProvider {
  readonly providerType = PaymentProvider.mock;
  
  private autoCapture: boolean;
  private simulateFailure: boolean;
  private failureRate: number;
  
  constructor(options?: { autoCapture?: boolean; simulateFailure?: boolean; failureRate?: number }) {
    super();
    this.autoCapture = options?.autoCapture ?? true;
    this.simulateFailure = options?.simulateFailure ?? false;
    this.failureRate = options?.failureRate ?? 0;
  }
  
  isConfigured(): boolean {
    return true;
  }
  
  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<CreatePaymentIntentResult> {
    if (this.shouldSimulateFailure()) {
      return {
        success: false,
        status: PaymentStatus.failed,
        error: "Simulated payment failure",
        errorCode: "mock_failure",
      };
    }
    
    const paymentId = `mock_${this.generatePaymentId()}`;
    const clientSecret = `cs_mock_${Math.random().toString(36).substring(2, 30)}`;
    
    const status = this.autoCapture ? PaymentStatus.succeeded : PaymentStatus.authorized;
    
    mockPaymentStore.set(paymentId, {
      status,
      amount: params.amount,
      currency: params.currency,
      metadata: params.metadata,
      capturedAt: this.autoCapture ? new Date() : undefined,
    });
    
    console.log(`[MockPaymentProvider] Created payment intent: ${paymentId}, status: ${status}, amount: ${params.amount} ${params.currency}`);
    
    return {
      success: true,
      providerPaymentId: paymentId,
      clientSecret,
      status,
    };
  }
  
  async capturePayment(params: CapturePaymentParams): Promise<CapturePaymentResult> {
    const payment = mockPaymentStore.get(params.providerPaymentId);
    
    if (!payment) {
      return {
        success: false,
        status: PaymentStatus.failed,
        error: "Payment not found",
        errorCode: "payment_not_found",
      };
    }
    
    if (payment.status === PaymentStatus.succeeded || payment.status === PaymentStatus.captured) {
      return {
        success: true,
        status: PaymentStatus.captured,
        capturedAt: payment.capturedAt || new Date(),
      };
    }
    
    if (payment.status !== PaymentStatus.authorized) {
      return {
        success: false,
        status: payment.status,
        error: `Cannot capture payment in status: ${payment.status}`,
        errorCode: "invalid_status",
      };
    }
    
    if (this.shouldSimulateFailure()) {
      payment.status = PaymentStatus.failed;
      return {
        success: false,
        status: PaymentStatus.failed,
        error: "Simulated capture failure",
        errorCode: "mock_capture_failure",
      };
    }
    
    const capturedAt = new Date();
    payment.status = PaymentStatus.captured;
    payment.capturedAt = capturedAt;
    
    console.log(`[MockPaymentProvider] Captured payment: ${params.providerPaymentId}`);
    
    return {
      success: true,
      status: PaymentStatus.captured,
      capturedAt,
    };
  }
  
  async cancelPayment(params: CancelPaymentParams): Promise<CancelPaymentResult> {
    const payment = mockPaymentStore.get(params.providerPaymentId);
    
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
        cancelledAt: payment.cancelledAt,
      };
    }
    
    if (payment.status === PaymentStatus.captured || payment.status === PaymentStatus.succeeded) {
      return {
        success: false,
        status: payment.status,
        error: "Cannot cancel captured payment, use refund instead",
        errorCode: "already_captured",
      };
    }
    
    const cancelledAt = new Date();
    payment.status = PaymentStatus.cancelled;
    payment.cancelledAt = cancelledAt;
    
    console.log(`[MockPaymentProvider] Cancelled payment: ${params.providerPaymentId}, reason: ${params.reason}`);
    
    return {
      success: true,
      status: PaymentStatus.cancelled,
      cancelledAt,
    };
  }
  
  async refundPayment(params: RefundPaymentParams): Promise<RefundPaymentResult> {
    const payment = mockPaymentStore.get(params.providerPaymentId);
    
    if (!payment) {
      return {
        success: false,
        status: "failed",
        error: "Payment not found",
        errorCode: "payment_not_found",
      };
    }
    
    if (payment.status !== PaymentStatus.captured && payment.status !== PaymentStatus.succeeded) {
      return {
        success: false,
        status: "failed",
        error: `Cannot refund payment in status: ${payment.status}`,
        errorCode: "invalid_status",
      };
    }
    
    const refundId = `mock_${this.generateRefundId()}`;
    const refundedAt = new Date();
    
    const refundAmount = params.amount ?? payment.amount;
    if (refundAmount === payment.amount) {
      payment.status = PaymentStatus.refunded;
    } else {
      payment.status = PaymentStatus.partially_refunded;
    }
    payment.refundedAt = refundedAt;
    
    console.log(`[MockPaymentProvider] Refunded payment: ${params.providerPaymentId}, amount: ${refundAmount}, reason: ${params.reason}`);
    
    return {
      success: true,
      providerRefundId: refundId,
      status: "succeeded",
      refundedAt,
    };
  }
  
  async parseWebhook(params: ParseWebhookParams): Promise<ParseWebhookResult> {
    try {
      const payload = typeof params.payload === "string" 
        ? JSON.parse(params.payload) 
        : JSON.parse(params.payload.toString());
      
      return {
        success: true,
        event: {
          type: payload.type || "payment_intent.succeeded",
          providerPaymentId: payload.payment_id || payload.providerPaymentId,
          status: payload.status as PaymentStatus,
          metadata: payload.metadata,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to parse webhook: ${error.message}`,
      };
    }
  }
  
  private shouldSimulateFailure(): boolean {
    if (!this.simulateFailure) return false;
    return Math.random() < this.failureRate;
  }
  
  static getPaymentState(paymentId: string): MockPaymentState | undefined {
    return mockPaymentStore.get(paymentId);
  }
  
  static clearPaymentStore(): void {
    mockPaymentStore.clear();
  }
  
  static simulateWebhookEvent(paymentId: string, status: PaymentStatus): void {
    const payment = mockPaymentStore.get(paymentId);
    if (payment) {
      payment.status = status;
      if (status === PaymentStatus.captured || status === PaymentStatus.succeeded) {
        payment.capturedAt = new Date();
      } else if (status === PaymentStatus.cancelled) {
        payment.cancelledAt = new Date();
      } else if (status === PaymentStatus.refunded) {
        payment.refundedAt = new Date();
      }
    }
  }
}

export const mockPaymentProvider = new MockPaymentProvider();
