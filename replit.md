# SafeGo Global Super-App

## Overview
SafeGo is a production-ready, full-stack multi-service super-app platform for global on-demand services like ride-hailing, food delivery, and parcel delivery. Its purpose is to be a leading global super-app by offering a comprehensive, scalable, and secure solution for integrated urban services. Key features include multi-role authentication, country-specific KYC, commission tracking with negative balance support, full service lifecycle management, and unified payout/payment section layouts.

## User Preferences
**Preferred communication style**: Simple, everyday language.

**Development approach**: Full-stack TypeScript with modern tooling, emphasizing code quality, security, and scalability.

## System Architecture

### UI/UX Decisions
The frontend uses React 18 with TypeScript, Vite 5, shadcn/ui (Radix UI), Tailwind CSS 3, TanStack Query v5, wouter, and React Hook Form with Zod. It features a custom HSL-based color palette, Inter/Manrope typography, mobile-first responsive design, skeleton loading, toast notifications, error boundaries, protected routes with role-based access control, and a unified payout/payment section layout across user profile pages.

### Technical Implementations
The platform is built with a Node.js 20+ TypeScript backend using Express.js 4 and Prisma Client 6 with PostgreSQL 14+. It supports multi-role authentication, country-specific KYC with admin approval, and comprehensive service lifecycle management.

Key features include:
- **Admin Capabilities**: An admin panel with an interactive dashboard, real-time data updates, a unified Document Center, an enhanced Wallet Settlement System, and a Global Earnings & Payout Analytics Dashboard.
- **Security & Compliance**: Admin Activity Audit Trail with IP tracking and sensitive data masking, Global Admin Notification Center, and a Global Admin Settings Panel.
- **Identity & Payouts**: Finalized identity layouts for driver profiles and admin-managed driver/restaurant payout accounts with encrypted storage and country-specific validation.
- **Wallet & Earnings System**: A comprehensive financial management system tracking earnings, commissions, negative balances, and payout processing, integrating with service completion.
- **Security Architecture**: Environment variable-based JWT secret, bcrypt hashing, AES-256-GCM encryption for sensitive data, Zod validation, role-based middleware, CSRF protection, SQL injection prevention, and comprehensive audit logging with automatic PII masking.
- **Admin RBAC System**: Advanced role-based access control with 5 admin roles and 20 granular permissions, implementing a deny-by-default security model.
- **Environment Guard**: Startup validation for critical security secrets.
- **Security Status Indicators**: Visual flags on user profiles (`normal`, `under_observation`, `needs_review`).
- **Support Chat System**: Real-time support chat with WebSocket integration, full CRUD, RBAC checks, and admin dashboard integration.
- **Secure UX Surfaces**: Comprehensive security UX components for admin use including Security Status Badges, read-only Security Notes Panels, Account Type Labels, Sensitive Action Confirmation modals, Session Refresh Indicator banners, RBAC-based UI visibility controls, and Audit Log Visual Highlighting.
- **Admin Monitoring Panel**: Real-time system monitoring dashboard displaying security metrics, recent security events, and system health indicators.
- **Real-Time Threat Monitoring**: Advanced security threat center with blocked login attempts tracker, suspicious activity charts, active sessions list, API latency monitor, and threat activity visualization.
- **Fraud Detection Engine**: Comprehensive fraud detection service implementing device mismatch detection, duplicate account detection, impossible travel checks, parcel fraud rules, multi-account abuse detection, and risk score calculation.
- **DevOps Security Enhancements**: Enterprise-grade DevOps security service featuring automated log rotation, background job failure monitoring, crash alert webhooks, backup encryption/decryption, auto-scaling firewall rules, and system health checks.
- **Automated Incident Response**: Fully automated incident response system implementing auto-locking of suspicious users, token revocation, session invalidation, admin breach alerts, automated fraud response, and full audit trails.
- **Admin Financial Suite**: Comprehensive financial management suite with dedicated admin pages for Wallets, Payouts, and Earnings, providing end-to-end financial visibility and control with full RBAC enforcement.
- **Admin Dashboard Cards**: The admin dashboard (`/admin`) displays 15 management cards with proper RBAC enforcement covering core management, financial, security, and support functionalities. All backend routes remain protected by middleware permission checks regardless of frontend card visibility.

### Database Schema Design
The schema uses UUID primary keys, indexed foreign keys, decimal types for monetary values, and includes models for `Wallet`, `WalletTransaction`, `Payout`, `PayoutBatch`, `AuditLog`, `AdminNotification`, `PlatformSettings`, `PayoutAccount`, and `PaymentMethod`. It supports country-specific identity fields, driver profile photos, and vehicle documents.

## External Dependencies

- **Backend Core**: `@prisma/client`, `express`, `bcrypt`, `jsonwebtoken`, `@neondatabase/serverless`.
- **Frontend Core**: `react`, `react-dom`, `wouter`, `@tanstack/react-query`, `react-hook-form`, `zod`.
- **UI Components (shadcn/ui)**: `@radix-ui/*`, `lucide-react`, `class-variance-authority`, `tailwind-merge`, `clsx`.
- **Environment Variables**: `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`, `ENCRYPTION_KEY`.