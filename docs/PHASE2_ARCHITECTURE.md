# SafeGo Phase-2 System Architecture

**Version**: 2.0.0  
**Date**: December 2024

---

## High-Level Architecture

```
+==============================================================================+
|                         SAFEGO ENTERPRISE ADMIN PLATFORM                      |
+==============================================================================+
|                                                                               |
|  +-------------------------------------------------------------------------+  |
|  |                           FRONTEND (React 18)                           |  |
|  |  +------------------+  +------------------+  +------------------------+ |  |
|  |  |   Admin Portal   |  |  People Center   |  |   Safety & Risk Center | |  |
|  |  |  - Dashboard     |  |  - KYC Queue     |  |   - Case Management    | |  |
|  |  |  - Analytics     |  |  - Risk Signals  |  |   - Incident Timeline  | |  |
|  |  |  - Settings      |  |  - Duplicates    |  |   - Heat Maps          | |  |
|  |  +------------------+  +------------------+  +------------------------+ |  |
|  |                                                                         |  |
|  |  +------------------+  +------------------+  +------------------------+ |  |
|  |  | Feature Flags UI |  | Notification Ctr |  |    Theme System        | |  |
|  |  | - Flag Groups    |  | - System Alerts  |  |    - Light/Dark        | |  |
|  |  | - Rollout Slider |  | - Risk Alerts    |  |    - Responsive        | |  |
|  |  | - Env Preview    |  | - Payout Alerts  |  |                        | |  |
|  |  +------------------+  +------------------+  +------------------------+ |  |
|  +-------------------------------------------------------------------------+  |
|                                    |                                          |
|                             TanStack Query                                    |
|                                    |                                          |
|  +-------------------------------------------------------------------------+  |
|  |                      API GATEWAY (Express.js)                           |  |
|  |  +-------------------------------------------------------------------+  |  |
|  |  |                     SECURITY MIDDLEWARE STACK                     |  |  |
|  |  |  +-------------+  +---------------+  +-------------------------+  |  |  |
|  |  |  | Auth Guard  |  | RBAC v3       |  | Impersonation Guard     |  |  |  |
|  |  |  | - JWT       |  | - 8 Roles     |  | - VIEW_ONLY Enforcement |  |  |  |
|  |  |  | - Session   |  | - 123 Perms   |  | - Session Tracking      |  |  |  |
|  |  |  +-------------+  +---------------+  +-------------------------+  |  |  |
|  |  |  +-------------+  +---------------+  +-------------------------+  |  |  |
|  |  |  | Lockdown    |  | Rate Limiter  |  | Audit Logger            |  |  |  |
|  |  |  | - Scoped    |  | - Per-Route   |  | - Hash Chain            |  |  |  |
|  |  |  | - Regional  |  | - Per-User    |  | - Tamper-Proof          |  |  |  |
|  |  |  +-------------+  +---------------+  +-------------------------+  |  |  |
|  |  +-------------------------------------------------------------------+  |  |
|  +-------------------------------------------------------------------------+  |
|                                    |                                          |
+==============================================================================+
                                     |
+==============================================================================+
|                         PHASE-2 SERVICE LAYER                                 |
+==============================================================================+
|                                                                               |
|  +---------------------------+  +---------------------------+                 |
|  |   RBAC v3 ENTERPRISE      |  |   GLOBAL AUDIT ENGINE v2  |                 |
|  |  +---------------------+  |  |  +---------------------+  |                 |
|  |  | Permission Bundles  |  |  |  | Audit Event Chain   |  |                 |
|  |  | - Create/Update     |  |  |  | - SHA-256 Hashing   |  |                 |
|  |  | - Assign/Revoke     |  |  |  | - Integrity Verify  |  |                 |
|  |  +---------------------+  |  |  +---------------------+  |                 |
|  |  +---------------------+  |  |  +---------------------+  |                 |
|  |  | Emergency Lockdown  |  |  |  | Evidence Packets    |  |                 |
|  |  | - GLOBAL (Super)    |  |  |  | - Bundle Creation   |  |                 |
|  |  | - COUNTRY (Regional)|  |  |  | - Status Tracking   |  |                 |
|  |  | - SERVICE (Type)    |  |  |  +---------------------+  |                 |
|  |  +---------------------+  |  |  +---------------------+  |                 |
|  |  +---------------------+  |  |  | Regulator Export    |  |                 |
|  |  | Admin Impersonation |  |  |  | - PDF Generation    |  |                 |
|  |  | - VIEW_ONLY Mode    |  |  |  | - CSV Generation    |  |                 |
|  |  | - FULL_ACCESS Mode  |  |  |  | - Queue Processing  |  |                 |
|  |  +---------------------+  |  |  +---------------------+  |                 |
|  |  +---------------------+  |  +---------------------------+                 |
|  |  | Secure Messaging    |  |                                                |
|  |  | - Encrypted Comms   |  |                                                |
|  |  | - Broadcast         |  |                                                |
|  |  +---------------------+  |                                                |
|  +---------------------------+                                                |
|                                                                               |
|  +-----------------------------------------------------------------------+   |
|  |                    PEOPLE & KYC CENTER v2                             |   |
|  |  +-------------------+  +-------------------+  +-------------------+  |   |
|  |  | KYC Review Queue  |  | Identity Risk     |  | Duplicate         |  |   |
|  |  | - SLA Tracking    |  | Signals           |  | Detection         |  |   |
|  |  | - Assignment      |  | - AUTO/MANUAL     |  | - Cluster Match   |  |   |
|  |  | - Escalation      |  | - Severity Score  |  | - Merge/Dismiss   |  |   |
|  |  | - Priority Mgmt   |  | - Resolution      |  | - False Positive  |  |   |
|  |  +-------------------+  +-------------------+  +-------------------+  |   |
|  |  +-------------------+  +-------------------+                         |   |
|  |  | Suspicious        |  | Enforcement       |                         |   |
|  |  | Activity          |  | Rules             |                         |   |
|  |  | - Flag Types      |  | - Per-Country     |                         |   |
|  |  | - Resolution      |  | - Per-Role        |                         |   |
|  |  | - Severity        |  | - Doc Requirements|                         |   |
|  |  +-------------------+  +-------------------+                         |   |
|  +-----------------------------------------------------------------------+   |
|                                                                               |
+==============================================================================+
                                     |
+==============================================================================+
|                              DATA LAYER                                       |
+==============================================================================+
|                                                                               |
|  +---------------------------+  +---------------------------+                 |
|  |     POSTGRESQL (Neon)     |  |     PRISMA ORM (v6)       |                 |
|  |  +---------------------+  |  |  +---------------------+  |                 |
|  |  | Phase-2 Models      |  |  |  | Type-Safe Queries   |  |                 |
|  |  | - 12 New Tables     |  |  |  | - Auto Migrations   |  |                 |
|  |  | - 239 Total Models  |  |  |  | - Relation Mapping  |  |                 |
|  |  +---------------------+  |  |  +---------------------+  |                 |
|  +---------------------------+  +---------------------------+                 |
|                                                                               |
+==============================================================================+
```

