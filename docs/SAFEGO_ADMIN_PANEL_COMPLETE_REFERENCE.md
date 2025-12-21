# SafeGo Admin Panel — Complete A-Z Feature Reference

**Version:** 1.0  
**Effective Date:** December 2025  
**Target:** Solo Founder/Admin Operations  
**Market Focus:** Bangladesh (Production) | USA (Backend-Ready)

---

## EXECUTIVE SUMMARY

This document provides a complete mapping of all admin panel features required for solo-founder operation of SafeGo in Bangladesh. All features listed below are **IMPLEMENTED** in the SafeGo codebase.

**Total Admin Pages:** 135+  
**Endpoint Routes:** 400+  
**Service Support:** Rides (Active) | Food (Ready) | Parcel (Ready)

---

## SECTION 1: ADMIN DASHBOARD (COMMAND CENTER)

### 1.1 Location
**Page:** `/admin` → `client/src/pages/admin/home.tsx`

### 1.2 Dashboard Statistics (Real-time, 30s refresh)

| Metric | API Endpoint | Description |
|--------|--------------|-------------|
| Total Users | `/api/admin/stats` → `totalUsers` | All registered users |
| Total Drivers | `/api/admin/stats` → `totalDrivers` | All driver accounts |
| Active Drivers | `/api/admin/stats` → `activeDrivers` | Drivers currently online |
| Pending Drivers | `/api/admin/stats` → `pendingDrivers` | Awaiting KYC approval |
| Suspended Drivers | `/api/admin/stats` → `suspendedDrivers` | Temporarily blocked |
| Blocked Drivers | `/api/admin/stats` → `blockedDrivers` | Permanently blocked |
| Total Customers | `/api/admin/stats` → `totalCustomers` | Customer accounts |
| Restaurants | `/api/admin/stats` → `restaurants` | Restaurant partners |
| Open Complaints | `/api/admin/stats` → `openComplaints` | Pending complaints |

### 1.3 At-Risk Indicators

| Alert Type | Trigger | Location |
|------------|---------|----------|
| Negative Balance Drivers | `walletBalance < 0` | Finance Center |
| Overdue Settlements | `daysSinceLastSettlement > 14` | Settlement Page |
| Cash Mismatch | Reconciliation discrepancy | Finance Logs |
| Pending Verifications | `verificationStatus = 'pending'` | Onboarding Overview |

### 1.4 Quick Access Cards

| Section | Route | Badge |
|---------|-------|-------|
| Onboarding Overview | `/admin/onboarding-overview` | Pending count |
| Notification Center | `/admin/notifications` | Unread count |
| People & KYC Center | `/admin/people-kyc` | - |
| Safety & Risk Center | `/admin/safety-center` | - |
| Finance Center | `/admin/finance-center` | - |
| Support Center | `/admin/support-center` | Unread messages |

---

## SECTION 2: DRIVER MANAGEMENT

### 2.1 Driver List
**Page:** `/admin/drivers` → `client/src/pages/admin/drivers.tsx`

**Features:**
- View all drivers with pagination
- Search by name/email/phone
- Filter by country (BD/US)
- Filter by status (online/offline/pending/suspended/blocked)
- Filter by verification status
- View wallet balance inline
- View negative balance indicator
- Quick navigation to driver details

### 2.2 Driver Details
**Page:** `/admin/driver-details/:id` → `client/src/pages/admin/driver-details.tsx`

**Information Displayed:**
- Full profile (name, email, phone)
- KYC documents (NID, license, vehicle docs)
- Verification status
- Vehicle information
- Total earnings
- Commission paid
- Current wallet balance
- Negative balance (owed to SafeGo)
- Rating & reviews
- Ride history

**Admin Actions:**
| Action | Permission | Endpoint |
|--------|------------|----------|
| Approve KYC | `kyc:approve` | `POST /api/admin/drivers/:id/approve` |
| Reject KYC | `kyc:approve` | `POST /api/admin/drivers/:id/reject` |
| Suspend Driver | `user:suspend` | `POST /api/admin/drivers/:id/suspend` |
| Unsuspend Driver | `user:suspend` | `POST /api/admin/drivers/:id/unsuspend` |
| Block Driver | `user:block` | `POST /api/admin/drivers/:id/block` |
| Unblock Driver | `user:block` | `POST /api/admin/drivers/:id/unblock` |
| View Documents | `kyc:view` | `GET /api/admin/drivers/:id/documents` |
| Add Admin Note | `notes:write` | `POST /api/admin/drivers/:id/notes` |

