# SafeGo Global Super-App

## Overview
SafeGo is a production-ready, full-stack multi-service super-app platform designed for global on-demand services, including ride-hailing, food delivery, and parcel delivery. It aims to be a leading global super-app by providing a comprehensive, scalable, and secure solution for integrated urban services. Key capabilities include multi-role authentication, country-specific KYC, commission tracking with negative balance support, full service lifecycle management, and unified payout/payment section layouts.

## User Preferences
**Preferred communication style**: Simple, everyday language.

**Development approach**: Full-stack TypeScript with modern tooling, emphasizing code quality, security, and scalability.

## System Architecture

### UI/UX Decisions
The frontend uses React 18 with TypeScript, Vite 5, shadcn/ui (Radix UI), Tailwind CSS 3, TanStack Query v5, wouter, and React Hook Form with Zod. It features a custom HSL-based color palette, Inter/Manrope typography, mobile-first responsive design, skeleton loading, toast notifications, error boundaries, and protected routes with role-based access control. A unified payout/payment section layout is standardized across all user profile pages.

### Technical Implementations
The platform is built with a Node.js 20+ TypeScript backend using Express.js 4 and Prisma Client 6 with PostgreSQL 14+. It supports multi-role authentication, country-specific KYC with admin approval, and comprehensive service lifecycle management for ride-hailing, food delivery, and parcel delivery.

Key features include:
- **Admin Capabilities**: An admin panel with an interactive dashboard, real-time data updates, a unified Document Center for KYC review, an enhanced Wallet Settlement System, and a Global Earnings & Payout Analytics Dashboard.
- **Security & Compliance**: Admin Activity Audit Trail with IP tracking and sensitive data masking, Global Admin Notification Center, and a Global Admin Settings Panel for centralized configuration.
- **Identity & Payouts**: Finalized identity layouts for driver profiles and admin-managed driver/restaurant payout accounts with encrypted storage and country-specific validation.
- **Wallet & Earnings System**: A comprehensive financial management system tracks earnings, commissions, negative balances, and payout processing across all services. It uses a three-model design (Wallet, WalletTransaction, Payout) with dual balance tracking and integrates automatically with service completion.
- **Security Architecture**: Environment variable-based JWT secret, bcrypt hashing, AES-256-GCM encryption for sensitive data, Zod validation, role-based middleware, CSRF protection, SQL injection prevention, and comprehensive audit logging with automatic PII masking.
- **Admin RBAC System**: Advanced role-based access control with 5 admin roles and 20 granular permissions, implementing a deny-by-default security model.
- **Environment Guard**: A startup validation system ensures critical security secrets (JWT_SECRET, ENCRYPTION_KEY, DATABASE_URL, SESSION_SECRET) are properly configured before application startup, failing fast in production for missing or insecure values.
- **Security Status Indicators**: Visual flags (`normal`, `under_observation`, `needs_review`) on user profiles (driver, customer, restaurant) to track and manage potential security concerns.
- **Support Chat System**: Real-time support chat with WebSocket integration, full CRUD for conversations, messages, and attachments, RBAC checks, admin dashboard integration with unread counters and filters, and dedicated user interfaces for drivers, customers, and restaurants.
- **Step 40 - Secure UX Surfaces**: Comprehensive security UX components created for admin use including Security Status Badges (5 states: Verified, Partially Verified, Unverified, Flagged, Suspended), read-only Security Notes Panels, Account Type Labels with country/region display, Sensitive Action Confirmation modals for admin operations, Session Refresh Indicator banners, RBAC-based UI visibility controls, and Audit Log Visual Highlighting with red dot indicators for profiles with security events. Includes lightweight `/api/admin/audit-summary/:userId` endpoint for efficient audit event tracking. Components are designed for admin profile review pages only, not for end-user self-service profiles, maintaining proper separation of admin-only security metadata from user-visible data.
- **Step 41 - Admin Monitoring Panel**: Real-time system monitoring dashboard (`/admin/monitoring`) displaying 24-hour security metrics (failed logins, suspicious activity, blocked attempts, active sessions), recent security events from audit log with field-level projection for security, system health indicators (API latency, database status), auto-refresh every 30 seconds, and permission-gated access via `VIEW_DASHBOARD` capability. Backend endpoint `/api/admin/monitoring` provides comprehensive security analytics with limited field selection to prevent exposure of sensitive audit metadata.

## Phase 4: Enterprise Security Layer

