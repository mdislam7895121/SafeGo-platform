# SafeGo Bangladesh — Driver Onboarding & Weekly Cash Settlement SOP

**Version:** 1.0  
**Effective Date:** December 2025  
**Operator:** Solo Founder/Admin  
**Market:** Bangladesh (Production)

---

## SECTION 1: DRIVER ONBOARDING SOP (BANGLADESH)

### 1.1 Onboarding Flow Overview

```
SIGNUP → PENDING_VERIFICATION → ADMIN_REVIEW → APPROVED / REJECTED / BLOCKED
```

### 1.2 Step-by-Step Driver Signup Process

| Step | Action | System Behavior |
|------|--------|-----------------|
| 1 | Driver downloads SafeGo Driver app | - |
| 2 | Driver enters phone number | OTP sent via SMS |
| 3 | Driver verifies OTP | Account created with `verification_status: 'pending'` |
| 4 | Driver completes profile form | Data saved, `is_verified: false` |
| 5 | Driver uploads documents | Files stored securely |
| 6 | Driver submits application | Status set to `pending_verification` |
| 7 | Admin reviews application | Manual review in admin panel |
| 8 | Admin approves/rejects | Status updated accordingly |

### 1.3 Required KYC Data (Bangladesh)

**Personal Information:**
- Full legal name (as on NID)
- Father's name (`father_name`)
- Date of birth (`date_of_birth`)
- Present address (`present_address`)
- Permanent address (`permanent_address`)
- Phone number (verified via OTP)

**Identity Documents:**
- NID number (`nid_number`)
- NID front image (`nid_front_image_url`)
- NID back image (`nid_back_image_url`)

**Emergency Contact:**
- Contact name (`emergency_contact_name`)
- Contact phone (`emergency_contact_phone`)

**Vehicle Information (Ride service):**
- Vehicle type (bike/car/cng)
- Vehicle registration number
- Vehicle registration document image
- Driving license number
- Driving license image

### 1.4 Admin Verification Checklist

Before approving any driver, admin MUST verify:

| Check | Verification Method | Pass Criteria |
|-------|---------------------|---------------|
| NID authenticity | Visual inspection of uploaded images | Clear, unedited, matches name |
| NID number format | System validation | Valid BD NID format (10/13/17 digits) |
| Photo match | Compare NID photo to selfie | Same person |
| Address validity | Cross-reference with NID | Addresses match or reasonable difference |
| Age verification | Calculate from DOB | 18+ years old |
| License validity | Visual inspection | Valid, not expired |
| Vehicle ownership | Registration document | Matches driver or has authorized letter |
| Phone ownership | Already verified via OTP | - |
| No duplicate account | System check | No existing account with same NID/phone |

### 1.5 Approval/Rejection Actions

**APPROVE:**
1. Set `verification_status: 'approved'`
2. Set `is_verified: true`
3. Set `can_accept_rides: true`
4. Initialize `driver_wallet_balance: 0`
5. Send approval SMS to driver
6. Log action in admin audit log

**REJECT (with reason):**
1. Set `verification_status: 'rejected'`
2. Set `is_verified: false`
3. Set `rejection_reason: '<specific reason>'`
4. Send rejection SMS with reason
5. Log action in admin audit log

**Standard Rejection Reasons:**
- `blurry_document` — Document image not readable
- `mismatched_info` — NID info doesn't match application
- `expired_license` — Driving license expired
- `underage` — Applicant under 18 years
- `duplicate_account` — Existing account found
- `fraudulent_document` — Document appears altered/fake
- `incomplete_application` — Missing required fields

### 1.6 Re-Application Rules

| Rejection Reason | Can Reapply? | Wait Period |
|------------------|--------------|-------------|
| `blurry_document` | Yes | Immediate |
| `mismatched_info` | Yes | After correction |
| `expired_license` | Yes | After renewal |
| `underage` | Yes | When 18+ |
| `duplicate_account` | No | Never |
| `fraudulent_document` | No | Never (permanent ban) |

### 1.7 Document Storage & Security

- All KYC documents stored in encrypted cloud storage
- Access restricted to Admin role only
- Documents NEVER visible to customers
- Documents NEVER visible to other drivers
- Automatic purge after 3 years post-account deletion
- Audit log for every document access

---

## SECTION 2: DRIVER PERMISSIONS & ACCESS CONTROL

### 2.1 Permission Matrix by Status