### 2.3 Driver KYC Verification
**Page:** `/admin/kyc-verification` → `client/src/pages/admin/kyc-verification.tsx`

**Bangladesh Requirements Validated:**
- Father's name
- Date of birth
- Present address
- Permanent address
- NID number (encrypted)
- NID front image
- NID back image
- Emergency contact name
- Emergency contact phone
- Profile photo
- Vehicle registration

### 2.4 Driver Onboarding Queue
**Page:** `/admin/onboarding-drivers` → `client/src/pages/admin/onboarding-drivers.tsx`

**Features:**
- Pending applications list
- Document preview
- Quick approve/reject
- Bulk actions
- Search & filter

### 2.5 Admin Notes (Private)
**API:** `POST /api/admin/drivers/:id/notes`

```typescript
{
  content: string;      // Note text
  category: string;     // fraud | complaint | payment | general
  priority: string;     // low | medium | high | critical
}
```

Notes are:
- Visible ONLY to admins
- Never shown to drivers
- Timestamped with admin ID
- Searchable

---

## SECTION 3: WALLET & COMMISSION MANAGEMENT

### 3.1 Wallet Overview
**Page:** `/admin/wallets` → `client/src/pages/admin/wallets.tsx`

**Features:**
- View all wallets (driver, restaurant, customer)
- Filter by wallet type
- View available balance
- View negative balance (debt)
- Currency support (BDT, USD)

### 3.2 Driver Balances
**Page:** `/admin/finance-driver-balances` → `client/src/pages/admin/finance-driver-balances.tsx`

**Columns:**
- Driver name
- Email
- Country
- Available balance
- Negative balance
- Days outstanding
- Last transaction date
- Actions

### 3.3 Commission Configuration
**Page:** `/admin/settings` → Commission section

**Global Settings (No Redeploy Required):**

| Setting | Location | Description |
|---------|----------|-------------|
| Ride Commission % | `/api/admin/settings/commission/ride` | Platform fee for rides |
| Food Commission % | `/api/admin/settings/commission/food` | Platform fee for food orders |
| Parcel Commission % | `/api/admin/settings/commission/parcel` | Platform fee for deliveries |
| Country Override | `/api/admin/settings/commission/:country` | Country-specific rates |

**Commission Logic (CASH Payment):**
```
Driver collects: Full fare from customer
SafeGo commission: fare × commission_rate
Driver wallet: wallet_balance -= commission (becomes negative)
Settlement: Driver pays SafeGo weekly
```

### 3.4 Negative Balance Tracking
**API:** `GET /api/admin/drivers?negativeBalance=true`

| Field | Description |
|-------|-------------|
| `negativeBalance` | Total owed to SafeGo |
| `daysOutstanding` | Days since last settlement |
| `lastSettlementDate` | Date of last payment |

---

## SECTION 4: WEEKLY CASH SETTLEMENT SYSTEM

### 4.1 Settlement Dashboard
**Page:** `/admin/settlement` → `client/src/pages/admin/settlement.tsx`

**Overview Statistics:**
- Total driver wallets
- Total pending settlement
- Total balance across wallets
- Wallets needing settlement

### 4.2 Settlement Workflow

**Step 1: Generate Weekly Report**
```
GET /api/admin/settlement/weekly-report
Query: { week_start: Date, week_end: Date }
```

**Step 2: View Driver Settlement Details**
```
GET /api/admin/settlement/driver/:id/breakdown
Response: {
  totalRides: number,
  totalFare: number,
  totalCommission: number,
  previousBalance: number,
  amountDue: number
}
```

**Step 3: Record Payment**
```
POST /api/admin/settlement/record-payment
Body: {
  driverId: string,
  amountPaid: number,
  paymentMethod: 'cash' | 'bank' | 'bkash',
  receiptNumber: string,
  notes?: string
}
```

**Step 4: System Updates**
- Adjusts `driver_wallet_balance`
- Creates settlement record
- Logs audit event
- Sends confirmation SMS

### 4.3 Partial Payment Support
```
POST /api/admin/settlement/partial-payment
Body: {
  driverId: string,
  amountPaid: number,
  remainingBalance: number,
  nextPaymentDeadline: Date,
  notes: string
}
```