- **Step 42 - Real-Time Threat Monitoring**: Advanced security threat center at `/admin/security-center` with comprehensive real-time monitoring including: blocked login attempts tracker, suspicious activity charts with hourly breakdowns, active sessions list showing all current user sessions with IP addresses and device information, API latency monitor with real-time charts, and threat activity visualization using Recharts. Backend endpoint `/api/admin/security/threats` aggregates threat data from audit logs with auto-refresh every 10 seconds. Permission-gated via `VIEW_DASHBOARD` capability.

- **Step 43 - Fraud Detection Engine**: Comprehensive fraud detection service (`fraudDetectionService.ts`) implementing: device mismatch detection comparing current login IPs/user agents with historical patterns, duplicate account detection via email/phone analysis, impossible travel checks detecting logins from distant locations in short timeframes, parcel sender/receiver fraud rules identifying high-volume senders and fake delivery patterns, multi-account abuse detection tracking shared IPs and multiple roles per user, and risk score calculation API combining all fraud indicators into 0-100 risk scores with actionable recommendations. Three admin endpoints: `/api/admin/fraud/calculate-risk`, `/api/admin/fraud/check-parcel`, and `/api/admin/fraud/check-multi-account`.

- **Step 44 - DevOps Security Enhancements**: Enterprise-grade DevOps security service (`devopsSecurityService.ts`) featuring: automated log rotation deleting audit logs older than 90 days, background job failure monitor tracking failed critical jobs (wallet-sync, payout-processing, commission-calculation) with admin notifications, crash alert webhook system creating admin notifications and audit log entries for system crashes, backup encryption/decryption using AES-256-GCM with initialization vectors and auth tags, auto-scaling firewall rules with IP blocking based on suspicious behavior (>5 failed logins in 10 minutes), and system health check monitoring database latency, job failures, and blocked IPs.

- **Step 45 - Automated Incident Response**: Fully automated incident response system (`incidentResponseService.ts`) implementing: auto-lock suspicious users when risk scores exceed 75, automatic token revocation for compromised accounts, compromised session invalidation with audit logging, admin breach alert system for critical security events, automated fraud response triggering actions based on severity levels, full audit trail for all automated actions, and incident tracking with resolution workflows. System automatically responds to detected threats without manual intervention while maintaining complete audit trails and admin notifications for oversight.

- **Step 46 - Admin Financial Suite**: Comprehensive financial management suite with three dedicated admin pages for wallet management, payout processing, and earnings analytics. The suite provides end-to-end financial visibility and control with full RBAC enforcement.

  **Three Financial Pages:**
  1. **Wallets Page (`/admin/wallets`)**: Comprehensive wallet management dashboard displaying all driver and restaurant wallets with real-time balance tracking. Features include:
     - Type filter (driver/restaurant/all) and country filter for targeted viewing
     - Table columns: Owner email, wallet type, currency, available balance, negative balance, last transaction date
     - Click-through to detailed wallet view with transaction history and payout records
     - Protected by `VIEW_WALLET_SUMMARY` permission
     - Audit logging via `VIEW_WALLETS` and `VIEW_WALLET_DETAILS` actions

  2. **Payouts Page (`/admin/payouts`)**: Payout request management interface for reviewing and processing driver/restaurant withdrawal requests. Features include:
     - Status filter (pending/processing/completed/failed/all), type filter (driver/restaurant/all), country filter
     - Table columns: Owner email, wallet type, amount, status, requested date, processed date
     - Approve/reject modals with confirmation dialogs and rejection reason input
     - Real-time status updates with optimistic UI and cache invalidation
     - Protected by `MANAGE_PAYOUTS` permission
     - Audit logging via `APPROVE_PAYOUT`, `REJECT_PAYOUT`, `VIEW_PAYOUT_REQUESTS` actions

  3. **Earnings Page (`/admin/earnings`)**: Multi-tab analytics dashboard providing comprehensive earnings insights across all services. Features include:
     - Five analytical tabs: Overview, Ride Earnings, Food Earnings, Parcel Earnings, Payout Trends
     - Date range filtering (Last 7/30/90 days, All time) and country filter
     - Recharts visualizations: Line charts for trends, bar charts for comparisons, area charts for cumulative data
     - Summary metrics: Total earnings, total commissions, net revenue, commission rate
     - Service-specific breakdowns with driver/restaurant earnings separation
     - Protected by `VIEW_EARNINGS_DASHBOARD` permission
     - Audit logging via `VIEW_EARNINGS_DASHBOARD` action with section metadata

  **Backend API Endpoints:**
  - `GET /api/admin/wallets` - List all wallets with filters, enriched with owner information
  - `GET /api/admin/wallets/:id` - Detailed wallet view with transactions and payouts
  - `GET /api/admin/payouts` - List all payout requests with filters and owner data
  - `PUT /api/admin/payouts/:id/approve` - Approve pending payout (sets status to processing)
  - `PUT /api/admin/payouts/:id/reject` - Reject pending payout with required reason
  - `GET /api/admin/earnings/dashboard/*` - Multiple endpoints for earnings analytics (existing)

  **Technical Implementation:**
  - All endpoints use `checkPermission()` middleware for RBAC enforcement
  - Owner information enrichment via Prisma joins (DriverProfile/RestaurantProfile/User)
  - Decimal balance conversion to strings for precise JSON serialization
  - Comprehensive audit logging with metadata including filters, amounts, and owner details
  - Frontend uses TanStack Query with automatic refetching and cache invalidation
  - Shadcn/ui components throughout (Table, Dialog, Select, Badge, Card, Tabs)
  - Mobile-responsive layouts with skeleton loading states
  - Toast notifications for success/error feedback

