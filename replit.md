# SafeGo Global Super-App

## Overview
SafeGo is a production-ready, full-stack multi-service super-app platform designed for global on-demand services such as ride-hailing, food delivery, and parcel delivery. The project's vision is to become a leading global super-app by offering a comprehensive, scalable, and secure solution for integrated urban services. Key capabilities include multi-role authentication, country-specific KYC with admin approval, commission tracking with negative balance support, full service lifecycle management, and unified payout/payment section layouts. SafeGo aims for global market leadership in the super-app space.

## User Preferences
**Preferred communication style**: Simple, everyday language.

**Development approach**: Full-stack TypeScript with modern tooling, emphasizing code quality, security, and scalability.

## System Architecture

### UI/UX Decisions
The frontend utilizes React 18, TypeScript, Vite 5, shadcn/ui (Radix UI), Tailwind CSS 3, TanStack Query v5, wouter, and React Hook Form with Zod. It features a custom HSL-based color palette, Inter/Manrope typography, mobile-first responsive design, skeleton loading states, toast notifications, error boundaries, protected routes with role-based access control, and a unified payout/payment section layout. The Customer Web App includes multi-step onboarding, country-specific KYC management, service booking, and a dedicated Food System with restaurant and menu browsing.

### Technical Implementations
The backend is built with Node.js 20+, TypeScript, Express.js 4, and Prisma Client 6 with PostgreSQL 14+. It supports multi-role authentication, country-specific KYC, and comprehensive service lifecycle management.

Key architectural features include:
- **Admin Capabilities**: An interactive admin panel with a dashboard, Document Center, Wallet Settlement System, Global Earnings & Payout Analytics, and advanced analytics.
- **Security & Compliance**: Admin Activity Audit Trail, Global Admin Notification Center, Global Admin Settings Panel, advanced Role-Based Access Control (RBAC) with granular permissions, secure UX components, real-time threat monitoring, and a fraud detection engine.
- **Wallet & Earnings System**: A financial management system tracking earnings, commissions, negative balances, and automated/manual payout processing.
- **Tax & Fees System**: Uber-style multi-country tax management with city-level overrides, supporting 7 tax types (VAT, Sales Tax, Government Service Fee, Marketplace Facilitator Tax, Trip Fee, Local Municipality Fee, Regulatory Fee). Tax calculations use a simple stacking method, and a detailed tax breakdown is stored in all transaction records.
- **System Monitoring**: Real-time performance monitoring, stability alerts, and an enterprise performance dashboard.
- **Support Chat System**: Real-time WebSocket-integrated support chat with full CRUD and RBAC checks.
- **Demo Mode**: Comprehensive demo data generation for multi-jurisdiction scenarios.

### Database Schema Design
The schema uses UUID primary keys, indexed foreign keys, decimal types for monetary values, and includes models for `Wallet`, `WalletTransaction`, `Payout`, `PayoutBatch`, `AuditLog`, `AdminNotification`, `PlatformSettings`, `PayoutAccount`, and `PaymentMethod`. It supports country-specific identity fields and an `isDemo` flag.

## External Dependencies

- **Backend Core**: `@prisma/client`, `express`, `bcrypt`, `jsonwebtoken`, `@neondatabase/serverless`.
- **Frontend Core**: `react`, `react-dom`, `wouter`, `@tanstack/react-query`, `react-hook-form`, `zod`.
- **UI Components**: `@radix-ui/*`, `lucide-react`, `class-variance-authority`, `tailwind-merge`, `clsx`.
- **Environment Variables**: `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`, `ENCRYPTION_KEY`.