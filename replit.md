# SafeGo Global Super-App

## Overview
SafeGo is a production-ready, full-stack multi-service super-app platform designed for global on-demand services like ride-hailing, food delivery, and parcel delivery. Its primary purpose is to be a leading global super-app by offering a comprehensive, scalable, and secure solution for integrated urban services. Key capabilities include multi-role authentication, country-specific KYC, commission tracking with negative balance support, full service lifecycle management, and unified payout/payment section layouts.

## User Preferences
**Preferred communication style**: Simple, everyday language.

**Development approach**: Full-stack TypeScript with modern tooling, emphasizing code quality, security, and scalability.

## System Architecture

### UI/UX Decisions
The frontend uses React 18, TypeScript, Vite 5, shadcn/ui (Radix UI), Tailwind CSS 3, TanStack Query v5, wouter, and React Hook Form with Zod. It features a custom HSL-based color palette, Inter/Manrope typography, mobile-first responsive design, skeleton loading, toast notifications, error boundaries, protected routes with role-based access control, and a unified payout/payment section layout.

### Technical Implementations
The backend uses Node.js 20+, TypeScript, Express.js 4, and Prisma Client 6 with PostgreSQL 14+. It supports multi-role authentication, country-specific KYC with admin approval, and comprehensive service lifecycle management.

Key architectural features include:
- **Admin Capabilities**: An admin panel with an interactive dashboard, real-time data, a Document Center, a Wallet Settlement System, Global Earnings & Payout Analytics, and advanced analytics dashboards for various entities (drivers, customers, restaurants, revenue, security risk) with comprehensive defensive null checks.
- **Security & Compliance**: Admin Activity Audit Trail with IP tracking and PII masking, Global Admin Notification Center, Global Admin Settings Panel, advanced RBAC with 5 admin roles and 20 granular permissions (deny-by-default model), environment guard, security status indicators, secure UX components, real-time threat monitoring, and a comprehensive fraud detection engine.
- **Wallet & Earnings System**: A financial management system tracking earnings, commissions, negative balances, and payout processing, including automated payout scheduling, manual payout capabilities, and a reconciliation engine.
- **System Monitoring**: Real-time performance monitoring with telemetry hooks, system stability alerts, and an enterprise performance dashboard.
- **Automated Incident Response**: Fully automated incident response system including auto-locking suspicious users, token revocation, session invalidation, and automated fraud responses.
- **Support Chat System**: Real-time WebSocket-integrated support chat with full CRUD and RBAC checks.
- **Demo Mode**: A comprehensive demo data generation system with realistic multi-jurisdiction data for testing analytics, earnings, wallet, and RBAC systems. It includes `isDemo` flags on key models for safe separation of demo from production data and a CLI tool for generation and cleanup.

### Database Schema Design
The schema uses UUID primary keys, indexed foreign keys, decimal types for monetary values, and includes models for `Wallet`, `WalletTransaction`, `Payout`, `PayoutBatch`, `AuditLog`, `AdminNotification`, `PlatformSettings`, `PayoutAccount`, and `PaymentMethod`. It supports country-specific identity fields, driver profile photos, and vehicle documents. Several models (User, Ride, FoodOrder, Delivery, Wallet, WalletTransaction, Payout) include an `isDemo: Boolean @default(false)` field with indexes for managing demo data.

## External Dependencies

- **Backend Core**: `@prisma/client`, `express`, `bcrypt`, `jsonwebtoken`, `@neondatabase/serverless`.
- **Frontend Core**: `react`, `react-dom`, `wouter`, `@tanstack/react-query`, `react-hook-form`, `zod`.
- **UI Components (shadcn/ui)**: `@radix-ui/*`, `lucide-react`, `class-variance-authority`, `tailwind-merge`, `clsx`.
- **Environment Variables**: `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`, `ENCRYPTION_KEY`.