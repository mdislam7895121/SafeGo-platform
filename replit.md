# SafeGo Global Super-App

## Overview
SafeGo is a production-ready, full-stack multi-service super-app platform designed for global on-demand services such as ride-hailing, food delivery, and parcel delivery. Its purpose is to capture a significant market share by offering a scalable, secure, and feature-rich solution. Key capabilities include multi-role authentication, country-specific KYC, commission tracking, service lifecycle management, unified payment/payout systems, and comprehensive driver identity management.

## User Preferences
Preferred communication style: Simple, everyday language.
Development approach: Full-stack TypeScript with modern tooling, emphasizing code quality, security, and scalability.

## System Architecture
The frontend is built with React 18, TypeScript, Vite 5, shadcn/ui, Tailwind CSS 3, TanStack Query v5, wouter, and React Hook Form with Zod, incorporating a custom HSL color palette, Inter/Manrope typography, mobile-first responsive design, and WCAG 2.1 AA compliance. The backend uses Node.js 20+, TypeScript, Express.js 4, and Prisma Client 6 with PostgreSQL 14+, employing a Generic Service Layer with Role Adapters.

**Key Architectural and Feature Highlights:**

*   **Admin Capabilities**: Interactive panel for dashboards, document management, wallet settlement, and global analytics.
*   **Security & Compliance**: Implements HTTP security headers, rate limiting, 2FA, device/session security, AES-256-GCM encryption, tamper-proof audit logs, Customer Account Lockout, phone masking, proxy calling, enhanced SOS, route deviation detection, device binding, admin 2FA, IP whitelisting, activity monitoring, developer access control with mTLS, and payout audit trails.
*   **Financial Systems**: Comprehensive Wallet & Earnings, Tax & Fees, and Unified Payout systems, managing commissions, negative balances, multi-country taxes, and enterprise-grade payment/payout rails.
*   **Customer & Partner Onboarding**: Features Uber-level profiles, multi-step onboarding, country-specific KYC, real-time ID verification, background checks, and facial recognition.
*   **Service Offerings**:
    *   **Food Delivery**: Includes Restaurant Management Systems, a Unified Eats Experience, and Driver Food Delivery Flow.
    *   **Ride-Hailing**: Provides Rider Ride-Booking Flow (map integration, real-time tracking), Multi-Route Fare Engine, Multi-Category Vehicle System, and Driver Active Ride Workflow.
    *   **Parcel Delivery**: Supports scheduled pickup, Proof-of-Delivery photos, and size/weight-based dynamic pricing.
*   **Loyalty & Incentives**: Integrates a SafeGo Points System, Opportunity Bonus Management System, and Driver Incentive Engine.
*   **Real-Time & Optimization**: Features an AI Marketplace Balancer, Real-Time Dispatch System (WebSocket-based, proximity matching), and Experience Intelligence with real-time ETA refinement, dynamic routing optimization, and smart personalized push notifications.
*   **Profit-Focused Automation Systems**: A suite of 32 services with comprehensive admin visibility, covering:
    *   **Core Automation**: Auto Assignment Engine, Surge Pricing Automation, Auto Settlement Service, Recommendation Engine, Dynamic Pricing Service, Performance Scoring Service, Auto Cancellation Service, and Auto Payout Service.
    *   **Security & Fraud Prevention**: Fraud Detection Automation, Login Security Automation, High Risk Activity Automation, Customer Abuse Automation, Partner Fraud Automation, Customer Payment Scoring, and Partner Risk Monitoring.
    *   **Risk Intelligence**: Order Success Prediction, Driver Fatigue Detection, Demand Sensing, and Traffic ETA Correction.
    *   **Experience Optimization**: Inventory Forecasting, Repeat Purchase Trigger, Negative Review Recovery, Seasonal Intelligence, Refund Optimization, and Marketing Budget Optimization.
    *   **Platform Operations**: Server Scaling Automation, DevOps Deployment Pipeline, Employee Productivity Dashboard, and System Monitoring Automation.
*   **Regional Expansion**: Supports specific roles and KYC requirements for Bangladesh (SafeGo Shop Partner, SafeGo Ticket & Rental Operator) with Bangla UX and error messages.
*   **Regulatory Compliance**: Adheres to NYC TLC regulatory compliance including minimum pay enforcement, fees, surcharges, tolls, and report generation.
*   **API Design**: Robust API endpoints with enforcement of KYC, ownership validation, Zod schema validation, atomic transactions, and consistent error handling.
*   **Database Schema**: Utilizes UUID primary keys, indexed foreign keys, decimal types for monetary values, and comprehensive models for all core features and settings.

