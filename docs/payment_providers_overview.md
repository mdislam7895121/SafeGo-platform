# Payment Providers Overview

This document provides an overview of payment providers supported by the SafeGo platform.

## Supported Providers by Country

### United States (US)

| Provider | Method Code | Type | Status |
|----------|-------------|------|--------|
| Stripe | stripe_card | Credit/Debit Cards | Active |
| Stripe | apple_pay | Apple Pay | Active |
| Stripe | google_pay | Google Pay | Active |
| Cash | cash | Cash to driver | Active (rides only) |

### Bangladesh (BD)

| Provider | Method Code | Type | Status |
|----------|-------------|------|--------|
| SSLCOMMERZ | sslcommerz_online | Cards, Wallets, Banking | Gated by feature flag |
| bKash | bkash | Mobile Wallet | Active (direct) |
| Nagad | nagad | Mobile Wallet | Active (direct) |
| Rocket | rocket | Mobile Wallet | Planned |
| Upay | upay | Mobile Wallet | Planned |
| Cash | cash | Cash to driver/restaurant | Active (default) |

## Provider Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    PaymentService                            │
│  - createPayment()                                           │
│  - handleWebhook()                                           │
│  - getDefaultProvider()                                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│               IPaymentProvider Interface                     │
│  - createPaymentIntent()                                     │
│  - capturePayment()                                          │
│  - cancelPayment()                                           │
│  - refundPayment()                                           │
│  - parseWebhook()                                            │
│  - isConfigured()                                            │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│StripeProvider │    │SSLCommerzProv.│    │  bKash/Nagad  │
│    (US)       │    │    (BD)       │    │     (BD)      │
└───────────────┘    └───────────────┘    └───────────────┘
```

## Adding a New Provider

To add a new payment provider:

### 1. Add Provider to Prisma Enum

```prisma
// prisma/schema.prisma
enum PaymentProvider {
  mock
  stripe
  bkash
  nagad
  sslcommerz
  new_provider  // Add here
  paypal
  braintree
}
```

### 2. Create Provider Adapter

Create a new file: `server/services/paymentProviders/newProvider.ts`

```typescript
import { PaymentProvider, PaymentStatus } from "@prisma/client";
import {
  BasePaymentProvider,
  CreatePaymentIntentParams,
  CreatePaymentIntentResult,
  // ... other imports
} from "./base";

class NewPaymentProvider extends BasePaymentProvider {
  readonly providerType = PaymentProvider.new_provider;

  isConfigured(): boolean {
    return !!process.env.NEW_PROVIDER_API_KEY;
  }

  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<CreatePaymentIntentResult> {
    // Implementation
  }

  async capturePayment(params: CapturePaymentParams): Promise<CapturePaymentResult> {
    // Implementation
  }

  async cancelPayment(params: CancelPaymentParams): Promise<CancelPaymentResult> {
    // Implementation
  }

  async refundPayment(params: RefundPaymentParams): Promise<RefundPaymentResult> {
    // Implementation
  }

  async parseWebhook(params: ParseWebhookParams): Promise<ParseWebhookResult> {
    // Implementation
  }
}

export const newPaymentProvider = new NewPaymentProvider();
```

### 3. Register Provider in PaymentService

```typescript
// server/services/paymentService.ts
import { newPaymentProvider } from "./paymentProviders/newProvider";

const providerInstances: Record<PaymentProvider, IPaymentProvider> = {
  // ... existing providers
  [PaymentProvider.new_provider]: newPaymentProvider,
};
```

### 4. Add Webhook Routes (if needed)

```typescript
// server/routes/payment-webhooks.ts
router.post("/new-provider/webhook", async (req, res) => {
  const result = await paymentService.handleWebhook(
    PaymentProvider.new_provider,
    JSON.stringify(req.body)
  );
  // ...
});
```

### 5. Add to Payment Methods Catalog

Add entries to `CountryPaymentConfig` for the countries where this provider is available.

## Provider-Specific Notes

### Stripe (US)

- **Auth Mode**: PaymentIntent with `automatic_confirmation`
- **Webhook Events**: `payment_intent.succeeded`, `payment_intent.payment_failed`
- **Saved Cards**: Supported via Stripe Customer
- **Environment Variables**:
  - `STRIPE_SECRET_KEY`
  - `STRIPE_PUBLISHABLE_KEY`
  - `STRIPE_WEBHOOK_SECRET`

### SSLCOMMERZ (BD)

- **Auth Mode**: Redirect-based hosted checkout
- **Webhook Events**: IPN (Instant Payment Notification)
- **Auto-Capture**: Payments are captured automatically
- **Validation**: Server-side validation via API required
- **Environment Variables**:
  - `SSLCOMMERZ_STORE_ID_BD`
  - `SSLCOMMERZ_STORE_PASSWORD_BD`
  - `SSLCOMMERZ_SANDBOX_ENABLED_BD`
  - `FEATURE_BD_ONLINE_PAYMENTS_ENABLED`

### bKash / Nagad (BD)

- **Auth Mode**: Direct API integration
- **Tokenization**: Supported for repeat payments
- **Environment Variables**:
  - `BKASH_APP_KEY_BD`
  - `BKASH_APP_SECRET_BD`
  - `NAGAD_MERCHANT_ID_BD`
  - `NAGAD_MERCHANT_KEY_BD`

## Commission Handling

### Online Payments
- SafeGo receives full payment amount
- Commission is kept automatically
- Driver/restaurant receives net earnings
- `isCommissionSettled = true` immediately

### Cash Payments
- Driver/restaurant receives full amount from customer
- Commission becomes negative wallet balance
- Weekly settlement with SafeGo
- `isCommissionSettled = false` until admin settles

## Future Providers (Planned)

1. **PayPal** (US) - For broader payment options
2. **Rocket Direct** (BD) - Direct Dutch-Bangla integration
3. **Upay Direct** (BD) - Direct UCB integration
4. **bKash PGW** (BD) - bKash Payment Gateway for higher limits

## Related Documents

- [BD Online Payments Architecture](./bd_online_payments_architecture.md)
- [BD Payments Business Setup](./bd_payments_business_setup.md)
- [Phase 2 Architecture](./PHASE2_ARCHITECTURE.md)