### 4.4 Auto-Block Rules
**Service:** `server/services/automation/`

```javascript
// Auto-block trigger conditions
if (negativeBalance > 5000 && currency === 'BDT') {
  autoBlock('negative_balance_threshold');
}

if (daysSinceLastSettlement > 14 && negativeBalance > 0) {
  autoBlock('settlement_overdue');
}
```

### 4.5 Settlement Audit Log
**Table:** `settlement_records`

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| driver_id | INTEGER | Driver reference |
| period_start | DATE | Week start |
| period_end | DATE | Week end |
| rides_count | INTEGER | Cash rides |
| total_fare | DECIMAL | Sum of fares |
| commission_rate | DECIMAL | % applied |
| commission_amount | DECIMAL | Calculated |
| previous_balance | DECIMAL | Carried over |
| amount_due | DECIMAL | Total owed |
| amount_paid | DECIMAL | Received |
| payment_method | VARCHAR | cash/bank/bkash |
| receipt_number | VARCHAR | Physical receipt |
| collected_by | INTEGER | Admin ID |
| status | VARCHAR | pending/paid/partial |

---

## SECTION 5: RIDE MONITORING & CONTROL

### 5.1 Ride Requests
**Page:** `/admin/ride-requests` → `client/src/pages/admin/ride-requests.tsx`

**Features:**
- All rides list with pagination
- Filter by status
- Filter by date range
- Filter by payment method
- Search by customer/driver
- View ride details

### 5.2 Ride Timeline
**Page:** `/admin/ride-timeline` → `client/src/pages/admin/ride-timeline.tsx`

**Tracking:**
- Real-time ride status
- GPS trail visualization
- Driver-customer communication
- Status change timestamps

### 5.3 Anomaly Detection
**Service:** `server/services/fraudDetectionService.ts`

| Anomaly | Detection Logic | Action |
|---------|-----------------|--------|
| Ultra-short ride | duration < 2 min | Flag for review |
| Circular trip | pickup ≈ dropoff | Auto-cancel |
| High cancellation | >5/day by driver | Warning → review |
| Missing GPS | no location data | Flag driver |
| Unusual fare | fare >> distance estimate | Manual review |

### 5.4 Admin Ride Actions
| Action | Endpoint | Effect |
|--------|----------|--------|
| Cancel Ride | `POST /api/admin/rides/:id/cancel` | Terminates ride |
| Refund Customer | `POST /api/admin/rides/:id/refund` | Issues refund |
| Block Driver | `POST /api/admin/drivers/:id/block` | From ride screen |
| Add Note | `POST /api/admin/rides/:id/notes` | Internal note |

---

## SECTION 6: FRAUD & RISK CONTROL

### 6.1 Fraud Detection Center
**Page:** `/admin/fraud-detection` → `client/src/pages/admin/fraud-detection.tsx`

### 6.2 Fraud Prevention Center
**Page:** `/admin/fraud-prevention-center` → `client/src/pages/admin/fraud-prevention-center.tsx`

### 6.3 At-Risk Flagging System

| Risk Flag | Trigger | Severity |
|-----------|---------|----------|
| `NEGATIVE_BALANCE_HIGH` | balance < -5000 BDT | High |
| `SETTLEMENT_OVERDUE` | >14 days unpaid | High |
| `HIGH_CANCEL_RATE` | >30% cancellations | Medium |
| `LOW_RATING` | rating < 4.0 after 50 rides | Medium |
| `SUSPICIOUS_PATTERN` | Fraud detection trigger | Critical |
| `CUSTOMER_COMPLAINT` | Safety complaint filed | High |

### 6.4 Auto-Block Rules
**Location:** `server/services/automation/`

```javascript
// Rule 1: Negative Balance Threshold (Bangladesh)
if (countryCode === 'BD' && negativeBalance > 5000) {
  triggerAutoBlock(driverId, 'NEGATIVE_BALANCE_THRESHOLD');
}

// Rule 2: Settlement Overdue
if (daysSinceLastSettlement > 14 && negativeBalance > 0) {
  triggerAutoBlock(driverId, 'SETTLEMENT_OVERDUE');
}

// Rule 3: Fraud Detection Score
if (fraudScore > 80) {
  triggerAutoBlock(driverId, 'FRAUD_SCORE_HIGH');
  notifyAdmin('FRAUD_ALERT', driverId);
}
```

