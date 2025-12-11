# SafeGo Global Super-App

## Overview
SafeGo is a production-ready, full-stack multi-service super-app platform designed for global on-demand services such as ride-hailing, food delivery, and parcel delivery. Its primary purpose is to capture significant market share by offering a scalable, secure, and feature-rich solution. Key capabilities include multi-role authentication, country-specific KYC, commission tracking, service lifecycle management, unified payment/payout systems, comprehensive driver identity management, and advanced automation for profit optimization and risk intelligence. The project aims to provide a robust and versatile platform capable of rapid regional expansion and compliance with global regulatory standards.

## User Preferences
Preferred communication style: Simple, everyday language.
Development approach: Full-stack TypeScript with modern tooling, emphasizing code quality, security, and scalability.

## System Architecture
The system employs a full-stack TypeScript approach. The frontend is built with React 18, Vite 5, shadcn/ui, Tailwind CSS 3, TanStack Query v5, wouter, and React Hook Form with Zod. The backend utilizes Node.js 20+, Express.js 4, and Prisma Client 6 with PostgreSQL 14+, following a Generic Service Layer with Role Adapters design pattern.

**Key Architectural and Feature Highlights:**

*   **UI/UX Decisions**: Features a custom HSL color palette, Inter/Manrope typography, mobile-first responsive design, WCAG 2.1 AA compliance, an Enterprise Admin Component Library, Dark/Light/System modes, accessibility features, and optimized touch targets.
*   **Security & Compliance**: Implements robust security measures including HTTP security headers, rate limiting, 2FA, device/session security, AES-256-GCM encryption, tamper-proof audit logs, account lockout, fraud detection, and regulatory compliance. It also includes JWT rotation, OTP rate limiting, login throttling, suspicious login alerts, device history tracking, expanded admin audit logs, API rate limiting with auto-block, and a WAF security layer.
*   **Financial Systems**: Manages comprehensive Wallet & Earnings, Tax & Fees, and Unified Payout systems, handling commissions, negative balances, multi-country taxes, and enterprise-grade payment/payout rails.
*   **Customer & Partner Onboarding**: Features multi-step onboarding and country-specific KYC with real-time ID verification, background checks, and facial recognition.
*   **Unified Partner Verification Engine**: A shared verification module (`shared/verification.ts`) providing canonical verification states (APPROVED, PENDING_REVIEW, NEED_MORE_INFO, REJECTED, NOT_SUBMITTED) with automatic legacy status normalization, unified UI components (VerificationBanner, VerificationBadge), and consistent verification logic across all partner types (drivers, restaurants). Features include: status-change notifications, admin management endpoints, and backward-compatible legacy status mapping.
*   **Service Offerings**: Supports Food Delivery, Ride-Hailing, and Parcel Delivery with features like restaurant management, multi-route fare engine, and dynamic pricing. This includes a comprehensive parcel system for Bangladesh with multi-zone pricing and COD settlement, and a configurable VAT calculation system for Bangladesh.
*   **Driver Management**: Includes a Delivery Driver Dashboard with verification status, earnings summary, online/offline toggle with location updates, task navigation, and a Go-Online Engine for status management and matching pool registration. A Live Assignment System handles universal task matching, incoming task popups, accept/reject logic, and real-time navigation.
*   **Privacy & Consent Management**: GDPR-compliant system with consent tracking, policy versioning, configurable data retention, user data deletion/export requests, and policy acceptance enforced post-KYC. This includes Data Export Automation, Account Deletion with a 72-hour delay, a Data Retention Engine, and Policy Auto-Versioning.
*   **Loyalty & Incentives**: Features a SafeGo Points System, Opportunity Bonus Management System, and a Driver Incentive Engine.
*   **Real-Time & Optimization**: Leverages an AI Marketplace Balancer, Real-Time Dispatch System (WebSocket-based), dynamic routing optimization, personalized push notifications, and Admin Notifications.
*   **Profit-Focused Automation Systems**: A suite of 32 services covering core automation, security, risk intelligence, experience optimization, and platform operations.
*   **API Design**: Robust API endpoints with KYC enforcement, ownership validation, Zod schema validation, atomic transactions, and consistent error handling.
*   **Database Schema**: Uses UUID primary keys, indexed foreign keys, and decimal types for monetary values.
*   **Role-Based Access Control (RBAC)**: A comprehensive 8-role admin system with granular permissions, emergency lockdown, and admin impersonation.
*   **Global Audit Engine**: Tamper-proof logging with hash chain verification and regulator export mode.
*   **Enterprise Administration**: Features Feature Flags, Enterprise Search, Data Export Center, Incident Response, Customer Support, Partner Compliance, System Health Monitor, and an Intelligence Dashboard.
*   **Intelligence Layer**: An enhanced Intelligence Dashboard with service analytics, driver performance, customer satisfaction, fraud detection, platform health, and automated insights, powered by the SafePilot Intelligence Engine with 8 intelligence modules.
*   **Complaint Resolution Center**: Includes an SLA timer system, AI summary generation, and resolution workflow.
*   **Policy & Safety Hub**: Comprehensive policy management (T&Cs, Refund/Cancellation, Community Guidelines, Safety Policy), Partner Agreement E-Signature, Emergency SOS System, Safety Monitoring (real-time ride events, audio recording), a user Report System, User Restrictions & Auto-Restriction, and a Safety Center.
*   **Fraud Prevention Layer**: Includes One-Account-Per-Device, Device Fingerprinting, Fake GPS Detection, COD Fraud Protection, Partner Manipulation Detection, IP Anomaly Detection, and Suspicious Behavior Scoring with an associated Fraud Prevention Center.
*   **Final Pre-Launch Systems**: Includes health checks for Payment Gateways, Notification Systems, and Map Services, along with a comprehensive UAT Pass + Launch Readiness Certificate process.