| Permission | PENDING | APPROVED | REJECTED | TEMP_BLOCKED | PERM_BLOCKED |
|------------|---------|----------|----------|--------------|--------------|
| Login to app | Yes | Yes | Yes | Yes | No |
| View own profile | Yes | Yes | Yes | Yes | No |
| Edit profile | Yes | Limited | Yes | No | No |
| Go online | No | Yes | No | No | No |
| Accept rides | No | Yes | No | No | No |
| View ride history | No | Yes | No | Yes | No |
| View earnings | No | Yes | No | Yes | No |
| Withdraw earnings | No | Yes | No | No | No |
| Contact support | Yes | Yes | Yes | Yes | No |
| Resubmit KYC | No | No | Yes | No | No |

### 2.2 Status Definitions

**PENDING (`pending_verification`)**
- New signup awaiting admin review
- Cannot operate on platform
- Can view application status

**APPROVED (`approved`)**
- Fully verified driver
- Can accept all service types (ride/food/parcel)
- Full platform access

**REJECTED (`rejected`)**
- Application denied
- Can view rejection reason
- May reapply (depending on reason)

**TEMPORARILY BLOCKED (`temp_blocked`)**
- Active driver suspended for:
  - Pending settlement payment
  - Customer complaints under review
  - Policy violation investigation
- Cannot go online
- Can view earnings/history
- Auto-unblock after resolution

**PERMANENTLY BLOCKED (`perm_blocked`)**
- Fraud confirmed
- Severe policy violations
- Cannot login
- Cannot reapply
- Account data retained for legal compliance

### 2.3 Block Triggers

| Trigger | Block Type | Auto/Manual |
|---------|------------|-------------|
| 3+ missed settlements | temp_blocked | Auto |
| Customer safety complaint | temp_blocked | Manual |
| Negative balance > 5000 BDT for 14+ days | temp_blocked | Auto |
| Confirmed fraud | perm_blocked | Manual |
| Fake documents discovered | perm_blocked | Manual |
| Physical assault report | perm_blocked | Manual |

---

## SECTION 3: WEEKLY CASH SETTLEMENT SOP

### 3.1 Settlement Schedule

| Day | Activity |
|-----|----------|
| Sunday | Settlement week closes at 23:59:59 |
| Monday | Admin prepares settlement report |
| Tuesday | Admin contacts drivers for collection |
| Wednesday-Thursday | Collection window |
| Friday | Final collection + non-payment actions |
| Saturday | Rest day |

### 3.2 Settlement Calculation Formula

```
Commission Owed = SUM(completed_rides.commission) 
                  WHERE payment_method = 'cash'
                  AND ride_date BETWEEN week_start AND week_end
                  AND driver_id = target_driver

Current Balance = driver_wallet_balance (negative value = owed to SafeGo)

Settlement Amount = ABS(Current Balance) if Balance < 0
```

### 3.3 Admin Preparation Checklist (Monday)

1. **Generate Weekly Report**
   - Navigate to Admin > Settlements > Generate Weekly Report
   - Select previous week date range
   - Export driver list with negative balances

2. **Review Each Driver**
   - Total rides completed
   - Total cash collected
   - Commission percentage applied
   - Current wallet balance
   - Previous unpaid amounts

3. **Prioritize Collection**
   - Sort by amount owed (highest first)
   - Flag drivers with 2+ weeks unpaid
   - Flag drivers with disputed rides

4. **Prepare Collection Schedule**
   - Group drivers by area
   - Assign collection times
   - Send SMS notifications

### 3.4 Settlement Collection Workflow

**Step 1: Contact Driver**
```
SMS: "SafeGo: Your weekly settlement is [AMOUNT] BDT. 
      Collection point: [LOCATION]. 
      Time: [DATE/TIME]. 
      Reply YES to confirm."
```

**Step 2: Verify Amount at Collection**
1. Open Admin > Drivers > [Driver Name] > Wallet
2. Confirm displayed amount matches expected
3. Show breakdown to driver:
   - Rides completed: X
   - Total fare collected: Y BDT
   - Commission (15%): Z BDT
   - Previous balance: W BDT
   - **Total due: [AMOUNT] BDT**

**Step 3: Collect Cash**
1. Count cash in front of driver
2. Verify amount matches settlement
3. Issue physical receipt (numbered)

**Step 4: Record Settlement**
1. Admin > Drivers > [Driver Name] > Settlements
2. Click "Record Payment"
3. Enter:
   - Amount received
   - Receipt number
   - Collection date
   - Notes (if any)
4. Upload receipt photo (optional)
5. Click "Confirm Settlement"

**Step 5: System Updates**
- `driver_wallet_balance` adjusted by payment amount
- `settlement_record` created with:
  - `settlement_id`
  - `driver_id`
  - `amount_due`
  - `amount_paid`
  - `payment_date`
  - `receipt_number`
  - `admin_id`
  - `notes`