### 6.5 Escalation History
**Table:** `admin_audit_logs`

Tracks:
- Block/unblock events
- Reason for action
- Admin who took action
- Timestamp
- IP address

---

## SECTION 7: USER BLOCKING SYSTEM

### 7.1 Block Types

| Type | Effect | Reversal |
|------|--------|----------|
| `temp_blocked` | Cannot go online | Admin unblock |
| `perm_blocked` | Cannot login | Never |

### 7.2 Block Reasons (Mandatory)

```typescript
enum BlockReason {
  NEGATIVE_BALANCE_THRESHOLD = 'negative_balance_threshold',
  SETTLEMENT_OVERDUE = 'settlement_overdue',
  FRAUD_CONFIRMED = 'fraud_confirmed',
  CUSTOMER_COMPLAINT = 'customer_complaint',
  POLICY_VIOLATION = 'policy_violation',
  FAKE_DOCUMENTS = 'fake_documents',
  SAFETY_CONCERN = 'safety_concern',
  MULTIPLE_ACCOUNTS = 'multiple_accounts',
  OTHER = 'other'
}
```

### 7.3 Block API

**Temporary Block:**
```
POST /api/admin/drivers/:id/suspend
Body: {
  reason: BlockReason,
  notes: string,
  duration?: number  // days, optional
}
```

**Permanent Block:**
```
POST /api/admin/drivers/:id/block
Body: {
  reason: BlockReason,
  notes: string,
  permanent: true
}
```

**Unblock:**
```
POST /api/admin/drivers/:id/unsuspend
Body: {
  notes: string,
  clearBalance?: boolean
}
```

### 7.4 Block History Log
**Page:** `/admin/activity-log` → `client/src/pages/admin/activity-log.tsx`

Records:
- Action type (block/unblock)
- Target user
- Reason
- Admin ID
- Timestamp
- Notes

---

## SECTION 8: STATUS FLOWS

### 8.1 Driver Lifecycle Status

```
                    ┌──────────────────────────────────────┐
                    │                                      │
                    ▼                                      │
[SIGNUP] → [pending_verification] → [approved] ← ─ ─ ─ ─ ─┘
                    │                    │
                    │                    │
                    │              (violation)
                    │                    │
                    │                    ▼
                    │            [temp_blocked]
                    │                    │
                    │              (severe)
                    │                    │
                    │                    ▼
                    │            [perm_blocked]
                    │
                    └──────────► [rejected]
                                     │
                               (reapply)
                                     │
                                     ▼
                         [pending_verification]
```

### 8.2 Ride Status Flow

```
[requested]
    │
    ▼
[searching_driver] ──(timeout)──► [cancelled_no_driver]
    │
    (matched)
    │
    ▼
[accepted] ──(driver cancels)──► [cancelled_by_driver]
    │
    ▼
[driver_arriving] ──(customer cancels)──► [cancelled_by_customer]
    │
    ▼
[arrived_at_pickup]
    │
    ▼
[in_progress] ──(emergency)──► [cancelled_emergency]
    │
    ▼
[completed]
```

### 8.3 Settlement Status Flow

```
[pending]
    │
    ├──(full payment)──► [settled]
    │
    ├──(partial)──► [partial] ──(remainder)──► [settled]
    │                   │
    │              (timeout)
    │                   │
    │                   ▼
    │              [overdue]
    │                   │
    │              (blocked)
    │                   │
    │                   ▼
    │           [blocked_unpaid]
    │
    └──(disputed)──► [disputed] ──(resolved)──► [pending] or [waived]
```

---

## SECTION 9: NON-BREAKING GUARANTEE

### 9.1 Preserved Schemas

| Table | Key Fields (UNCHANGED) |
|-------|------------------------|
| users | id, email, role, createdAt |
| drivers | id, userId, verificationStatus, isVerified |
| rides | id, customerId, driverId, status, fare |
| restaurants | id, userId, name, status |
| wallets | id, ownerType, ownerId, balance |

### 9.2 New Nullable Fields (Bangladesh)

