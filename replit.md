# SafeGo Global Super-App

## Overview
SafeGo is a production-ready, full-stack multi-service super-app platform for global on-demand services like ride-hailing, food delivery, and parcel delivery. Its purpose is to be a leading global super-app by offering a comprehensive, scalable, and secure solution for integrated urban services. Key capabilities include multi-role authentication, country-specific KYC, commission tracking with negative balance support, full service lifecycle management, and unified payout/payment section layouts. The project aims for global market leadership in the super-app space.

## User Preferences
**Preferred communication style**: Simple, everyday language.

**Development approach**: Full-stack TypeScript with modern tooling, emphasizing code quality, security, and scalability.

## System Architecture

### UI/UX Decisions
The frontend uses React 18, TypeScript, Vite 5, shadcn/ui (Radix UI), Tailwind CSS 3, TanStack Query v5, wouter, and React Hook Form with Zod. It features a custom HSL-based color palette, Inter/Manrope typography, mobile-first responsive design, skeleton loading, toast notifications, error boundaries, protected routes with role-based access control, and a unified payout/payment section layout.

### Technical Implementations
The backend uses Node.js 20+, TypeScript, Express.js 4, and Prisma Client 6 with PostgreSQL 14+. It supports multi-role authentication, country-specific KYC with admin approval, and comprehensive service lifecycle management.

Key architectural features include:
- **Admin Capabilities**: Admin panel with interactive dashboard, real-time data, Document Center, Wallet Settlement System, Global Earnings & Payout Analytics, and advanced analytics.
- **Security & Compliance**: Admin Activity Audit Trail, Global Admin Notification Center, Global Admin Settings Panel, advanced Role-Based Access Control (RBAC) with 5 admin roles and 20 granular permissions (deny-by-default model), secure UX components, real-time threat monitoring, and a comprehensive fraud detection engine with automated incident response.
- **Wallet & Earnings System**: Financial management system tracking earnings, commissions, negative balances, and payout processing, including automated/manual payouts and reconciliation.
- **System Monitoring**: Real-time performance monitoring, system stability alerts, and an enterprise performance dashboard.
- **Support Chat System**: Real-time WebSocket-integrated support chat with full CRUD and RBAC checks.
- **Demo Mode**: Comprehensive demo data generation system with realistic multi-jurisdiction data.

### Database Schema Design
The schema uses UUID primary keys, indexed foreign keys, decimal types for monetary values, and includes models for `Wallet`, `WalletTransaction`, `Payout`, `PayoutBatch`, `AuditLog`, `AdminNotification`, `PlatformSettings`, `PayoutAccount`, and `PaymentMethod`. It supports country-specific identity fields and includes `isDemo: Boolean @default(false)`.

## External Dependencies

- **Backend Core**: `@prisma/client`, `express`, `bcrypt`, `jsonwebtoken`, `@neondatabase/serverless`.
- **Frontend Core**: `react`, `react-dom`, `wouter`, `@tanstack/react-query`, `react-hook-form`, `zod`.
- **UI Components (shadcn/ui)**: `@radix-ui/*`, `lucide-react`, `class-variance-authority`, `tailwind-merge`, `clsx`.
- **Environment Variables**: `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`, `ENCRYPTION_KEY`.