---

## RBAC v3 Permission Flow

```
+-------------------+     +-------------------+     +-------------------+
|   Admin Request   | --> | Auth Middleware   | --> | RBAC Check        |
+-------------------+     +-------------------+     +-------------------+
                                                            |
                          +----------------------------------+
                          |
                          v
+-------------------+     +-------------------+     +-------------------+
| Check Role        | --> | Check Permissions | --> | Check Bundles     |
| (8 Admin Roles)   |     | (123 Permissions) |     | (Custom Sets)     |
+-------------------+     +-------------------+     +-------------------+
                                                            |
                          +----------------------------------+
                          |
                          v
+-------------------+     +-------------------+     +-------------------+
| Impersonation     | --> | Emergency         | --> | Process Request   |
| Guard             |     | Lockdown Check    |     | or Reject         |
+-------------------+     +-------------------+     +-------------------+
```

---

## Emergency Lockdown Scoping

```
                    +-------------------------+
                    |      SUPER_ADMIN        |
                    |  Can activate ALL       |
                    |  lockdown scopes        |
                    +-------------------------+
                              |
            +-----------------+-----------------+
            |                 |                 |
            v                 v                 v
    +-------------+   +-------------+   +-------------+
    |   GLOBAL    |   |   SERVICE   |   |   COUNTRY   |
    | Full platform|   | Ride/Food/ |   | Single      |
    | lockdown    |   | Parcel only |   | country     |
    +-------------+   +-------------+   +-------------+
                                              |
                                              v
                                    +-------------------+
                                    |  COUNTRY_ADMIN    |
                                    |  Own country only |
                                    +-------------------+
                                              |
                                              v
                                    +-------------------+
                                    | COUNTRY_SERVICE   |
                                    | Own country +     |
                                    | specific service  |
                                    +-------------------+
```

