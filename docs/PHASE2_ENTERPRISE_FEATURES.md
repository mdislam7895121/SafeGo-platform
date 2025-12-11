# SafeGo Phase-2 Enterprise Admin Features

**Version**: 2.0.0  
**Release Date**: December 2024  
**Status**: Production Ready

---

## Table of Contents

1. [Overview](#overview)
2. [RBAC v3 Enterprise Framework](#rbac-v3-enterprise-framework)
3. [Global Audit Engine v2](#global-audit-engine-v2)
4. [People & KYC Center v2](#people--kyc-center-v2)
5. [API Reference](#api-reference)
6. [Security Model](#security-model)
7. [Database Schema](#database-schema)

---

## Overview

Phase-2 introduces enterprise-grade admin governance, tamper-proof auditing, and advanced KYC capabilities to the SafeGo platform. Building on the 8-role RBAC v2 system, Phase-2 adds:

- **Permission Bundles**: Pre-defined permission sets for streamlined role management
- **Emergency Lockdown Controls**: Scoped lockdown system with regional restrictions
- **Admin Impersonation Mode**: Secure debugging with VIEW_ONLY enforcement
- **Global Audit Engine v2**: Tamper-proof logging with hash chain verification
- **Advanced KYC Workflows**: Queue management, risk signals, duplicate detection

---

## RBAC v3 Enterprise Framework

### Permission Bundles

Permission bundles allow administrators to create reusable sets of permissions that can be assigned to multiple admins.

**Endpoints:**
| Method | Endpoint | Permission Required |
|--------|----------|---------------------|
| GET | `/api/admin-phase2/permission-bundles` | VIEW_PERMISSION_BUNDLES |
| POST | `/api/admin-phase2/permission-bundles` | MANAGE_PERMISSION_BUNDLES |
| PUT | `/api/admin-phase2/permission-bundles/:id` | MANAGE_PERMISSION_BUNDLES |
| DELETE | `/api/admin-phase2/permission-bundles/:id` | MANAGE_PERMISSION_BUNDLES |
| POST | `/api/admin-phase2/permission-bundles/:id/assign` | ASSIGN_PERMISSION_BUNDLES |
| POST | `/api/admin-phase2/permission-bundles/:id/revoke` | ASSIGN_PERMISSION_BUNDLES |

**Example Bundle:**
```json
{
  "name": "KYC Reviewer",
  "description": "Standard permissions for KYC document reviewers",
  "permissions": [
    "VIEW_PEOPLE_CENTER",
    "MANAGE_PEOPLE_CENTER",
    "VIEW_KYC_REVIEW_QUEUE",
    "PROCESS_KYC_QUEUE"
  ],
  "isActive": true
}
```

### Emergency Lockdown Controls

Scoped lockdown system that can restrict platform access at different levels.

**Lockdown Scopes:**
| Scope | Description | Required Role |
|-------|-------------|---------------|
| GLOBAL | Entire platform | SUPER_ADMIN only |
| COUNTRY | Single country | COUNTRY_ADMIN or higher |
| SERVICE | Single service type | SUPER_ADMIN only |
| COUNTRY_SERVICE | Country + Service | COUNTRY_ADMIN (own country) |

**Endpoints:**
| Method | Endpoint | Permission Required |
|--------|----------|---------------------|
| GET | `/api/admin-phase2/emergency/status` | VIEW_EMERGENCY_STATUS |
| GET | `/api/admin-phase2/emergency/history` | VIEW_EMERGENCY_STATUS |
| POST | `/api/admin-phase2/emergency/activate` | ACTIVATE_EMERGENCY_LOCKDOWN |
| POST | `/api/admin-phase2/emergency/deactivate/:id` | DEACTIVATE_EMERGENCY_LOCKDOWN |

**Security Enforcement:**
- Non-SUPER_ADMIN cannot activate GLOBAL lockdowns
- COUNTRY_ADMIN can only lockdown their assigned country
- All lockdown actions are audit-logged

### Admin Impersonation Mode

Allows privileged admins to view the platform as another user for debugging purposes.

**Impersonation Modes:**
| Mode | Description | Allowed Actions |
|------|-------------|-----------------|
| VIEW_ONLY | Read-only access | GET requests only |
| FULL_ACCESS | Full impersonation | All actions (SUPER_ADMIN only) |

**Security Enforcement:**
- VIEW_ONLY mode blocks all POST/PUT/PATCH/DELETE requests at middleware level
- All impersonation sessions are logged with full audit trail
- Sessions can be revoked at any time

**Endpoints:**
| Method | Endpoint | Permission Required |
|--------|----------|---------------------|
| POST | `/api/admin-phase2/impersonation/start` | IMPERSONATE_ADMIN |
| POST | `/api/admin-phase2/impersonation/end` | IMPERSONATE_ADMIN |
| GET | `/api/admin-phase2/impersonation/active` | VIEW_IMPERSONATION_LOGS |
| GET | `/api/admin-phase2/impersonation/logs` | VIEW_IMPERSONATION_LOGS |

### Secure Internal Messaging

Encrypted admin-to-admin communication system.

**Endpoints:**
| Method | Endpoint | Permission Required |
|--------|----------|---------------------|
| GET | `/api/admin-phase2/messaging/inbox` | VIEW_ADMIN_MESSAGES |
| POST | `/api/admin-phase2/messaging/send` | SEND_ADMIN_MESSAGE |
| POST | `/api/admin-phase2/messaging/broadcast` | BROADCAST_ADMIN_MESSAGE |
| PATCH | `/api/admin-phase2/messaging/:id/read` | VIEW_ADMIN_MESSAGES |

---

## Global Audit Engine v2

### Audit Event Chain

Tamper-proof logging system using hash chain verification.

**Features:**
- SHA-256 hash chain linking all audit events
- Previous hash reference for integrity verification
- Comprehensive metadata capture
- IP address and device tracking

**Endpoints:**
| Method | Endpoint | Permission Required |
|--------|----------|---------------------|
| GET | `/api/admin-phase2/audit/chain` | VIEW_AUDIT_CHAIN |
| POST | `/api/admin-phase2/audit/verify` | VERIFY_AUDIT_INTEGRITY |

### Evidence Packets

Bundled documentation system for investigations.

**Endpoints:**
| Method | Endpoint | Permission Required |
|--------|----------|---------------------|
| GET | `/api/admin-phase2/audit/evidence-packets` | VIEW_EVIDENCE_PACKETS |
| POST | `/api/admin-phase2/audit/evidence-packets` | GENERATE_EVIDENCE_PACKET |
| GET | `/api/admin-phase2/audit/evidence-packets/:id` | VIEW_EVIDENCE_PACKETS |
| PATCH | `/api/admin-phase2/audit/evidence-packets/:id/status` | GENERATE_EVIDENCE_PACKET |

### Regulator Export Mode

Queue-based export system for regulatory compliance reports.

**Export Formats:** PDF, CSV

**Endpoints:**
| Method | Endpoint | Permission Required |
|--------|----------|---------------------|
| POST | `/api/admin-phase2/audit/regulator-export` | EXPORT_REGULATOR_REPORT |
| GET | `/api/admin-phase2/audit/regulator-exports` | MANAGE_REGULATOR_EXPORTS |
| GET | `/api/admin-phase2/audit/regulator-exports/:id/download` | MANAGE_REGULATOR_EXPORTS |

---

## People & KYC Center v2

### KYC Review Queue

SLA-tracked queue with assignment, escalation, and priority management.

**Queue Statuses:**
- PENDING - Awaiting review
- IN_PROGRESS - Currently being reviewed
- APPROVED - Review completed, approved
- REJECTED - Review completed, rejected
- ESCALATED - Escalated to senior reviewer
- ON_HOLD - Temporarily paused

**Endpoints:**
| Method | Endpoint | Permission Required |
|--------|----------|---------------------|
| GET | `/api/admin-phase2/kyc/queue` | VIEW_KYC_REVIEW_QUEUE |
| GET | `/api/admin-phase2/kyc/queue/:id` | VIEW_KYC_REVIEW_QUEUE |
| POST | `/api/admin-phase2/kyc/queue/assign` | BULK_KYC_OPERATIONS |
| POST | `/api/admin-phase2/kyc/queue/complete` | MANAGE_PEOPLE_CENTER |
| POST | `/api/admin-phase2/kyc/queue/escalate` | MANAGE_PEOPLE_CENTER |
| GET | `/api/admin-phase2/kyc/queue/stats` | VIEW_PEOPLE_CENTER |

### Identity Risk Signals

Automated and manual risk signal creation with severity scoring.

**Signal Types:**
- DOCUMENT_FRAUD - Suspected fraudulent documents
- IDENTITY_MISMATCH - Name/photo mismatch
- VELOCITY_ALERT - Unusual activity patterns
- BLACKLIST_MATCH - Match against known fraud list
- MANUAL_FLAG - Manually flagged by reviewer

**Severity Levels:** LOW, MEDIUM, HIGH, CRITICAL

**Endpoints:**
| Method | Endpoint | Permission Required |
|--------|----------|---------------------|
| GET | `/api/admin-phase2/kyc/risk-signals` | VIEW_IDENTITY_RISK_SCORES |
| POST | `/api/admin-phase2/kyc/risk-signals` | MANAGE_IDENTITY_RISK_SIGNALS |
| POST | `/api/admin-phase2/kyc/risk-signals/resolve` | RESOLVE_RISK_CASES |

### Duplicate Account Detection

Account cluster detection with merge/dismiss workflows.

**Match Types:**
- PHONE_MATCH - Same phone number
- EMAIL_MATCH - Same email address
- DEVICE_MATCH - Same device fingerprint
- DOCUMENT_MATCH - Same ID document
- FACIAL_MATCH - Facial recognition match

**Endpoints:**
| Method | Endpoint | Permission Required |
|--------|----------|---------------------|
| GET | `/api/admin-phase2/kyc/duplicates` | VIEW_DUPLICATE_ACCOUNTS |
| POST | `/api/admin-phase2/kyc/duplicates/merge` | BULK_KYC_OPERATIONS |
| POST | `/api/admin-phase2/kyc/duplicates/dismiss` | MANAGE_PEOPLE_CENTER |

### Suspicious Activity Flagging

Multi-type flagging system with resolution tracking.

**Flag Types:**
- UNUSUAL_PATTERN - Unusual behavior patterns
- FRAUDULENT_ACTIVITY - Suspected fraud
- POLICY_VIOLATION - Terms of service violation
- IDENTITY_CONCERN - Identity-related concerns

**Endpoints:**
| Method | Endpoint | Permission Required |
|--------|----------|---------------------|
| GET | `/api/admin-phase2/kyc/suspicious-activity` | VIEW_SUSPICIOUS_ACTIVITY |
| POST | `/api/admin-phase2/kyc/suspicious-activity` | MANAGE_SUSPICIOUS_ACTIVITY |
| POST | `/api/admin-phase2/kyc/suspicious-activity/:id/resolve` | RESOLVE_RISK_CASES |

### Country-Specific Enforcement Rules

Configurable document requirements and verification levels per country/role.

**Endpoints:**
| Method | Endpoint | Permission Required |
|--------|----------|---------------------|
| GET | `/api/admin-phase2/kyc/enforcement-rules` | VIEW_SYSTEM_CONFIG |
| POST | `/api/admin-phase2/kyc/enforcement-rules` | MANAGE_SYSTEM_CONFIG |
| PUT | `/api/admin-phase2/kyc/enforcement-rules/:id` | MANAGE_SYSTEM_CONFIG |

---

## API Reference

### Authentication

All Phase-2 endpoints require authentication via session cookie or JWT token.

```
Authorization: Bearer <jwt_token>
```

### Error Responses

| Status Code | Description |
|-------------|-------------|
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Authentication required |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 500 | Internal Server Error |

### Pagination

All list endpoints support pagination:

```
?page=1&limit=20
```

Response includes:
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

---

## Security Model

### Middleware Stack

1. **Authentication** - Verifies user identity
2. **Authorization** - Checks role/permission
3. **Impersonation Guard** - Blocks mutations in VIEW_ONLY mode
4. **Emergency Lockdown** - Respects active lockdowns
5. **Audit Logging** - Records all actions

### Impersonation Protection

```typescript
// Middleware blocks all mutations when impersonating in VIEW_ONLY mode
if (session.impersonationMode === 'VIEW_ONLY') {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return res.status(403).json({
      error: 'Mutations blocked in VIEW_ONLY impersonation mode'
    });
  }
}
```

### Emergency Lockdown Scoping

```typescript
// Only SUPER_ADMIN can activate GLOBAL lockdowns
if (data.scope === 'GLOBAL' && userRole !== 'SUPER_ADMIN') {
  return res.status(403).json({
    error: 'Only SUPER_ADMIN can activate GLOBAL lockdowns'
  });
}

// COUNTRY_ADMIN can only lock their own country
if (data.countryCode !== userCountry) {
  return res.status(403).json({
    error: 'You can only activate lockdowns for your assigned country'
  });
}
```

---

## Database Schema

### New Phase-2 Models

| Model | Purpose |
|-------|---------|
| PermissionBundle | Reusable permission sets |
| AdminPermissionBundleAssignment | Bundle-to-admin mappings |
| EmergencyLockdown | Platform lockdown records |
| AdminImpersonationSession | Impersonation audit trail |
| SecureAdminMessage | Encrypted admin messages |
| AuditEventChain | Tamper-proof audit logs |
| EvidencePacket | Investigation bundles |
| RegulatorExportQueue | Export job queue |
| KycReviewQueue | SLA-tracked KYC queue |
| IdentityRiskSignal | Risk signal records |
| DuplicateAccountCluster | Duplicate detection |
| SuspiciousActivityFlag | Suspicious activity flags |
| KycEnforcementRule | Country-specific rules |

---

## Changelog

### v2.0.0 (December 2024)
- Initial Phase-2 release
- RBAC v3 Enterprise Framework
- Global Audit Engine v2
- People & KYC Center v2
- 44 new API endpoints
- 41 new permissions
- 12 new database models