## Audit Status (December 2024)

**Full System Audit: PASSED - Uber-Level Hardened**

All 14 sections of the SafeGo Master Rules have been audited and certified:
- 4 core roles (Customer, Driver, Restaurant, Admin) with proper separation
- 3 major services (Ride-hailing, Food Delivery, Parcel Delivery) with complete flows
- Country-specific KYC (BD + US) enforced
- Unified Verification Engine active across all partner types
- Security & privacy rules implemented (RBAC, upload validation, KYC protection)
- Commission & wallet rules enforced (including negative balance handling)

See `AUDIT_PHASE1_REPORT.md` and `AUDIT_FINAL_REPORT.md` for detailed audit documentation.

## External Dependencies

*   **Backend Core**: `@prisma/client`, `express`, `bcrypt`, `jsonwebtoken`, `@neondatabase/serverless`.
*   **Frontend Core**: `react`, `react-dom`, `wouter`, `@tanstack/react-query`, `react-hook-form`, `zod`.
*   **UI Components**: `@radix-ui/*`, `lucide-react`, `class-variance-authority`, `tailwind-merge`, `clsx`.
*   **Third-party Services**: Twilio (SMS OTP), AgentMail (Email OTP), Stripe (payment gateway - US), SSLCOMMERZ (payment gateway - Bangladesh), Google Maps Platform (Maps JavaScript API, Places API, Directions API, Geocoding API), bKash, Nagad, Checkr, AWS Rekognition, Persona/Onfido.

## Bangladesh Online Payments Integration (December 2024)

**SSLCOMMERZ Gateway Integration - Phase 0-3 Complete**

The platform now supports online payments in Bangladesh through SSLCOMMERZ:

- **Gateway Provider**: SSLCOMMERZ (`server/services/paymentProviders/sslcommerz.ts`)
- **Feature Flag**: `FEATURE_BD_ONLINE_PAYMENTS_ENABLED` (default: false, start in sandbox)
- **Environment Variables Required**:
  - `SSLCOMMERZ_STORE_ID_BD` / `SSLCOMMERZ_SANDBOX_STORE_ID_BD`
  - `SSLCOMMERZ_STORE_PASSWORD_BD` / `SSLCOMMERZ_SANDBOX_PASSWORD_BD`
  - `SSLCOMMERZ_SANDBOX_ENABLED_BD` (set to "true" for sandbox mode)
- **Webhook Endpoints**: `/api/webhooks/payments/sslcommerz/ipn`, `/success`, `/fail`, `/cancel`
- **Supported Methods**: Cards (Visa, MC, AMEX), Mobile Wallets (bKash, Nagad, Rocket, Upay), Internet Banking
- **Business Setup Guide**: `docs/bd_payments_business_setup.md`