## External Dependencies

*   **Backend Core**: `@prisma/client`, `express`, `bcrypt`, `jsonwebtoken`, `@neondatabase/serverless`.
*   **Frontend Core**: `react`, `react-dom`, `wouter`, `@tanstack/react-query`, `react-hook-form`, `zod`.
*   **UI Components**: `@radix-ui/*`, `lucide-react`, `class-variance-authority`, `tailwind-merge`, `clsx`.
*   **Third-party Services**: Twilio (SMS OTP), AgentMail (Email OTP), Stripe (payment gateway), Google Maps Platform (Maps JavaScript API, Places API, Directions API, Geocoding API), bKash, Nagad, Checkr, AWS Rekognition, Persona/Onfido.

## Admin Panel Gap Analysis (December 2024)

**Full analysis document:** `docs/ADMIN_GAP_ANALYSIS.md`

### Current Coverage: ~40% of Uber-Level Capabilities

**What Exists:**
- Basic user management (drivers, customers, restaurants, BD partners)
- Basic KYC approval (single document at a time)
- Wallet view and manual settlement
- Payout requests and manual processing
- Analytics and monitoring dashboards
- Fraud alerts and security center
- Activity/audit logging
- Basic settings configuration

**Critical Missing Features:**
1. **People & KYC Center** - No unified search, bulk operations, queue management, SLA tracking
2. **Pricing Engine** - No visual surge zone editor, fare builder, promotion/coupon manager
3. **Safety Center** - No SOS monitoring panel, incident workflow, driver fatigue dashboard
4. **Support & Refund Center** - No ticket system, refund queue, escalation management
5. **Policy & Legal Center** - No TOS/PP versioning, consent tracking, compliance checklists
6. **Feature Flags UI** - No admin interface for toggling features, A/B tests
7. **Admin RBAC** - No admin user creation, role assignment UI, IP whitelist management

**Implementation Priority:**
- Phase 1 (Critical): People/KYC Center, Safety Center, Feature Flags ✅ COMPLETED
- Phase 2 (High): Pricing Engine, Support/Refund Center, Admin RBAC
- Phase 3 (Medium): Wallet Console, Country Config, Policy/Legal
- Phase 4 (Enhancement): Advanced analytics, Automation Dashboard

## RBAC v2 Implementation (December 2024)

### 8 Admin Role System
The platform now implements comprehensive Role-Based Access Control with 8 distinct admin roles:

| Role | Description | Key Permissions |
|------|-------------|-----------------|
| SUPER_ADMIN | Full system access | All permissions |
| ADMIN | General management | View-only access to most areas |
| COUNTRY_ADMIN | Regional operations | KYC, settlements, regional analytics |
| CITY_ADMIN | City-level management | Local operations, basic monitoring |
| COMPLIANCE_ADMIN | KYC & Legal | Full KYC/People center, fraud management |
| SUPPORT_ADMIN | Customer support | Disputes, refunds, escalations |
| FINANCE_ADMIN | Financial operations | Wallets, payouts, commissions |
| RISK_ADMIN | Safety & Security | Risk cases, safety alerts, fraud monitoring |
| READONLY_ADMIN | View-only access | Read-only on all features |

### New Permissions (19 added)
- **Risk Center**: VIEW_RISK_CENTER, MANAGE_RISK_CASES, RESOLVE_RISK_CASES
- **Safety Center**: VIEW_SAFETY_EVENTS, MANAGE_SAFETY_ALERTS, BLOCK_USER_SAFETY
- **Feature Flags**: VIEW_FEATURE_FLAGS, MANAGE_FEATURE_FLAGS
- **System Config**: VIEW_SYSTEM_CONFIG, MANAGE_SYSTEM_CONFIG
- **People Center**: VIEW_PEOPLE_CENTER, MANAGE_PEOPLE_CENTER, BULK_KYC_OPERATIONS
- **Disputes**: VIEW_DISPUTES, MANAGE_DISPUTES, PROCESS_REFUNDS, ESCALATE_DISPUTES
- **Notifications**: SEND_BROADCAST, MANAGE_NOTIFICATIONS

### Key Files
- `server/utils/permissions.ts` - Permission enum and role mappings
- `server/middleware/authz.ts` - Authorization middleware (checkPermission, checkAnyPermission, checkAllPermissions, checkAdminRole)
- `server/routes/admin-phase1.ts` - Phase 1 admin routes with RBAC protection
- `client/src/hooks/useAdminCapabilities.ts` - Frontend capabilities hook
- `client/src/components/admin/AdminSidebar.tsx` - Role-aware navigation

