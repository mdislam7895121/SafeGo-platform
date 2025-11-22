# SafeGo Global Super-App

## Overview
SafeGo is a production-ready, full-stack multi-service super-app platform offering global on-demand services like ride-hailing, food delivery, and parcel delivery. Its primary purpose is to achieve global market leadership by providing a comprehensive, scalable, and secure solution for integrated urban services. Key capabilities include multi-role authentication, country-specific KYC with admin approval, commission tracking with negative balance support, full service lifecycle management, and unified payout/payment section layouts.

## User Preferences
**Preferred communication style**: Simple, everyday language.

**Development approach**: Full-stack TypeScript with modern tooling, emphasizing code quality, security, and scalability.

## System Architecture

### UI/UX Decisions
The frontend uses React 18, TypeScript, Vite 5, shadcn/ui (Radix UI), Tailwind CSS 3, TanStack Query v5, wouter, and React Hook Form with Zod. It features a custom HSL color palette, Inter/Manrope typography, mobile-first responsive design, skeleton loading states, toast notifications, error boundaries, protected routes with role-based access control, and a unified payout/payment section. The Customer Web App includes multi-step onboarding, country-specific KYC, service booking, and a dedicated Food System. Profile experiences for customers and drivers are designed to Uber-level quality with modern UI and enhanced features. The Driver Web App incorporates a unified navigation layout.

### Technical Implementations
The backend is built with Node.js 20+, TypeScript, Express.js 4, and Prisma Client 6 with PostgreSQL 14+. It supports multi-role authentication, country-specific KYC, and comprehensive service lifecycle management. Core features include:
- **Admin Capabilities**: An interactive admin panel with a dashboard, Document Center, Wallet Settlement System, Global Earnings & Payout Analytics, and advanced analytics.
- **Security & Compliance**: Admin Activity Audit Trail, Global Admin Notification Center, Global Admin Settings Panel, advanced Role-Based Access Control (RBAC), secure UX components, real-time threat monitoring, and a fraud detection engine.
- **Wallet & Earnings System**: Financial management for tracking earnings, commissions, negative balances, and automated/manual payout processing.
- **Tax & Fees System**: Uber-style multi-country tax management with city-level overrides, supporting 7 tax types (VAT, Sales Tax, Government Service Fee, Marketplace Facilitator Tax, Trip Fee, Local Municipality Fee, Regulatory Fee). Tax calculations use a simple stacking method, and a detailed tax breakdown is stored in all transaction records.
- **System Monitoring**: Real-time performance monitoring, stability alerts, and an enterprise performance dashboard.
- **Support Chat System**: Real-time WebSocket-integrated support chat with full CRUD and RBAC checks.
- **Demo Mode**: Comprehensive demo data generation for multi-jurisdiction scenarios.
- **Opportunity Bonus Management System**: Allows admins to create and manage ride incentives with country-specific amounts, promotional campaigns, and zone-based targeting. Drivers view dynamic opportunity bonuses on their Promotions page.
- **Driver Loyalty Points Tier System**: Uber Pro-style gamified loyalty program with 4 tiers (Blue, Gold, Premium, Diamond). Drivers earn points through trips (10 points/trip default), advance through tiers automatically, and unlock progressive benefits. Features tier progress visualization, points transaction history with pagination, and configurable points rules.
- **Driver Wallet System**: Uber-style wallet experience with SafeGo branding featuring two main pages: (1) Wallet Home displaying current balance, recent payouts, payout method, and cash-out button; (2) Balance Details showing transaction timeline with date grouping, type filters, and summary breakdown. Includes 7 backend APIs for wallet management: summary, payouts, balance timeline, transaction details, payout method, and cash-out. All monetary values properly serialized from Prisma Decimal to numbers to prevent frontend calculation errors. Features country-specific currency display (USD/$, BDT/৳), negative balance warnings, minimum cash-out validation (BDT 100, USD 5), and masked payout account display for security.
- **Identity Verification System**: Country-specific identity document management with encrypted storage and masking for sensitive data. Bangladesh drivers provide National ID (NID) number and image; USA drivers provide Social Security Number (SSN) and card image. All identity numbers encrypted using AES-256-GCM before storage, with only masked values (last 4 digits) displayed to users. Features country-specific access control (BD drivers cannot access SSN endpoints, US drivers cannot access NID endpoints), edit/save workflow with validation, and integration with KYC completeness checks.
- **US 1099 Tax System**: Complete rideshare driver tax management following IRS 1099-K and 1099-NEC model. Features W-9 form with certification checkbox, automatic earnings categorization into two buckets (trip revenue for 1099-K, non-trip income for 1099-NEC), year-to-date tax totals tracking, and downloadable tax documents. Drivers complete W-9 certification, system automatically categorizes all wallet transactions, and provides tax summaries and document downloads. Backend includes TaxService for calculations, tax summary/document API endpoints, and secure encrypted storage of all tax information. Tax documents are US-driver only with IRS threshold checking ($600 minimum).

### Database Schema Design
The schema uses UUID primary keys, indexed foreign keys, decimal types for monetary values, and includes models for `Wallet`, `WalletTransaction`, `Payout`, `PayoutBatch`, `AuditLog`, `AdminNotification`, `PlatformSettings`, `PayoutAccount`, `PaymentMethod`, `OpportunitySetting`, `OpportunityReward`, `DriverTier`, `DriverPoints`, `TierBenefit`, `PointsRule`, and `PointsTransaction`. It supports country-specific identity fields (`nidEncrypted`, `nidImageUrl`, `ssnEncrypted`, `ssnCardImageUrl`, `ssnLast4`) and an `isDemo` flag. Identity numbers are encrypted using AES-256-GCM before storage for security compliance. US tax system fields include `taxCertificationAccepted`, `taxCertificationDate`, `tripRevenueTotalYtd`, `nonTripIncomeTotalYtd`, and `taxYear` in DriverProfile for 1099 tax tracking.

## External Dependencies

- **Backend Core**: `@prisma/client`, `express`, `bcrypt`, `jsonwebtoken`, `@neondatabase/serverless`.
- **Frontend Core**: `react`, `react-dom`, `wouter`, `@tanstack/react-query`, `react-hook-form`, `zod`.
- **UI Components**: `@radix-ui/*`, `lucide-react`, `class-variance-authority`, `tailwind-merge`, `clsx`.
- **Environment Variables**: `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`, `ENCRYPTION_KEY`.