- Driver receives confirmation SMS

### 3.5 Partial Payment Handling

If driver cannot pay full amount:

1. **Accept Partial Payment**
   - Record actual amount received
   - Note remaining balance
   - Set next collection date

2. **Update Records**
   - Mark as `partial_settlement`
   - `amount_paid` = actual received
   - `remaining_balance` = due - paid
   - `partial_payment_deadline` = 7 days

3. **Driver Notification**
```
SMS: "SafeGo: Partial payment of [PAID] BDT received. 
      Remaining: [BALANCE] BDT due by [DATE]. 
      Failure to pay will result in account suspension."
```

4. **Follow-up Required**
   - Add to next week priority list
   - Flag account for monitoring

### 3.6 Non-Payment Handling

**Day 1-7 (Grace Period):**
- Daily SMS reminder
- Driver can still operate
- Balance continues accumulating

**Day 8-14 (Warning Period):**
- SMS + in-app warning
- "Your account will be suspended in X days"
- Driver can still operate

**Day 15+ (Enforcement):**
1. Set `verification_status: 'temp_blocked'`
2. Set `block_reason: 'unpaid_settlement'`
3. SMS notification of suspension
4. Add to collections priority list

**Unblock Process:**
1. Driver contacts admin
2. Full payment required
3. Admin verifies payment
4. Admin unblocks account
5. Driver can resume operations

### 3.7 Auto-Block Rules (System-Enforced)

```javascript
if (driver_wallet_balance < -5000 && days_since_last_settlement > 14) {
  set_driver_status('temp_blocked');
  set_block_reason('negative_balance_overdue');
  send_notification('ACCOUNT_SUSPENDED_PAYMENT_DUE');
  create_audit_log('AUTO_BLOCK_SETTLEMENT');
}
```

### 3.8 Settlement Audit Requirements

Every settlement MUST record:

| Field | Required | Description |
|-------|----------|-------------|
| `settlement_id` | Yes | Unique identifier |
| `driver_id` | Yes | Driver being settled |
| `period_start` | Yes | Week start date |
| `period_end` | Yes | Week end date |
| `rides_count` | Yes | Number of cash rides |
| `total_fare` | Yes | Sum of all fares |
| `commission_rate` | Yes | % applied |
| `commission_amount` | Yes | Calculated commission |
| `previous_balance` | Yes | Carried over amount |
| `amount_due` | Yes | Total owed |
| `amount_paid` | Yes | Actual received |
| `payment_method` | Yes | cash/bank/bkash |
| `receipt_number` | Yes | Physical receipt ID |
| `collected_by` | Yes | Admin ID |
| `collection_date` | Yes | Timestamp |
| `notes` | No | Any special notes |

---

## SECTION 4: ADMIN PANEL REQUIREMENTS

### 4.1 Driver Management

| Feature | Description | Priority |
|---------|-------------|----------|
| Driver List | All drivers with status filter | Critical |
| Pending Queue | Drivers awaiting verification | Critical |
| Driver Detail | Full profile view | Critical |
| Approve Driver | One-click approval | Critical |
| Reject Driver | With reason selection | Critical |
| Block Driver | Temp or permanent | Critical |
| Unblock Driver | With verification | Critical |
| View Documents | Secure KYC document viewer | Critical |
| Edit Driver | Update driver info | High |
| Driver Search | By name/phone/NID | High |

### 4.2 Wallet & Settlement

| Feature | Description | Priority |
|---------|-------------|----------|
| Wallet Balance View | Per-driver balance | Critical |
| Negative Balance List | Drivers owing money | Critical |
| Settlement Report | Weekly summary generator | Critical |
| Record Payment | Mark settlement paid | Critical |
| Partial Payment | Handle incomplete payments | Critical |
| Payment History | All past settlements | Critical |
| Export Report | CSV/PDF download | High |
| Bulk SMS | Notify multiple drivers | High |

### 4.3 Ride Management

| Feature | Description | Priority |
|---------|-------------|----------|
| Ride History | All rides with filters | Critical |
| Ride Detail | Full ride breakdown | Critical |
| Per-Driver Rides | Filter by driver | Critical |
| Cash vs Card | Payment method summary | Critical |
| Commission Summary | Per-driver, per-period | Critical |
| Dispute Handling | Mark rides disputed | High |
| Refund Processing | Issue customer refunds | High |

### 4.4 Analytics Dashboard

