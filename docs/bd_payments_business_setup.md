# Bangladesh Online Payments - Business Setup Guide

This document describes the business-side setup required for enabling online payments in Bangladesh through SSLCOMMERZ.

## Overview

SafeGo Bangladesh will use SSLCOMMERZ as the primary online payment gateway. SSLCOMMERZ is a leading payment gateway in Bangladesh that supports:

- Credit/Debit Cards (Visa, MasterCard, AMEX)
- Mobile Wallets (bKash, Nagad, Rocket, Upay)
- Internet Banking (all major BD banks)
- QR Code payments

## Pre-requisites

Before enabling online payments, the following business steps must be completed:

### 1. Company Registration

- SafeGo BD must be a registered company in Bangladesh
- Valid Trade License required
- TIN (Tax Identification Number) certificate required
- Bank account in a Bangladeshi bank

### 2. SSLCOMMERZ Merchant Account Setup

#### Steps to Open Account:

1. Visit [SSLCOMMERZ Merchant Portal](https://developer.sslcommerz.com/)
2. Apply for a merchant account with the following documents:
   - Trade License (scanned copy)
   - TIN Certificate (scanned copy)
   - Bank account details (account number, branch, routing number)
   - Company letterhead
   - Authorized signatory's NID
3. Wait for account approval (typically 3-5 business days)
4. Complete integration testing in sandbox mode
5. Go live after successful testing

#### Recommended: Separate Test vs Production Accounts

- **Sandbox Account**: For development and testing
- **Production Account**: For live transactions

### 3. Credentials to Obtain

After merchant account approval, you will receive:

| Credential | Description | Environment Variable |
|------------|-------------|---------------------|
| Store ID | Unique merchant identifier | `SSLCOMMERZ_STORE_ID_BD` |
| Store Password | API authentication password | `SSLCOMMERZ_STORE_PASSWORD_BD` |
| Sandbox Store ID | Test environment store ID | `SSLCOMMERZ_SANDBOX_STORE_ID_BD` |
| Sandbox Password | Test environment password | `SSLCOMMERZ_SANDBOX_PASSWORD_BD` |

**IMPORTANT**: Never commit these credentials to version control. Store them securely as environment variables.

### 4. Webhook & Redirect URL Configuration

Configure the following URLs in SSLCOMMERZ dashboard:

| URL Type | Path | Description |
|----------|------|-------------|
| Success URL | `https://yourdomain.com/api/webhooks/payments/sslcommerz/success` | Redirect after successful payment |
| Fail URL | `https://yourdomain.com/api/webhooks/payments/sslcommerz/fail` | Redirect after failed payment |
| Cancel URL | `https://yourdomain.com/api/webhooks/payments/sslcommerz/cancel` | Redirect if user cancels |
| IPN URL | `https://yourdomain.com/api/webhooks/payments/sslcommerz/ipn` | Instant Payment Notification webhook |

### 5. IP Whitelist

SSLCOMMERZ may require server IP whitelisting for production:

- Obtain your production server's static IP
- Submit to SSLCOMMERZ for whitelisting
- Verify connectivity after whitelisting

## Settlement Information

### Settlement Cycle

- **Default**: T+2 (Transaction day + 2 business days)
- **Custom cycles** may be negotiated for high-volume merchants

### Settlement Account

- Funds are settled to the registered bank account
- Settlement reports available in merchant dashboard

### Fees Structure

| Payment Method | Fee Type | Typical Range |
|----------------|----------|---------------|
| Cards (Visa/MC) | Percentage | 2.0% - 2.5% |
| Mobile Wallets | Percentage | 1.5% - 2.0% |
| Internet Banking | Fixed + % | ৳10 + 1.0% |

*Actual fees depend on negotiated merchant agreement.*

## Active Payment Instruments

After account setup, enable the following payment instruments:

### Mobile Wallets (via SSLCOMMERZ)
- [x] bKash
- [x] Nagad
- [x] Rocket
- [x] Upay

### Cards
- [x] Visa
- [x] MasterCard
- [x] AMEX

### Internet Banking
- [x] All major Bangladeshi banks

## Dashboard Access

### SSLCOMMERZ Dashboards

| Environment | URL |
|-------------|-----|
| Sandbox | https://sandbox.sslcommerz.com/manage/ |
| Production | https://sslcommerz.com/manage/ |

### Key Dashboard Functions

- View transaction history
- Download settlement reports
- Manage refunds
- Configure payment methods
- Access API credentials

## Integration Testing Checklist

Before going live, complete these tests in sandbox:

- [ ] Successful card payment
- [ ] Failed card payment (test card decline)
- [ ] bKash wallet payment
- [ ] Nagad wallet payment
- [ ] Payment cancellation flow
- [ ] Refund processing
- [ ] IPN webhook verification
- [ ] Amount validation (min/max limits)

## Go-Live Checklist

- [ ] Sandbox testing complete
- [ ] Production credentials received
- [ ] IP whitelisting confirmed
- [ ] Redirect URLs configured for production domain
- [ ] Feature flag `FEATURE_BD_ONLINE_PAYMENTS_ENABLED` set to `true`
- [ ] Commission logic verified for online payments
- [ ] Admin dashboard can view SSLCOMMERZ transactions

## Support Contacts

- **SSLCOMMERZ Technical Support**: support@sslcommerz.com
- **SSLCOMMERZ Merchant Support**: merchant@sslcommerz.com
- **Documentation**: https://developer.sslcommerz.com/doc/

## Related Documents

- [SafeGo Master Rules](/SAFEGO_MASTER_RULES.md)
- [Payment Architecture](/docs/PHASE2_ARCHITECTURE.md)

---

*Last Updated: December 2024*
*Document Owner: SafeGo Platform Team*