### Admin Dashboard Cards - Complete Inventory

The admin dashboard (`/admin`) displays 15 management cards with proper RBAC enforcement:

**Core Management Cards** (no permission required - visible to all authenticated admins):
1. **Notification Center** → `/admin/notifications` - System alerts and notifications with unread badge
2. **KYC Approvals** → `/admin/kyc` - Review and approve verification requests
3. **Document Center** → `/admin/documents` - Review all user-submitted documents
4. **Driver Management** → `/admin/drivers` - View, suspend, and manage drivers
5. **Customer Management** → `/admin/customers` - View, block, and manage customers
6. **Complaints** → `/admin/complaints` - Review and resolve driver complaints with open count badge
7. **Wallet Settlement** → `/admin/settlement` - Manage wallet settlements
8. **Activity Log** → `/admin/activity-log` - Security audit trail of admin actions
9. **Global Settings** → `/admin/settings` - Configure platform-wide settings

**Financial Cards** (RBAC-gated):
10. **Wallets** → `/admin/wallets` - View all wallet balances (requires `VIEW_WALLET_SUMMARY`)
11. **Payouts** → `/admin/payouts` - Review and approve payout requests (requires `MANAGE_PAYOUTS`)
12. **Earnings Analytics** → `/admin/earnings` - Global earnings and commission dashboard (requires `VIEW_EARNINGS_DASHBOARD`)

**Security Cards** (RBAC-gated):
13. **System Monitoring** → `/admin/monitoring` - Real-time security monitoring (requires `VIEW_DASHBOARD`)
14. **Security Threat Center** → `/admin/security-center` - Advanced threat detection (requires `VIEW_DASHBOARD`)

**Support Card** (RBAC-gated):
15. **Support Chat** → `/admin/support-chat` - Real-time support conversations with unread badge (requires `VIEW_SUPPORT_CONVERSATIONS`)

**RBAC Enforcement Summary:**
- SUPER_ADMIN sees all 15 cards (has all permissions)
- COMPLIANCE_ADMIN sees 14 cards (lacks MANAGE_PAYOUTS but has VIEW_DASHBOARD, VIEW_EARNINGS_DASHBOARD, VIEW_SUPPORT_CONVERSATIONS)
- SUPPORT_ADMIN sees fewer cards based on role permissions
- FINANCE_ADMIN sees financial + core cards
- READONLY_ADMIN has VIEW_DASHBOARD for monitoring cards

**Security Note:** All backend routes remain protected by middleware permission checks regardless of frontend card visibility. Frontend RBAC filtering provides UX optimization only; security enforcement occurs at the API layer.

### Database Schema Design
The schema uses UUID primary keys, indexed foreign keys, decimal types for monetary values, and includes models for `Wallet`, `WalletTransaction`, `Payout`, `PayoutBatch`, `AuditLog`, `AdminNotification`, `PlatformSettings`, `PayoutAccount`, and `PaymentMethod`. It supports country-specific identity fields, driver profile photos, and vehicle documents.

## External Dependencies

- **Backend Core**: `@prisma/client`, `express`, `bcrypt`, `jsonwebtoken`, `@neondatabase/serverless`.
- **Frontend Core**: `react`, `react-dom`, `wouter`, `@tanstack/react-query`, `react-hook-form`, `zod`.
- **UI Components (shadcn/ui)**: `@radix-ui/*`, `lucide-react`, `class-variance-authority`, `tailwind-merge`, `clsx`.
- **Environment Variables**: `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`, `ENCRYPTION_KEY`.