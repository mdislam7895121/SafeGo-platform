# SafeGo Global Super-App

## Overview
SafeGo is a production-ready, full-stack multi-service super-app platform for global on-demand services like ride-hailing, food delivery, and parcel delivery. It offers a scalable and secure solution with features such as multi-role authentication, country-specific KYC, commission tracking, service lifecycle management, unified payment/payouts, multi-role support ticket management, and driver identity & profile management. The platform aims for leadership in the global on-demand services market.

## User Preferences
Preferred communication style: Simple, everyday language.
Development approach: Full-stack TypeScript with modern tooling, emphasizing code quality, security, and scalability.

## System Architecture

### UI/UX Decisions
The frontend uses React 18, TypeScript, Vite 5, shadcn/ui (Radix UI), Tailwind CSS 3, TanStack Query v5, wouter, and React Hook Form with Zod. It features a custom HSL color palette, Inter/Manrope typography, mobile-first responsive design, skeleton loading, toast notifications, error boundaries, and role-based access control. Key UI features include Uber-level profile experiences, multi-step onboarding, country-specific KYC, a dedicated Food System, a robust Driver Profile System, professional UI/UX, responsive layouts, and WCAG 2.1 AA compliance.

### Technical Implementations
The backend is built with Node.js 20+, TypeScript, Express.js 4, and Prisma Client 6 with PostgreSQL 14+. It utilizes a Generic Service Layer with Role Adapters.

Core systems and features include:
-   **Admin Capabilities**: Interactive admin panel with dashboard, document management, wallet settlement, global earnings & payout analytics.
-   **Security & Compliance**: Admin Activity Audit Trail, Global Admin Notification Center, RBAC, secure UX, real-time threat monitoring, and fraud detection.
-   **Wallet & Earnings System**: Manages earnings, commissions, negative balances, and automated/manual payouts.
-   **Tax & Fees System**: Uber-style multi-country tax management with city-level overrides, various tax types, and specific reporting.
-   **Multi-Role Multi-Channel Support Center**: AI-first chat with 4-role support, two-tier escalation, and an Admin Live Support Console.
-   **Opportunity Bonus Management System**: Admin-managed ride incentives with country-specific amounts, campaigns, and zone-based targeting for drivers.
-   **SafeGo Points System**: Uber Pro-style gamified loyalty program with 3 tiers and 90-day cycles.
-   **Identity Verification System**: Country-specific identity document management with AES-256-GCM encryption.
-   **Driver Account Settings & Preferences System**: Comprehensive account management with APIs for personal info updates and preference management.
-   **Blocked Riders System**: Allows drivers to block specific customers.
-   **Restaurant Management Systems**: Includes Performance Insights, Review & Rating Management, Media Gallery & Branding, and Operational Settings.
-   **Restaurant Order Management System**: Production-ready order lifecycle management with real-time synchronization.
-   **Restaurant Staff & Role Management System**: Enables owners to invite team members, assign granular permissions, and track activity.
-   **Restaurant Promotions & Coupon Management System**: Allows creation, management, and tracking of promotional campaigns.
-   **Customer-Facing Dynamic Pricing Display**: Real-time pricing transparency system showing surge multipliers, promotions, coupon eligibility, and pricing breakdowns.
-   **Payment & Payout Configuration System**: Enterprise-grade management for customer payment methods and payout rails by country, service type, actor type, and KYC level.
-   **Unified Payout System**: Production-ready payout infrastructure for individual withdrawals across all user roles with unified API routes, automatic weekly scheduling, bank verification, and comprehensive validation.
-   **Driver Profile System**: Supports multi-vehicle management with `isPrimary` and `isActive` flags, encrypted sensitive KYC fields, and a comprehensive document upload system. Features 181 vehicle models across 25 manufacturers and 15 color options.
-   **Vehicle Catalog System**: Centralized vehicle data management with 25 brands, 180+ models, and 15 standard colors.
-   **Driver Public Profile Card**: Customer-facing driver preview with profile photo, vehicle details, driver stats, pronouns support, and integrated safety message.
-   **Driver Earnings & Payout Dashboard**: Comprehensive earnings visibility and payout management system including summary, breakdown, transaction history, payout requests, and payout history.
-   **Driver Promotions & Incentives System**: Comprehensive bonus management system allowing admins to create trip-based promotions with automated progress tracking and automatic payouts. Supports `PER_TRIP_BONUS`, `QUEST_TRIPS`, `EARNINGS_THRESHOLD` promotion types, service types targeting, geographic targeting, and DRAFT → ACTIVE → PAUSED/ENDED workflow.
-   **Driver Document Management System**: Comprehensive document upload, verification, and management infrastructure with granular status tracking for individual documents and country-specific requirements.
-   **API Design**: Robust API endpoints with enforcement of KYC, ownership validation, UUID format validation, Zod schema validation, atomic transactions, and consistent error handling.

### Admin KYC Approvals Response Contract
The Admin KYC Approvals page (`/admin/kyc`) uses proper JSON response handling for approve, reject, and pending requests, with consistent success/error messages and cache invalidation.

### Database Schema Design
The schema uses UUID primary keys, indexed foreign keys, and decimal types for monetary values. It includes models for wallets, payouts, audit logs, notifications, platform settings, payment/payout accounts, opportunity settings, driver tiers and points, blocked riders, reviews, restaurant branding, media, hours, operational settings, delivery zones, surge settings, country payment/payout configurations, restaurant payout methods, categories, subcategories, menu item categories, promotion usage, and multi-role support models. It supports country-specific identity fields with AES-256-GCM encryption and includes flags for demo mode, US tax fields, driver preferences, and enhancements for promotions/coupons and review replies.

## External Dependencies

-   **Backend Core**: `@prisma/client`, `express`, `bcrypt`, `jsonwebtoken`, `@neondatabase/serverless`.
-   **Frontend Core**: `react`, `react-dom`, `wouter`, `@tanstack/react-query`, `react-hook-form`, `zod`.
-   **UI Components**: `@radix-ui/*`, `lucide-react`, `class-variance-authority`, `tailwind-merge`, `clsx`.
-   **Environment Variables**: `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`, `ENCRYPTION_KEY`.