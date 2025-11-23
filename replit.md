# SafeGo Global Super-App

## Overview
SafeGo is a production-ready, full-stack multi-service super-app platform designed for global market leadership in on-demand services such as ride-hailing, food delivery, and parcel delivery. It offers a comprehensive, scalable, and secure solution for integrated urban services, featuring multi-role authentication, country-specific KYC, commission tracking with negative balance support, full service lifecycle management, unified payment/payout layouts, and comprehensive multi-role support ticket management system.

## User Preferences
**Preferred communication style**: Simple, everyday language.
**Development approach**: Full-stack TypeScript with modern tooling, emphasizing code quality, security, and scalability.

## System Architecture

### UI/UX Decisions
The frontend utilizes React 18, TypeScript, Vite 5, shadcn/ui (Radix UI), Tailwind CSS 3, TanStack Query v5, wouter, and React Hook Form with Zod. It employs a custom HSL color palette, Inter/Manrope typography, mobile-first responsive design, skeleton loading, toast notifications, error boundaries, and role-based access controlled routes. Specific features include Uber-level profile experiences for customers and drivers, multi-step onboarding, country-specific KYC, a dedicated Food System, and a robust Driver Profile System. Recent enhancements include a professional UI/UX upgrade for the SafeGo Eats restaurant portal, featuring a redesigned header, unified feature placeholders, a comprehensive responsive layout system, and enhanced search and notification UX that is WCAG 2.1 AA compliant.

### Technical Implementations
The backend is built with Node.js 20+, TypeScript, Express.js 4, and Prisma Client 6 with PostgreSQL 14+. Key features and systems include:
-   **Admin Capabilities**: Interactive admin panel with dashboard, Document Center, Wallet Settlement, Global Earnings & Payout Analytics, and advanced analytics.
-   **Security & Compliance**: Admin Activity Audit Trail, Global Admin Notification Center, RBAC, secure UX, real-time threat monitoring, and fraud detection.
-   **Wallet & Earnings System**: Manages earnings, commissions, negative balances, and automated/manual payouts.
-   **Tax & Fees System**: Uber-style multi-country tax management with city-level overrides and 7 tax types. Includes US 1099 Tax System and Bangladesh Tax Reporting System.
-   **System Monitoring**: Real-time performance monitoring, stability alerts, and an enterprise performance dashboard.
-   **Bot-First Support System**: AI-first support chat with 4-role support, pre-chat verification, two-tier escalation (bot FAQ → human agent), automatic and manual escalation, and an Admin Live Support Console. A comprehensive multi-service support ticket management system for customers, restaurants, and admins has been implemented.
-   **Demo Mode**: Comprehensive demo data generation for multi-jurisdiction scenarios.
-   **Opportunity Bonus Management System**: Admin-managed ride incentives with country-specific amounts, campaigns, and zone-based targeting for drivers.
-   **SafeGo Points System**: Uber Pro-style gamified loyalty program with 3 exclusive tiers and 90-day cycles based on time-based trip points.
-   **Driver Wallet System**: Uber-style wallet experience displaying balance, payouts, transaction timeline, and supporting country-specific currencies.
-   **Identity Verification System**: Country-specific identity document management with AES-256-GCM encryption.
-   **Driver Account Settings & Preferences System**: Comprehensive account management with APIs for personal info updates and preference management.
-   **Blocked Riders System**: Allows drivers to block specific customers from future matches.
-   **Restaurant Analytics & Management Systems**: Includes an Order Analytics & Performance Dashboard, a Review & Rating Management System (with customer identity masking and admin moderation), a Media Gallery & Branding Management System, and an Operational Settings System (with business hours, delivery/pickup settings, delivery zones, and surge pricing).
-   **Customer-Facing Dynamic Pricing Display**: Real-time pricing transparency system showing surge multipliers, active promotions, coupon eligibility, and pricing breakdowns.
-   **R-ENHANCE UI/UX Improvements**: Completed professional polish initiative for restaurant portal including layout standardization (space-y-6), unified FeaturePlaceholderLayout system for all planned features, WCAG 2.1 AA compliant search/notification UX, and API migration to new apiRequest pattern with FormData support. Fixed restaurant payouts overview 404 by adding /restaurant/payouts/overview route (OWNER-only).

## Recent Changes

### November 23, 2025 - R-ENHANCE Completion & Payment Configuration Spec
- **R-ENHANCE Tasks 1-6 Complete**: All UI/UX improvements completed including layout standardization, search/notification UX, API migration, and support pages polishing.
- **Route Fix**: Added missing `/restaurant/payouts/overview` route (OWNER-only) to resolve 404 errors in restaurant portal.
- **Placeholder Unification**: Migrated all planned feature pages to unified FeaturePlaceholderLayout system (support-contact.tsx with Mail icon, support-status.tsx with Activity icon).
- **Application Status**: Running successfully on port 5000 with all routes functional and no runtime errors.
- **New Specification Received**: Payment & Payout Configuration system specification for country-aware, multi-method payment/payout architecture supporting BD and US markets with extensibility for future countries. Scope includes shared enums, configuration models, admin UI, restaurant payout methods, driver placeholders, and customer payment options service.

### Database Schema Design
The schema uses UUID primary keys, indexed foreign keys, and decimal types for monetary values. It includes models for `Wallet`, `WalletTransaction`, `Payout`, `PayoutBatch`, `AuditLog`, `AdminNotification`, `PlatformSettings`, `PayoutAccount`, `PaymentMethod`, `OpportunitySetting`, `OpportunityReward`, `DriverTier`, `DriverPoints`, `TierBenefit`, `PointsRule`, `PointsTransaction`, `BlockedRider`, `Review`, `RestaurantBranding`, `RestaurantMedia`, `RestaurantHours`, `OperationalSettings`, `DeliveryZone`, and `SurgeSettings`. It supports country-specific identity fields with AES-256-GCM encryption and includes an `isDemo` flag, fields for US tax and driver preferences, and operational settings like business hours with split shifts, delivery zones, and surge pricing.

## External Dependencies

-   **Backend Core**: `@prisma/client`, `express`, `bcrypt`, `jsonwebtoken`, `@neondatabase/serverless`.
-   **Frontend Core**: `react`, `react-dom`, `wouter`, `@tanstack/react-query`, `react-hook-form`, `zod`.
-   **UI Components**: `@radix-ui/*`, `lucide-react`, `class-variance-authority`, `tailwind-merge`, `clsx`.
-   **Environment Variables**: `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`, `ENCRYPTION_KEY`.