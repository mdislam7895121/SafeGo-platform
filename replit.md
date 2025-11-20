# SafeGo Global Super-App

## Overview
SafeGo is a production-ready, full-stack multi-service super-app platform designed for global on-demand services, including ride-hailing, food delivery, and parcel delivery. The platform aims to be a leading global super-app by providing a comprehensive, scalable, and secure solution for integrated urban services. Key features include multi-role authentication, country-specific KYC, commission tracking with negative balance support, full service lifecycle management, and unified payout/payment section layouts across all user profile pages.

## User Preferences
**Preferred communication style**: Simple, everyday language.

**Development approach**: Full-stack TypeScript with modern tooling, emphasizing code quality, security, and scalability.

## System Architecture

### UI/UX Decisions
The frontend utilizes React 18 with TypeScript, Vite 5, shadcn/ui (Radix UI), Tailwind CSS 3, TanStack Query v5, wouter, and React Hook Form with Zod. It features a custom HSL-based color palette for light/dark modes, Inter/Manrope typography, mobile-first responsive design, skeleton loading, toast notifications, error boundaries, and protected routes with role-based access control. **Step 40 Completed (Nov 20, 2025)**: Unified payout/payment section layout standardized across driver, restaurant, and customer admin profile pages with consistent ordering: Identity/KYC → Earnings Summary → Payout/Payment Information → Additional sections.

### Technical Implementations
The platform is built with a Node.js 20+ TypeScript backend using Express.js 4 and Prisma Client 6 with PostgreSQL 14+. It supports multi-role authentication (customer, driver, restaurant, admin), country-specific KYC with admin approval, and comprehensive service lifecycle management for ride-hailing, food delivery, and parcel delivery.

Key features include:
- **Admin Capabilities**: An admin panel with an interactive dashboard, real-time data updates, a unified Document Center for KYC review, an enhanced Wallet Settlement System, a comprehensive driver financial analytics dashboard, and a Global Earnings & Payout Analytics Dashboard with service-specific breakdowns, charts, and filtering.
- **Security & Compliance**: An Admin Activity Audit Trail logs critical admin actions with IP tracking and sensitive data masking. A Global Admin Notification Center provides real-time system alerts with filtering and unread count tracking.
- **Global Admin Settings Panel**: Centralized configuration management for platform policies, commission rates, settlement cycles, and security parameters, all protected by RBAC and audit logging.
- **Identity & Payouts**: Finalized identity layouts for USA and Bangladesh driver profiles, and admin-managed driver/restaurant payout accounts with encrypted storage, country-specific validation, and masked account display.
- **Wallet & Earnings System**: A comprehensive financial management system tracks driver/restaurant earnings, platform commissions, negative balances, and payout processing across all services. It uses a three-model design (Wallet, WalletTransaction, Payout) with dual balance tracking (availableBalance, negativeBalance) and integrates automatically with service completion for cash vs. online payments.
- **Security Architecture**: Utilizes environment variable-based JWT secret, bcrypt hashing, AES-256-GCM encryption for sensitive data, Zod validation, role-based middleware, CSRF protection, and SQL injection prevention. Comprehensive audit logging includes automatic sensitive data masking.
- **Admin RBAC System**: Advanced role-based access control with 5 admin roles and 20 granular permissions, implementing a deny-by-default security model with dynamic permission loading.

### Wallet & Earnings System
Comprehensive financial management system tracking driver/restaurant earnings, platform commissions, negative balances, and payout processing across all services with full audit trail and multi-currency support (BD/US).

**Architecture**: Three-model design (Wallet for balance aggregates, WalletTransaction for append-only ledger, Payout for withdrawal requests) with dual balance tracking (availableBalance for withdrawable funds, negativeBalance for platform debt from cash transactions).

**Cash vs Online Logic**: Cash payments create negative balance (debt) as driver/restaurant collects full amount; platform commission recorded via recordCommission with serviceType preserved (ride, food_order, parcel_delivery) for analytics. Online payments credit availableBalance via recordEarning as platform already deducted commission from customer payment.