---

## Audit Event Chain

```
+-------------------+     +-------------------+     +-------------------+
|   Event #1        | --> |   Event #2        | --> |   Event #3        |
| hash: abc123...   |     | hash: def456...   |     | hash: ghi789...   |
| prevHash: null    |     | prevHash: abc123  |     | prevHash: def456  |
+-------------------+     +-------------------+     +-------------------+
                                                            |
                                                            v
                                                  +-------------------+
                                                  | Integrity Check   |
                                                  | Recalculate hash  |
                                                  | Compare chains    |
                                                  | Detect tampering  |
                                                  +-------------------+
```

---

## KYC Review Queue Flow

```
+-------------------+     +-------------------+     +-------------------+
|  Document        | --> |  Queue Entry      | --> |  SLA Timer        |
|  Submitted       |     |  Created          |     |  Started          |
+-------------------+     +-------------------+     +-------------------+
        |                         |                         |
        |                         v                         |
        |                 +---------------+                 |
        |                 |  PENDING      |                 |
        |                 +---------------+                 |
        |                         |                         |
        |                         v                         |
        |                 +---------------+                 |
        |                 | Admin Assigned|                 |
        |                 +---------------+                 |
        |                         |                         |
        |            +------------+------------+            |
        |            |                         |            |
        v            v                         v            v
+---------------+  +---------------+  +---------------+  +---------------+
|   APPROVED    |  |   REJECTED    |  |   ESCALATED   |  |   ON_HOLD     |
+---------------+  +---------------+  +---------------+  +---------------+
```

---

## Phase-2 Database Schema