| Feature | Description | Priority |
|---------|-------------|----------|
| Daily Revenue | Total platform earnings | Critical |
| Driver Payouts | Money paid to drivers | Critical |
| Commission Earned | SafeGo earnings | Critical |
| Active Drivers | Currently online | High |
| Ride Volume | Rides per day/week | High |
| Unpaid Settlements | Total outstanding | Critical |

### 4.5 Audit & Compliance

| Feature | Description | Priority |
|---------|-------------|----------|
| Admin Activity Log | All admin actions | Critical |
| Document Access Log | Who viewed what | Critical |
| Settlement Audit Trail | Payment records | Critical |
| Block/Unblock History | Account status changes | Critical |

---

## SECTION 5: FRAUD & RISK CONTROL

### 5.1 Common Cash-Based Fraud Scenarios

| Scenario | Description | Risk Level |
|----------|-------------|------------|
| Fake Completion | Driver marks ride complete without passenger | High |
| Price Manipulation | Driver claims higher fare than shown | Medium |
| Cash Hiding | Driver underreports cash collected | High |
| Account Sharing | Multiple drivers using one account | High |
| Ghost Rides | Fake rides to inflate balance | Critical |
| Settlement Avoidance | Deliberately evading collection | High |
| Document Fraud | Fake/altered KYC documents | Critical |

### 5.2 Detection Signals

| Signal | Indicates | Action |
|--------|-----------|--------|
| Ride duration < 2 min | Fake completion | Flag for review |
| Pickup = Dropoff location | System abuse | Auto-cancel, flag driver |
| 5+ cancellations/day by driver | Possible cherry-picking | Warning, then review |
| Customer complaint "no ride" | Fake completion | Immediate investigation |
| GPS track missing | App manipulation | Flag for review |
| Multiple accounts same device | Account sharing | Block all accounts |
| Sudden high-value rides | Possible collusion | Manual review |
| Negative balance > 10000 BDT | Settlement avoidance | Immediate contact |

### 5.3 Immediate Admin Actions

**For Fake Completion:**
1. Suspend driver immediately
2. Refund customer
3. Contact driver for explanation
4. Review GPS logs
5. Decision: warning/permanent block

**For Document Fraud:**
1. Permanent block immediately
2. Flag NID number in system
3. Retain evidence
4. Report to authorities if required

**For Settlement Avoidance:**
1. Suspend account
2. Calculate full owed amount
3. Contact driver/emergency contact
4. Set collection deadline
5. If unpaid: permanent block + legal action threshold

### 5.4 Long-Term Prevention Rules

1. **Mandatory Selfie Verification**
   - Random selfie check during shift (future feature)

2. **GPS Validation**
   - All rides must have valid GPS trail
   - Rides without GPS auto-flagged

3. **Rating Threshold**
   - Drivers below 4.0 after 50 rides: review
   - Below 3.5: automatic suspension

4. **Settlement Deposit (Future)**
   - New drivers deposit 2000 BDT
   - Refundable after 6 months good standing

5. **Device Binding**
   - One device per account
   - Device change requires admin approval

---

## SECTION 6: STATUS FLOWS

### 6.1 Driver Lifecycle Status Flow

```
[SIGNUP]
    │
    ▼
[PENDING_VERIFICATION]
    │
    ├──(Admin Approves)──► [APPROVED] ◄──(Admin Unblocks)──┐
    │                           │                           │
    │                           │                           │
    │                    (Violation/Non-payment)            │
    │                           │                           │
    │                           ▼                           │
    │                    [TEMP_BLOCKED] ────────────────────┘
    │                           │
    │                     (Severe violation)
    │                           │
    │                           ▼
    │                    [PERM_BLOCKED]
    │
    └──(Admin Rejects)──► [REJECTED]
                              │
                              │
                        (Reapply allowed)
                              │
                              ▼
                    [PENDING_VERIFICATION]
```

### 6.2 Ride Status Flow (All Services)

```
[REQUESTED]
    │
    ▼
[SEARCHING_DRIVER] ────(No driver found)────► [CANCELLED_NO_DRIVER]
    │
    │
    (Driver accepts)
    │
    ▼
[ACCEPTED]
    │
    ▼
[DRIVER_ARRIVING] ────(Driver cancels)────► [CANCELLED_BY_DRIVER]
    │                      │
    │               (Customer cancels)
    │                      │
    │                      ▼
    │              [CANCELLED_BY_CUSTOMER]
    │
    (Driver at pickup)
    │
    ▼
[ARRIVED_AT_PICKUP]
    │
    ▼
[IN_PROGRESS] ────(Emergency cancel)────► [CANCELLED_EMERGENCY]
    │
    │
    (Destination reached)
    │
    ▼
[COMPLETED]
    │
    ├──(Cash payment)──► driver_wallet_balance REDUCED by commission
    │
    └──(Card payment)──► driver_wallet_balance INCREASED by (fare - commission)
```