**WalletService Methods**: getOrCreateWallet, recordTransaction (atomic balance updates with snapshots), recordEarning, recordCommission, service-specific methods (recordRideEarning, recordFoodOrderEarning, recordFoodDeliveryEarning, recordParcelDeliveryEarning) with built-in cash/online logic and null/Decimal validation, settleNegativeBalance, createManualAdjustment/Refund.

**PayoutService Methods**: createPayoutRequest (validates sufficient availableBalance, creates pending payout), processPayout (admin approval flow, debits availableBalance, creates payout transaction, updates status to processing/completed), rejectPayout (cancels request with reason, no balance changes), listPayouts (filtered queries by status, owner, date range for admin dashboard). All payout operations logged via audit trail.

**Payout Workflow**: Driver/restaurant requests payout → Pending status → Admin reviews (VIEW_WALLETS permission) → Admin approves (MANAGE_PAYOUTS permission, debits wallet, records transaction) OR admin rejects (with reason) → Payout status updated to completed/rejected. All actions audited with PAYOUT_APPROVED/PAYOUT_REJECTED action types.

**Service Integration**: Automatic wallet updates on ride/food/parcel completion. Routes call walletService methods after rating confirmation. All methods validate amounts (not null, not NaN, not negative) before Number() conversion.

**Frontend Pages**: Admin wallet overview (/admin/wallets), wallet details (/admin/wallets/:id), payout management (/admin/payouts) with RBAC (VIEW_WALLETS, MANAGE_PAYOUTS). Driver (/driver/wallet) and restaurant (/restaurant/wallet) pages with balance display, transaction history, payout requests. Dark mode support throughout.

**Navigation**: Admin home has Wallets and Payouts navigation cards with permission filtering. Driver and restaurant dashboards have Wallet quick links.

**Batch Processing**: PayoutBatch model enables bulk payout creation and processing for eligible wallets. Admin can create batches filtered by wallet type (driver/restaurant), country (BD/US), and minimum amount threshold. Batch processing atomically debits wallets with automatic refund on failure.

**Earnings Analytics Dashboard** (/admin/earnings): Comprehensive analytics interface providing global earnings overview, service-specific breakdowns (rides, food orders, parcel deliveries), payout analytics with charts, time-series data, and filtering by date range and country. Features include summary cards, pie charts for revenue distribution, bar charts for country comparisons, detailed tables for top performers, and tabbed interface. Backend powered by earningsService with efficient Prisma aggregations and 1-minute caching. RBAC-protected with VIEW_EARNINGS_DASHBOARD permission and full audit logging.

**Implementation Status**: ✅ Completed: Database schema (including PayoutBatch), WalletService, PayoutService with batch operations, all API routes, all frontend pages, service integration (rides, food, parcels), navigation links, RBAC, unified payout/payment section layouts (Step 40), Settlement & Payout Processing Dashboard with batch management (Nov 20, 2025), Global Earnings & Payout Analytics Dashboard (Step 41, Nov 20, 2025). ⏳ Pending: Weekly auto-settlement job (Task 18).

### Database Schema Design
The database schema uses UUID primary keys, indexed foreign keys, decimal types for monetary values, and includes models for `Wallet`, `WalletTransaction`, `Payout`, `PayoutBatch`, `AuditLog`, `AdminNotification`, `PlatformSettings`, `PayoutAccount`, and `PaymentMethod`. It supports country-specific identity fields, driver profile photos, structured driver names, DMV/TLC license images, and vehicle documents. The `AuditLog` tracks all critical admin actions with detailed metadata, and `AdminNotification` stores system alerts with filtering capabilities. `PlatformSettings` provides global configuration storage, `PayoutAccount` securely stores encrypted payout information, and `PayoutBatch` manages bulk payout processing with status tracking (created, processing, completed, failed, partially_failed).

## External Dependencies

- **Backend Core**: `@prisma/client`, `express`, `bcrypt`, `jsonwebtoken`, `@neondatabase/serverless`.
- **Frontend Core**: `react`, `react-dom`, `wouter`, `@tanstack/react-query`, `react-hook-form`, `zod`.
- **UI Components (shadcn/ui)**: `@radix-ui/*`, `lucide-react`, `class-variance-authority`, `tailwind-merge`, `clsx`.
- **Environment Variables**: `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`, `ENCRYPTION_KEY`.