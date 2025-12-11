# Bangladesh Online Payments Architecture

This document describes the architecture for online payments in Bangladesh using SSLCOMMERZ as the payment gateway.

## Overview

SafeGo Bangladesh supports both cash and online payments. Online payments are processed through SSLCOMMERZ, which provides a unified gateway for:
- Credit/Debit Cards (Visa, MasterCard, AMEX)
- Mobile Wallets (bKash, Nagad, Rocket, Upay)
- Internet Banking (major Bangladeshi banks)

## Feature Flag

Online payments in Bangladesh are controlled by the feature flag:

```
FEATURE_BD_ONLINE_PAYMENTS_ENABLED=true|false
```

When disabled (default), only cash payments are available in Bangladesh.

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `FEATURE_BD_ONLINE_PAYMENTS_ENABLED` | Enable BD online payments | Yes |
| `SSLCOMMERZ_STORE_ID_BD` | Production store ID | For production |
| `SSLCOMMERZ_STORE_PASSWORD_BD` | Production store password | For production |
| `SSLCOMMERZ_SANDBOX_STORE_ID_BD` | Sandbox store ID | For testing |
| `SSLCOMMERZ_SANDBOX_PASSWORD_BD` | Sandbox store password | For testing |
| `SSLCOMMERZ_SANDBOX_ENABLED_BD` | Use sandbox environment | For testing |
| `APP_BASE_URL` | Application base URL for callbacks | Yes |

## Gateway Adapter

**File:** `server/services/paymentProviders/sslcommerz.ts`

The SSLCOMMERZ gateway adapter implements the `IPaymentProvider` interface:

### Key Methods

#### `createPaymentIntent(params)`
Creates a payment session with SSLCOMMERZ and returns a redirect URL.

**Input:**
- `customerId`: Customer ID
- `serviceType`: ride | food | parcel
- `entityId`: Order/Ride ID
- `amount`: Payment amount in BDT
- `currency`: "BDT"
- `metadata`: Customer details

**Output:**
- `providerPaymentId`: Transaction ID (tran_id)
- `clientSecret`: Gateway redirect URL
- `status`: PaymentStatus.requires_confirmation

#### `parseWebhook(params)`
Validates and processes webhook callbacks from SSLCOMMERZ.

**Validation Steps:**
1. Verify MD5 signature using store password
2. Call SSLCOMMERZ validation API for VALID/VALIDATED status
3. Map gateway status to SafeGo payment status

**Status Mapping:**
| SSLCOMMERZ Status | SafeGo Status |
|-------------------|---------------|
| VALID/VALIDATED | succeeded |
| FAILED | failed |
| CANCELLED | cancelled |

## Callback Endpoints

**Base Path:** `/api/webhooks/payments/sslcommerz/`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/ipn` | POST | Instant Payment Notification (server-to-server) |
| `/success` | POST | Success redirect from gateway |
| `/fail` | POST | Failure redirect from gateway |
| `/cancel` | POST | Cancellation redirect from gateway |

## Order Fields

Orders (rides, food_orders, deliveries) include these payment fields:

| Field | Type | Description |
|-------|------|-------------|
| `paymentMethod` | String | "cash" or "sslcommerz_online" |
| `paymentProvider` | String | "cash" or "sslcommerz" |
| `paymentCountryCode` | String | "BD" |
| `paymentCurrency` | String | "BDT" |
| `paymentStatus` | String | Payment lifecycle status |
| `paymentReferenceId` | String | Gateway transaction ID |
| `paymentMetadata` | JSON | Gateway response data |
| `isCommissionSettled` | Boolean | Commission settlement flag |

## Commission & Wallet Logic

### BD Cash Payments
- Customer pays driver/restaurant directly
- SafeGo commission → negative wallet balance
- Driver/restaurant settles commission weekly

### BD Online Payments (SSLCOMMERZ)
- Customer pays SafeGo via SSLCOMMERZ
- SafeGo keeps commission automatically
- Driver/restaurant receives net earnings to wallet
- `isCommissionSettled = true` immediately
- No negative balance created

## Payment Flow

```
1. Customer selects "Online Payment" at checkout
   ↓
2. Frontend calls backend to create order with payment_method="sslcommerz_online"
   ↓
3. Backend creates order, sets payment_status="pending"
   ↓
4. Backend calls SSLCOMMERZ createPaymentIntent
   ↓
5. Backend returns redirect URL to frontend
   ↓
6. Frontend redirects customer to SSLCOMMERZ hosted checkout
   ↓
7. Customer completes payment on SSLCOMMERZ page
   ↓
8. SSLCOMMERZ sends IPN + redirects customer
   ↓
9. Backend validates transaction via SSLCOMMERZ API
   ↓
10. On success:
    - Set payment_status="captured"
    - Credit driver/restaurant wallet
    - Set isCommissionSettled=true
    - Progress order status
    ↓
11. Redirect customer to success page
```

## Security Considerations

1. **Signature Verification**: All webhooks are verified using MD5 signature
2. **Server-Side Validation**: Success status is verified via SSLCOMMERZ validation API
3. **No Sensitive Data**: Card/wallet details are never stored
4. **Environment Variables**: All credentials are stored securely

## Testing

1. Enable sandbox mode:
   ```
   SSLCOMMERZ_SANDBOX_ENABLED_BD=true
   SSLCOMMERZ_SANDBOX_STORE_ID_BD=your_sandbox_id
   SSLCOMMERZ_SANDBOX_PASSWORD_BD=your_sandbox_password
   FEATURE_BD_ONLINE_PAYMENTS_ENABLED=true
   ```

2. Use SSLCOMMERZ test cards/wallets from their documentation

3. Verify:
   - Redirect to gateway works
   - Success/fail/cancel callbacks update order status
   - Wallet balances are credited correctly
   - No negative balance for online payments

## Related Files

- `server/services/paymentProviders/sslcommerz.ts` - Gateway adapter
- `server/services/paymentService.ts` - Payment service
- `server/routes/payment-webhooks.ts` - Webhook endpoints
- `server/services/PaymentOptionsService.ts` - Available payment methods
- `docs/bd_payments_business_setup.md` - Business setup guide