Key Features:
- Session-based redirect flow with SSLCOMMERZ hosted checkout
- Server-side transaction validation via SSLCOMMERZ API
- MD5 signature verification for webhook security
- Proper status mapping to SafeGo payment states
- Cash remains default and active during rollout
- Feature flag gating requires both flag AND credentials
- Order-level payment tracking fields (paymentCountryCode, paymentCurrency, paymentProvider, paymentReferenceId, paymentMetadata, isCommissionSettled)
- Commission auto-settlement for online payments (no negative balance)

Architecture Documentation:
- `docs/bd_online_payments_architecture.md` - Technical flow and integration details
- `docs/payment_providers_overview.md` - Provider comparison and extension guide

## Admin Finance Dashboard (December 2024)

**Comprehensive Finance Monitoring & Settlement System**

A full-featured admin dashboard for revenue monitoring, gateway reporting, partner balance tracking, and settlement management:

- **Routes**: `/admin/finance/*` (overview, gateway-reports, driver-balances, restaurant-balances, settlements)
- **Backend**: `server/routes/admin-finance.ts`, `server/services/financeStatsService.ts`
- **RBAC**: Uses existing `payouts` navigation key, accessible by FINANCE_ADMIN and super admins

Key Features:
- **Finance Overview**: Revenue by country/service, negative balance summaries, top 10 partners by owed commission
- **Gateway Reports**: Transaction history with filters by country, provider, method, status, and date range
- **Driver Balances**: List drivers with negative balances, view unsettled orders, record settlements
- **Restaurant Balances**: Same capabilities for restaurant partners
- **Settlements History**: Complete audit trail of all recorded settlements with order-level detail

Settlement Workflow:
1. Admin views partner with negative balance
2. Opens detail sheet showing unsettled orders
3. Records settlement with amount, method (bank transfer, bKash, Nagad, etc.), reference
4. System updates partner balance and marks orders as settled

Frontend Pages: `client/src/pages/admin/finance-*.tsx`

## Admin UI/UX Enterprise Upgrade (December 2024)

**Phase-3 Verification: COMPLETE**

All enterprise admin UI/UX features have been verified as fully implemented:

### Notification Center (`/admin/notifications`)
- Real-time WebSocket updates with auto-reconnect
- Category filtering (Ride, Food, Shop, Ticket, Rental, System, Security)
- Severity levels (Critical, Warning, Info) with visual badges
- Sound notifications with toggle control
- Mark as read (individual and bulk)
- CSV export functionality
- Connection status indicator (Live/Offline)
- Search and filtering by entity type, country, read status

### Theme System (`ThemeContext.tsx`)
- Light/Dark/System mode switching with persistence
- 5 Admin color presets (Default, Slate, Ocean, Forest, Sunset)
- Accessibility modes (High Contrast, Large Text, Reduced Motion)
- CSS custom property injection for real-time theme changes
- localStorage persistence across sessions

### Feature Flags (`/admin/feature-flags`)
- Category grouping (Ride, Food, Shop, Ticket, Rental, System)
- Environment targeting (Development, Staging, Production, All)
- Country scope (Global, Bangladesh, United States)
- Role targeting (Customer, Driver, Restaurant, etc.)
- Partner type targeting (Standard, Premium, Enterprise)
- Rollout percentage slider (0-100%)
- Toggle switches with visual states
- Create/Edit dialogs with full configuration
- RBAC: Super Admin only for modifications

### People & KYC Center (`/admin/people-kyc`)
- Unified user search across all roles
- KYC status filtering and verification completeness
- Wallet balance and negative balance tracking
- Risk flags indication
- Detail drawers with activity summary
- Batch action support
- Pagination and result limits

### Safety & Risk Center (`/admin/safety-center`)
- Risk case management with severity levels
- Case status workflow (Open, In Progress, Resolved)
- Case notes and timeline
- Event categorization (Fraud, Safety, Abuse, Technical, Payment Risk, Compliance)
- Quick stats dashboard

### Key Admin Page Inventory (130+ pages)
Full enterprise administration coverage including:
- Operations: monitoring, operations-dashboard, health-monitor
- Finance: earnings, payouts, wallets, settlements, revenue-analytics
- Users: customers, drivers, restaurants, shop-partners, ticket-operators
- Compliance: kyc, documents, compliance-center, legal-requests
- Support: complaints, support-chat, contact-center
- Security: fraud-alerts, security-center, incident-response
- Intelligence: analytics, safepilot-intelligence, intelligence-dashboard