### API Endpoints
- `GET /api/admin-phase1/capabilities` - Returns current admin's role, permissions, navigation access, and action capabilities

## RBAC v3 & Phase-2 Enterprise Features (December 2024)

### Phase-2 Enhancements Overview
Building on RBAC v2, Phase-2 introduces enterprise-grade admin governance, tamper-proof auditing, and advanced KYC capabilities:

**1. RBAC v3 Enterprise Admin Permission Framework**
- **Permission Bundles**: Pre-defined permission sets (e.g., "KYC Reviewer", "Finance Analyst") that can be assigned to admins for streamlined role management
- **Emergency Lockdown Controls**: Scoped lockdown system (GLOBAL, COUNTRY, SERVICE, COUNTRY_SERVICE) with proper authorization - only SUPER_ADMIN can activate GLOBAL lockdowns
- **Admin Impersonation Mode**: View-only mode for debugging user issues with full audit trail; server-side enforcement blocks all mutating operations
- **Secure Internal Messaging**: Encrypted admin-to-admin communication with broadcast capability

**2. Global Audit Engine v2**
- **Audit Event Chain**: Tamper-proof logging with hash chain verification across all admin actions
- **Evidence Packets**: Bundled documentation for investigations with status tracking
- **Regulator Export Mode**: PDF/CSV export capability for regulatory compliance with queue-based processing

**3. People & KYC Center Phase-2**
- **KYC Review Queue**: SLA-tracked queue with assignment, escalation, and priority management
- **Identity Risk Signals**: Automated and manual risk signal creation with severity scoring
- **Duplicate Detection**: Account cluster detection with merge/dismiss workflows
- **Suspicious Activity Flagging**: Multi-type flagging system with resolution tracking
- **Country-specific Enforcement Rules**: Configurable document requirements, verification levels, and grace periods per country/role

### New Permissions (22 added in Phase-2)
- **Permission Bundles**: VIEW_PERMISSION_BUNDLES, MANAGE_PERMISSION_BUNDLES, ASSIGN_PERMISSION_BUNDLES
- **Emergency Controls**: VIEW_EMERGENCY_STATUS, ACTIVATE_EMERGENCY_LOCKDOWN, DEACTIVATE_EMERGENCY_LOCKDOWN
- **Impersonation**: IMPERSONATE_USER, VIEW_IMPERSONATION_LOGS
- **Secure Messaging**: SEND_SECURE_MESSAGE, READ_SECURE_MESSAGE, BROADCAST_ADMIN_MESSAGE
- **Audit Engine**: VIEW_AUDIT_CHAIN, VERIFY_AUDIT_INTEGRITY, CREATE_EVIDENCE_PACKET, EXPORT_REGULATOR_REPORT
- **Advanced People Center**: VIEW_RISK_SIGNALS, MANAGE_RISK_SIGNALS, VIEW_DUPLICATE_ACCOUNTS, MANAGE_DUPLICATE_ACCOUNTS, VIEW_SUSPICIOUS_ACTIVITY, MANAGE_SUSPICIOUS_ACTIVITY

### Key Files (Phase-2)
- `server/routes/admin-phase2.ts` - All Phase-2 API endpoints
- `server/middleware/authz.ts` - Impersonation enforcement (enforceImpersonationViewOnly) and lockdown checking (checkEmergencyLockdown)
- `prisma/schema.prisma` - 12 new models for Phase-2 features

### API Endpoints (Phase-2)
- **Permission Bundles**: `/api/admin-phase2/permission-bundles/*`
- **Emergency Lockdown**: `/api/admin-phase2/emergency/*`
- **Impersonation**: `/api/admin-phase2/impersonation/*`
- **Secure Messaging**: `/api/admin-phase2/messaging/*`
- **Audit Engine**: `/api/admin-phase2/audit/*`
- **KYC Queue**: `/api/admin-phase2/kyc/queue/*`
- **Risk Signals**: `/api/admin-phase2/kyc/risk-signals/*`
- **Duplicates**: `/api/admin-phase2/kyc/duplicates/*`
- **Suspicious Activity**: `/api/admin-phase2/kyc/suspicious-activity/*`
- **Enforcement Rules**: `/api/admin-phase2/kyc/enforcement-rules/*`

### Security Enforcement
- VIEW_ONLY impersonation mode blocks POST/PUT/PATCH/DELETE at middleware level
- Emergency lockdown scoping prevents regional admins from affecting global operations
- All mutation endpoints have comprehensive audit logging