```sql
-- Added to drivers table (nullable, backward compatible)
father_name VARCHAR(255) NULL,
nid_number VARCHAR(20) NULL,
nid_front_image_url TEXT NULL,
nid_back_image_url TEXT NULL,
emergency_contact_name VARCHAR(255) NULL,
emergency_contact_phone VARCHAR(20) NULL,
permanent_address TEXT NULL,
present_address TEXT NULL,
block_reason VARCHAR(100) NULL,
blocked_at TIMESTAMP NULL,
blocked_by INTEGER NULL
```

### 9.3 USA Compatibility

| Feature | BD Status | USA Status |
|---------|-----------|------------|
| Cash Payment | Active | Ready (not enabled) |
| Weekly Settlement | Active | N/A (card payments) |
| NID Verification | Active | N/A (SSN/DMV instead) |
| Ride Service | Active | Backend ready |
| Food Service | Ready | Backend ready |
| Parcel Service | Ready | Backend ready |

---

## ADMIN PANEL PAGE INDEX (A-Z)

| # | Page | Route | Purpose |
|---|------|-------|---------|
| 1 | Access Governance | `/admin/access-governance` | RBAC management |
| 2 | Access Reviews | `/admin/access-reviews` | Permission audits |
| 3 | Activity Log | `/admin/activity-log` | Audit trail |
| 4 | Activity Monitor | `/admin/activity-monitor` | Real-time monitoring |
| 5 | Admin Chat | `/admin/admin-chat` | Internal messaging |
| 6 | Analytics | `/admin/analytics` | Business analytics |
| 7 | Audit Console | `/admin/audit-console` | Security audits |
| 8 | Background Checks | `/admin/background-checks` | Driver screening |
| 9 | Backup Recovery | `/admin/backup-recovery` | Data recovery |
| 10 | BD Expansion | `/admin/bd-expansion-dashboard` | Bangladesh growth |
| 11 | BD Tax Settings | `/admin/bd-tax-settings` | Bangladesh taxes |
| 12 | Communication Hub | `/admin/communication-hub` | Messaging center |
| 13 | Complaint Details | `/admin/complaint-details/:id` | Single complaint |
| 14 | Complaint Resolution | `/admin/complaint-resolution` | Resolve complaints |
| 15 | Complaints | `/admin/complaints` | All complaints |
| 16 | Compliance Center | `/admin/compliance-center` | Regulatory |
| 17 | Compliance Export | `/admin/compliance-export-center` | Data exports |
| 18 | Contact Center | `/admin/contact-center` | Support tickets |
| 19 | Customer Details | `/admin/customer-details/:id` | Single customer |
| 20 | Customer Support | `/admin/customer-support-panel` | Support tools |
| 21 | Customers | `/admin/customers` | All customers |
| 22 | Data Governance | `/admin/DataGovernanceCenter` | Data policies |
| 23 | Delivery Driver Verification | `/admin/delivery-driver-verification` | Parcel drivers |
| 24 | Document Manager | `/admin/document-manager` | File management |
| 25 | Documents | `/admin/documents` | Document library |
| 26 | Driver Details | `/admin/driver-details/:id` | Single driver |
| 27 | Driver Promotions | `/admin/driver-promotions` | Driver incentives |
| 28 | Driver Support | `/admin/driver-support` | Driver tickets |
| 29 | Driver Violations | `/admin/driver-violations` | Policy violations |
| 30 | Drivers | `/admin/drivers` | All drivers |
| 31 | Earnings | `/admin/earnings` | Platform earnings |
| 32 | Earnings Disputes | `/admin/earnings-disputes` | Dispute resolution |
| 33 | Email Templates | `/admin/email-templates` | Email management |
| 34 | Emergency Controls | `/admin/emergency-controls` | Emergency actions |
| 35 | Enterprise Search | `/admin/enterprise-search` | Global search |
| 36 | Export Center | `/admin/export-center` | Data exports |
| 37 | Feature Flags | `/admin/feature-flags` | Feature toggles |
| 38 | Finance Center | `/admin/finance-center` | Financial overview |
| 39 | Finance Driver Balances | `/admin/finance-driver-balances` | Driver debts |
| 40 | Finance Gateway Reports | `/admin/finance-gateway-reports` | Payment reports |
| 41 | Finance Logs | `/admin/finance-logs` | Transaction logs |
| 42 | Finance Overview | `/admin/finance-overview` | Financial summary |
| 43 | Finance Restaurant Balances | `/admin/finance-restaurant-balances` | Restaurant debts |
| 44 | Finance Settlements History | `/admin/finance-settlements-history` | Past settlements |
| 45 | Finance US Online | `/admin/finance-us-online` | USA payments |
| 46 | Fraud Alerts | `/admin/fraud-alerts` | Fraud notifications |
| 47 | Fraud Detection | `/admin/fraud-detection` | Detect fraud |
| 48 | Fraud Prevention Center | `/admin/fraud-prevention-center` | Prevent fraud |
| 49 | Global Search | `/admin/global-search` | Search everything |
| 50 | Global Settings | `/admin/global-settings` | System settings |
| 51 | Health Monitor | `/admin/health-monitor` | System health |
| 52 | Home | `/admin/home` | Dashboard |
| 53 | Incident Response | `/admin/incident-response` | Incident handling |
| 54 | Intelligence Dashboard | `/admin/intelligence-dashboard` | SafePilot AI |
| 55 | KYC | `/admin/kyc` | KYC queue |
| 56 | KYC Verification | `/admin/kyc-verification` | Verify KYC |
| 57 | Launch Readiness | `/admin/LaunchReadinessCenter` | Launch checklist |
| 58 | Legal Requests | `/admin/legal-requests` | Legal compliance |
| 59 | Map Control | `/admin/map-control` | Map settings |
| 60 | Media | `/admin/media` | Media library |
| 61 | Mobile Wallet Config | `/admin/mobile-wallet-config` | bKash/Nagad |
| 62 | Monitoring | `/admin/monitoring` | System monitoring |
| 63 | Notification Logs | `/admin/notification-logs` | Notification history |
| 64 | Notification Rules | `/admin/notification-rules` | Notification config |
| 65 | Notifications | `/admin/notifications` | Admin notifications |
| 66 | Observability Center | `/admin/observability-center` | System observability |
| 67 | Onboarding Center | `/admin/onboarding-center` | Partner onboarding |
| 68 | Onboarding Drivers | `/admin/onboarding-drivers` | Driver onboarding |
| 69 | Onboarding Overview | `/admin/onboarding-overview` | Onboarding summary |
| 70 | Onboarding Restaurants | `/admin/onboarding-restaurants` | Restaurant onboarding |
| 71 | Onboarding Shops | `/admin/onboarding-shops` | Shop onboarding |
| 72 | Onboarding Tickets | `/admin/onboarding-tickets` | Onboarding support |
| 73 | Operations Center | `/admin/operations-center` | Operations hub |
| 74 | Operations Console | `/admin/operations-console` | Ops console |
| 75 | Operations Dashboard | `/admin/operations-dashboard` | Ops overview |
| 76 | Opportunity Bonuses | `/admin/opportunity-bonuses` | Bonus management |
| 77 | Parcel Details | `/admin/parcel-details/:id` | Single parcel |
| 78 | Parcels | `/admin/parcels` | All parcels |
| 79 | Payment Integrity | `/admin/payment-integrity` | Payment security |
| 80 | Payment Methods Config | `/admin/payment-methods-config` | Payment setup |
| 81 | Payment Verification | `/admin/payment-verification` | Verify payments |
| 82 | Payout Center | `/admin/payout-center` | Payouts hub |
| 83 | Payouts | `/admin/payouts` | All payouts |
| 84 | Payouts Manual | `/admin/payouts-manual` | Manual payouts |
| 85 | Payouts Reports | `/admin/payouts-reports` | Payout reports |
| 86 | Payouts Requests | `/admin/payouts-requests` | Payout requests |
| 87 | Payouts Schedule | `/admin/payouts-schedule` | Scheduled payouts |
| 88 | People & KYC | `/admin/people-kyc` | User management |
| 89 | Performance | `/admin/performance` | Performance metrics |
| 90 | Phase 5 Dashboard | `/admin/phase5-dashboard` | Development phase |
| 91 | Policy Engine | `/admin/policy-engine` | Policy rules |
| 92 | Policy Manager | `/admin/policy-manager` | Policy management |
| 93 | Policy Safety Hub | `/admin/policy-safety-hub` | Safety policies |
| 94 | Privacy Consent Settings | `/admin/privacy-consent-settings` | GDPR/privacy |
| 95 | Privacy Policy Preview | `/admin/privacy-policy-preview` | Preview policies |
| 96 | Privacy Policy | `/admin/privacy-policy` | Policy management |
| 97 | Promotions | `/admin/promotions` | Promo campaigns |
| 98 | Push Notifications | `/admin/push-notifications` | Push management |
| 99 | Ratings Center | `/admin/ratings-center` | Rating management |
| 100 | Referral Settings | `/admin/referral-settings` | Referral config |
| 101 | Refund Center | `/admin/refund-center` | Process refunds |
| 102 | Releases Publish | `/admin/releases-publish` | App releases |
| 103 | Reports Management | `/admin/reports-management` | Report config |
| 104 | Reputation Center | `/admin/ReputationCenter` | User reputation |
| 105 | Restaurant Details | `/admin/restaurant-details/:id` | Single restaurant |
| 106 | Restaurant Payouts | `/admin/restaurant-payouts` | Restaurant payments |
| 107 | Restaurant Settings | `/admin/restaurant-settings` | Restaurant config |
| 108 | Restaurants | `/admin/restaurants` | All restaurants |
| 109 | Revenue Analytics | `/admin/revenue-analytics` | Revenue data |
| 110 | Reviews | `/admin/reviews` | User reviews |
| 111 | Ride Pricing Config | `/admin/ride-pricing-config` | Pricing setup |
| 112 | Ride Promotions | `/admin/ride-promotions` | Ride promos |
| 113 | Ride Requests | `/admin/ride-requests` | All rides |
| 114 | Ride Timeline | `/admin/ride-timeline` | Ride tracking |
| 115 | SafePilot | `/admin/safepilot` | AI assistant |
| 116 | SafePilot Intelligence | `/admin/safepilot-intelligence` | AI insights |
| 117 | Safety Center | `/admin/safety-center` | Safety hub |
| 118 | Safety Replay | `/admin/safety-replay` | Safety incidents |
| 119 | Security Center | `/admin/security-center` | Security hub |
| 120 | Session Security | `/admin/session-security` | Session management |
| 121 | Settings | `/admin/settings` | Admin settings |
| 122 | Settlement | `/admin/settlement` | Cash settlements |
| 123 | Shop Orders | `/admin/shop-orders` | Shop orders |
| 124 | Shop Partners | `/admin/shop-partners` | Shop partners |
| 125 | SMS Templates | `/admin/sms-templates` | SMS management |
| 126 | Support Center | `/admin/support-center` | Support hub |
| 127 | Support Chat | `/admin/support-chat` | Live chat |
| 128 | System Health | `/admin/system-health` | Health checks |
| 129 | Trust & Safety | `/admin/trust-safety` | Trust management |
| 130 | Users | `/admin/users` | All users |
| 131 | Wallet Details | `/admin/wallet-details/:id` | Single wallet |
| 132 | Wallets | `/admin/wallets` | All wallets |