```
+----------------------+     +----------------------+     +----------------------+
| PermissionBundle     |     | EmergencyLockdown    |     | AdminImpersonation   |
|----------------------|     |----------------------|     |   Session            |
| id: UUID             |     | id: UUID             |     |----------------------|
| name: String         |     | level: Enum          |     | id: UUID             |
| description: String  |     | scope: Enum          |     | impersonatorId: UUID |
| permissions: String[]|     | reason: String       |     | targetAdminId: UUID  |
| isActive: Boolean    |     | lockedFeatures: []   |     | mode: Enum           |
| createdBy: UUID      |     | countryCode: String  |     | isActive: Boolean    |
| createdAt: DateTime  |     | serviceType: String  |     | startedAt: DateTime  |
+----------------------+     | activatedBy: UUID    |     | endedAt: DateTime    |
                             | isActive: Boolean    |     +----------------------+
                             +----------------------+

+----------------------+     +----------------------+     +----------------------+
| AuditEventChain      |     | EvidencePacket       |     | RegulatorExportQueue |
|----------------------|     |----------------------|     |----------------------|
| id: UUID             |     | id: UUID             |     | id: UUID             |
| eventHash: String    |     | caseId: String       |     | exportType: Enum     |
| previousHash: String |     | title: String        |     | format: Enum         |
| eventType: String    |     | description: String  |     | status: Enum         |
| actorId: UUID        |     | auditEventIds: []    |     | requestedBy: UUID    |
| entityType: String   |     | status: Enum         |     | dateRange: JSON      |
| entityId: String     |     | createdBy: UUID      |     | filePath: String     |
| metadata: JSON       |     | createdAt: DateTime  |     | completedAt: DateTime|
| ipAddress: String    |     +----------------------+     +----------------------+
| timestamp: DateTime  |
+----------------------+

+----------------------+     +----------------------+     +----------------------+
| KycReviewQueue       |     | IdentityRiskSignal   |     | DuplicateAccount     |
|----------------------|     |----------------------|     |   Cluster            |
| id: UUID             |     | id: UUID             |     |----------------------|
| userId: UUID         |     | userId: UUID         |     | id: UUID             |
| userType: String     |     | signalType: Enum     |     | accountIds: String[] |
| documentType: String |     | severity: Enum       |     | matchType: Enum      |
| countryCode: String  |     | source: Enum         |     | riskLevel: Enum      |
| priority: Enum       |     | description: String  |     | status: Enum         |
| status: Enum         |     | isResolved: Boolean  |     | primaryAccountId: UUID|
| assignedAdminId: UUID|     | resolvedBy: UUID     |     | detectedAt: DateTime |
| slaDeadline: DateTime|     | resolvedAt: DateTime |     | mergedAt: DateTime   |
+----------------------+     +----------------------+     +----------------------+

+----------------------+     +----------------------+
| SuspiciousActivity   |     | KycEnforcementRule   |
|   Flag               |     |----------------------|
|----------------------|     | id: UUID             |
| id: UUID             |     | countryCode: String  |
| userId: UUID         |     | userRole: String     |
| flagType: Enum       |     | requiredDocs: String[]|
| severity: Enum       |     | verificationLevel: Enum|
| description: String  |     | gracePeriodDays: Int |
| evidenceIds: String[]|     | isActive: Boolean    |
| status: Enum         |     | createdAt: DateTime  |
| resolvedBy: UUID     |     +----------------------+
| resolvedAt: DateTime |
+----------------------+
```

---

## Security Architecture

```
+==============================================================================+
|                           SECURITY LAYERS                                     |
+==============================================================================+
|                                                                               |
|  Layer 1: Authentication                                                      |
|  +-----------------------------------------------------------------------+   |
|  | JWT Token / Session Cookie | 2FA Verification | Device Binding        |   |
|  +-----------------------------------------------------------------------+   |
|                                                                               |
|  Layer 2: Authorization (RBAC v3)                                            |
|  +-----------------------------------------------------------------------+   |
|  | Role Check | Permission Check | Bundle Check | Country Scope          |   |
|  +-----------------------------------------------------------------------+   |
|                                                                               |
|  Layer 3: Context Guards                                                      |
|  +-----------------------------------------------------------------------+   |
|  | Impersonation VIEW_ONLY | Emergency Lockdown | Rate Limiting          |   |
|  +-----------------------------------------------------------------------+   |
|                                                                               |
|  Layer 4: Audit & Compliance                                                  |
|  +-----------------------------------------------------------------------+   |
|  | Hash Chain Logging | Evidence Packets | Regulator Exports             |   |
|  +-----------------------------------------------------------------------+   |
|                                                                               |
+==============================================================================+
```

---

## Integration Points

| External Service | Integration | Purpose |
|-----------------|-------------|---------|
| PostgreSQL (Neon) | Direct via Prisma | Primary database |
| Stripe | Webhook + API | Payment processing |
| Google Maps | JavaScript API | Location services |
| Twilio | REST API | SMS OTP |
| AWS S3 | SDK | Document storage |
| FCM | Push API | Mobile notifications |

---

## Performance Metrics

| Metric | Target | Current |
|--------|--------|---------|
| API Response Time | < 200ms | ~150ms |
| Database Query Time | < 50ms | ~30ms |
| Concurrent Users | 10,000 | Supported |
| Audit Log Throughput | 1000/sec | Tested |
| Uptime SLA | 99.9% | Maintained |
