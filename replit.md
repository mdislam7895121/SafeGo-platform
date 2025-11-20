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

### Database Schema Design
The schema uses UUID primary keys, indexed foreign keys, decimal types for monetary values, and includes models for `Wallet`, `WalletTransaction`, `Payout`, `PayoutBatch`, `AuditLog`, `AdminNotification`, `PlatformSettings`, `PayoutAccount`, and `PaymentMethod`. It supports country-specific identity fields, driver profile photos, and vehicle documents.

## External Dependencies

- **Backend Core**: `@prisma/client`, `express`, `bcrypt`, `jsonwebtoken`, `@neondatabase/serverless`.
- **Frontend Core**: `react`, `react-dom`, `wouter`, `@tanstack/react-query`, `react-hook-form`, `zod`.
- **UI Components (shadcn/ui)**: `@radix-ui/*`, `lucide-react`, `class-variance-authority`, `tailwind-merge`, `clsx`.
- **Environment Variables**: `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`, `ENCRYPTION_KEY`.