---

## API ENDPOINT REFERENCE

### Driver Management
```
GET    /api/admin/drivers                    - List all drivers
GET    /api/admin/drivers/:id                - Get driver details
POST   /api/admin/drivers/:id/approve        - Approve KYC
POST   /api/admin/drivers/:id/reject         - Reject KYC
POST   /api/admin/drivers/:id/suspend        - Suspend driver
POST   /api/admin/drivers/:id/unsuspend      - Unsuspend driver
POST   /api/admin/drivers/:id/block          - Block driver
POST   /api/admin/drivers/:id/unblock        - Unblock driver
GET    /api/admin/drivers/:id/documents      - Get KYC documents
POST   /api/admin/drivers/:id/notes          - Add admin note
```

### Wallet & Settlement
```
GET    /api/admin/wallets                    - List all wallets
GET    /api/admin/wallets/:id                - Get wallet details
GET    /api/admin/settlement/overview        - Settlement stats
GET    /api/admin/settlement/pending         - Pending settlements
GET    /api/admin/settlement/driver/:id      - Driver settlement
POST   /api/admin/settlement/record-payment  - Record payment
GET    /api/admin/settlement/history         - Settlement history
```

### Rides
```
GET    /api/admin/rides                      - List all rides
GET    /api/admin/rides/:id                  - Get ride details
POST   /api/admin/rides/:id/cancel           - Cancel ride
POST   /api/admin/rides/:id/refund           - Refund ride
```

### Statistics
```
GET    /api/admin/stats                      - Dashboard stats
GET    /api/admin/stats/parcels              - Parcel stats
GET    /api/admin/analytics                  - Analytics data
```

---

*End of Admin Panel Reference*
