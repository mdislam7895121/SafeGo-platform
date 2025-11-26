# SafeGo Global Super-App

## Overview
SafeGo is a production-ready, full-stack multi-service super-app platform for global on-demand services like ride-hailing, food, and parcel delivery. It aims to be a leading solution by offering scalable, secure, and feature-rich capabilities including multi-role authentication, country-specific KYC, commission tracking, service lifecycle management, unified payment/payouts, multi-role support, and comprehensive driver identity and profile management.

## User Preferences
Preferred communication style: Simple, everyday language.
Development approach: Full-stack TypeScript with modern tooling, emphasizing code quality, security, and scalability.

## System Architecture

### UI/UX Decisions
The frontend uses React 18, TypeScript, Vite 5, shadcn/ui (Radix UI), Tailwind CSS 3, TanStack Query v5, wouter, and React Hook Form with Zod. It features a custom HSL color palette, Inter/Manrope typography, mobile-first responsive design, skeleton loading, toast notifications, error boundaries, and role-based access control. Key UI/UX features include Uber-level profile experiences, multi-step onboarding, country-specific KYC, dedicated Food and Driver Profile Systems, and WCAG 2.1 AA compliance.

### Technical Implementations
The backend is built with Node.js 20+, TypeScript, Express.js 4, and Prisma Client 6 with PostgreSQL 14+, employing a Generic Service Layer with Role Adapters.

Core systems and features include:
-   **Admin Capabilities**: Interactive admin panel with dashboards, document management, wallet settlement, and global analytics.
-   **Security & Compliance (Phase 2 Hardening)**: 
    - **HTTP Security Headers**: HSTS, CSP, X-Frame-Options, X-Content-Type-Options via securityHeaders middleware
    - **Rate Limiting**: Admin login (5/min), analytics (30/min), payout (10/min), support (20/min) routes
    - **2FA System**: TOTP for admin, OTP (email/SMS) for driver/restaurant payout changes and password reset
    - **OTP Service** (otpService.ts): 6-digit codes, 10-min expiry, 3 max attempts, 3 req/15min rate limit per identifier
    - **Device Security** (deviceSecurityService.ts): User-Agent fingerprinting, IP geolocation detection, new device/location flagging
    - **Session Security** (sessionSecurityService.ts): Auto-revocation on suspicious login, device tracking, login history
    - **Security Alerts** (securityAlertService.ts): Multi-channel notifications for new device/location logins
    - **Tamper-Proof Audit Logs** (tamperProofAuditService.ts): Append-only SHA-256 hash chain, no edit/delete, verifiable integrity
    - **Secure Audit Routes** (secure-audit.ts): Admin-only internal endpoints for log viewing/querying/verification
    - **Payout 2FA Middleware**: OTP + password verification for driver/restaurant, TOTP for admin payout operations
    - **Audit Categories**: ADMIN_ACTION, PAYOUT_CHANGE, KYC_EVENT, SUPPORT_EVENT, AUTH_EVENT, SECURITY_EVENT, DATA_ACCESS
    - **Severity Levels**: INFO, WARNING, CRITICAL
    - AES-256-GCM field encryption, Admin Activity Audit Trail, Global Admin Notification Center, RBAC.
-   **Wallet & Earnings System**: Manages earnings, commissions, negative balances, and automated/manual payouts.
-   **Tax & Fees System**: Multi-country tax management with city-level overrides.
-   **Multi-Role Multi-Channel Support Center**: AI-first chat with 4-role support and a two-tier escalation system.
-   **Opportunity Bonus Management System**: Admin-managed ride incentives with country-specific amounts and zone-based targeting.
-   **SafeGo Points System**: Uber Pro-style gamified loyalty program with 3 tiers.
-   **Identity Verification System**: Country-specific identity document management with AES-256-GCM encryption.
-   **Restaurant Management Systems**: Includes Performance Insights, Review & Rating Management, Media Gallery, Branding, Operational Settings, Order Management, Staff & Role Management, and Promotions & Coupon Management.
-   **Customer-Facing Dynamic Pricing Display**: Real-time pricing transparency with surge multipliers, promotions, and breakdowns.
-   **Unified Payout System**: Enterprise-grade management for customer payment methods and payout rails by country, service type, actor type, and KYC level, including automatic weekly scheduling and bank verification.
    - **Supported Payout Types by Country**:
      - Bangladesh (BD): Bank Account, Mobile Wallet (bKash, Nagad, Rocket)
      - United States (US): Bank Account, Stripe Connect
    - **Bank Account Types**: CHECKING, SAVINGS, BUSINESS_CHECKING, BUSINESS_SAVINGS, OTHER (required for all bank account payout methods)
    - **Payout Method Status**: PENDING_VERIFICATION (for Stripe Connect), ACTIVE, DISABLED
    - Driver and Restaurant roles have consistent Add Payout Method UX with country-restricted options and dynamic form fields
-   **Driver Systems**: Comprehensive driver profile management (multi-vehicle, encrypted KYC, document upload), public profile card, earnings & payout dashboard, promotions & incentives system, document management, support & help center, in-app training & onboarding, getting started page, vehicle center, wallet center, trip history & earnings breakdown, performance & ratings center, incentives & milestones center, and Safety Center with incident reporting and emergency toolkit.
-   **API Design**: Robust API endpoints with enforcement of KYC, ownership validation, UUID format validation, Zod schema validation, atomic transactions, and consistent error handling.

### Database Schema Design
The schema utilizes UUID primary keys, indexed foreign keys, and decimal types for monetary values. It includes models for wallets, payouts, audit logs, notifications, platform settings, payment/payout accounts, opportunity settings, driver tiers and points, blocked riders, reviews, restaurant branding, media, hours, operational settings, delivery zones, surge settings, country payment/payout configurations, restaurant payout methods, categories, subcategories, menu item categories, promotion usage, multi-role support models, and driver safety incidents. It supports country-specific identity fields with AES-256-GCM encryption and includes flags for demo mode, US tax fields, driver preferences, and enhancements for promotions/coupons and review replies.

## External Dependencies

-   **Backend Core**: `@prisma/client`, `express`, `bcrypt`, `jsonwebtoken`, `@neondatabase/serverless`.
-   **Frontend Core**: `react`, `react-dom`, `wouter`, `@tanstack/react-query`, `react-hook-form`, `zod`.
-   **UI Components**: `@radix-ui/*`, `lucide-react`, `class-variance-authority`, `tailwind-merge`, `clsx`.
-   **Environment Variables**: `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`, `ENCRYPTION_KEY`, `SESSION_SECRET`.
-   **Optional Integrations**: Twilio (SMS OTP), AgentMail (Email OTP) - services degrade gracefully to console logging when not configured.