### 6.3 Settlement Status Flow

```
[PENDING]
    │
    ├──(Full payment)──► [SETTLED]
    │
    ├──(Partial payment)──► [PARTIAL] ──(Remaining paid)──► [SETTLED]
    │                           │
    │                     (Not paid in time)
    │                           │
    │                           ▼
    │                      [OVERDUE]
    │                           │
    │                     (Driver blocked)
    │                           │
    │                           ▼
    │                    [BLOCKED_UNPAID]
    │
    └──(Disputed)──► [DISPUTED] ──(Resolved)──► [PENDING] or [WAIVED]
```

---

## SECTION 7: NON-BREAKING GUARANTEE

### 7.1 Existing Schema Preservation

**DO NOT MODIFY these existing fields:**
- `users.id` (primary key)
- `drivers.id` (primary key)
- `rides.id` (primary key)
- `drivers.user_id` (foreign key)
- `rides.driver_id` (foreign key)
- `rides.customer_id` (foreign key)
- `driver_wallet_balance` (existing field)

### 7.2 New Fields to ADD (Bangladesh-specific)

```sql
-- Add to drivers table
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS father_name VARCHAR(255);
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS nid_number VARCHAR(20);
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS nid_front_image_url TEXT;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS nid_back_image_url TEXT;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(255);
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(20);
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS permanent_address TEXT;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS present_address TEXT;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS block_reason VARCHAR(100);
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMP;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS blocked_by INTEGER REFERENCES users(id);
```

### 7.3 New Tables to CREATE

```sql
-- Settlement records
CREATE TABLE IF NOT EXISTS settlement_records (
    id SERIAL PRIMARY KEY,
    driver_id INTEGER NOT NULL REFERENCES drivers(id),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    rides_count INTEGER NOT NULL,
    total_fare DECIMAL(10,2) NOT NULL,
    commission_rate DECIMAL(5,2) NOT NULL,
    commission_amount DECIMAL(10,2) NOT NULL,
    previous_balance DECIMAL(10,2) NOT NULL,
    amount_due DECIMAL(10,2) NOT NULL,
    amount_paid DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50),
    receipt_number VARCHAR(100),
    collected_by INTEGER REFERENCES users(id),
    collection_date TIMESTAMP,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Admin audit log
CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id SERIAL PRIMARY KEY,
    admin_id INTEGER NOT NULL REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_id INTEGER NOT NULL,
    details JSONB,
    ip_address VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 7.4 Backward Compatibility

- All new fields are NULLABLE (existing records unaffected)
- New tables don't modify existing tables
- Existing API endpoints remain unchanged
- New endpoints added for Bangladesh-specific features
- USA backend remains functional (fields not required)

---

## APPENDIX A: SMS Templates (Bangladesh)

```
DRIVER_APPROVED:
"SafeGo: Congratulations! Your driver account is approved. Go online now and start earning! Download: [APP_LINK]"

DRIVER_REJECTED:
"SafeGo: Your application was not approved. Reason: [REASON]. You may reapply after resolving the issue. Contact: [SUPPORT]"

SETTLEMENT_DUE:
"SafeGo: Weekly settlement due: [AMOUNT] BDT. Collection: [LOCATION] on [DATE] at [TIME]. Reply YES to confirm."

SETTLEMENT_RECEIVED:
"SafeGo: Payment of [AMOUNT] BDT received. Receipt: [RECEIPT_NO]. Thank you! Current balance: [BALANCE] BDT."

ACCOUNT_SUSPENDED:
"SafeGo: Your account is suspended due to unpaid settlement of [AMOUNT] BDT. Contact [SUPPORT] to resolve immediately."

ACCOUNT_REACTIVATED:
"SafeGo: Your account is now active. Thank you for clearing your balance. You may go online and accept rides."
```

---

## APPENDIX B: Quick Reference Card (For Admin)

### Daily Checklist
- [ ] Check pending driver verifications
- [ ] Review flagged rides
- [ ] Monitor negative balances > 5000 BDT
- [ ] Respond to driver support requests

### Weekly Checklist (Monday)
- [ ] Generate settlement report
- [ ] Contact drivers with settlements due
- [ ] Schedule collection appointments
- [ ] Review previous week unpaid list

### Weekly Checklist (Friday)
- [ ] Complete all collections
- [ ] Process non-payment blocks
- [ ] Update settlement records
- [ ] Prepare next week schedule

---

*End of SOP Document*
