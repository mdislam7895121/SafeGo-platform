# SafeGo Global Super-App

## Overview
SafeGo is a production-ready, full-stack multi-service super-app platform designed for global market leadership in on-demand services such as ride-hailing, food delivery, and parcel delivery. It provides a comprehensive, scalable, and secure solution for integrated urban services, offering features like multi-role authentication, country-specific KYC, commission tracking, service lifecycle management, unified payment/payouts, multi-role support ticket management, and driver identity & profile management. The platform aims to be a competitive solution in the global on-demand services market.

## User Preferences
Preferred communication style: Simple, everyday language.
Development approach: Full-stack TypeScript with modern tooling, emphasizing code quality, security, and scalability.

## System Architecture

### UI/UX Decisions
The frontend uses React 18, TypeScript, Vite 5, shadcn/ui (Radix UI), Tailwind CSS 3, TanStack Query v5, wouter, and React Hook Form with Zod. It features a custom HSL color palette, Inter/Manrope typography, mobile-first responsive design, skeleton loading, toast notifications, error boundaries, and role-based access control. Key UI features include Uber-level profile experiences, multi-step onboarding, country-specific KYC, a dedicated Food System, and a robust Driver Profile System, with a focus on professional UI/UX, responsive layouts, and WCAG 2.1 AA compliance.

### Technical Implementations
The backend is built with Node.js 20+, TypeScript, Express.js 4, and Prisma Client 6 with PostgreSQL 14+. It utilizes a Generic Service Layer with Role Adapters for DRY principle adherence.

Core systems and features include:
-   **Admin Capabilities**: Interactive admin panel with dashboard, document management, wallet settlement, global earnings & payout analytics.
-   **Security & Compliance**: Admin Activity Audit Trail, Global Admin Notification Center, RBAC, secure UX, real-time threat monitoring, and fraud detection.
-   **Wallet & Earnings System**: Manages earnings, commissions, negative balances, and automated/manual payouts.
-   **Tax & Fees System**: Uber-style multi-country tax management with city-level overrides, various tax types, and specific reporting systems for the US and Bangladesh.
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
-   **Driver Profile System**: Supports multi-vehicle management with `isPrimary` and `isActive` flags, encrypted sensitive KYC fields, and a comprehensive document upload system. Features 181 vehicle models (180 predefined + "Other") across 25 manufacturers and 15 color options. Vehicle photo uploads removed per NYC/USA compliance requirements.
-   **Driver Public Profile Card (D2)**: ✅ COMPLETED - Uber/Lyft-style customer-facing driver preview with profile photo (circular avatar with fallback), vehicle details (type, model, color, license plate), driver stats (total rides, average rating, years active), pronouns support, and integrated safety message. Endpoint `GET /api/driver/public-profile/:driver_profile_id` uses driver_profile table primary key for all lookups and returns safe, non-sensitive fields. Stats calculated from completed rides count and customer rating reviews (not driverStats). Component `<DriverPreviewCard />` displays formatted stats ("5.0k+ Rides | ★5.0 Rating | 4.8 Years"), license plate badge with yellow styling, and vehicle icon (ready for 3D render assets). Fully integrated across customer pages: ride-details, ride-assigned, order-confirmation, and public driver profile view (/customer/driver/:driver_profile_id). Test driver "Michael James Rodriguez" (ID: 4f90b2e4-e726-46f9-9a8c-67884d4a48cc) with 7 completed rides, 4.71★ rating. Pronouns field reserved for future schema update.
-   **API Design**: Robust API endpoints with enforcement of KYC, ownership validation, UUID format validation, Zod schema validation, atomic transactions, and consistent error handling.

### Database Schema Design
The schema uses UUID primary keys, indexed foreign keys, and decimal types for monetary values. It includes models for wallets, payouts, audit logs, notifications, platform settings, payment/payout accounts, opportunity settings, driver tiers and points, blocked riders, reviews, restaurant branding, media, hours, operational settings, delivery zones, surge settings, country payment/payout configurations, restaurant payout methods, categories, subcategories, menu item categories, promotion usage, and multi-role support models. It supports country-specific identity fields with AES-256-GCM encryption and includes flags for demo mode, US tax fields, driver preferences, and enhancements for promotions/coupons and review replies.

## External Dependencies

-   **Backend Core**: `@prisma/client`, `express`, `bcrypt`, `jsonwebtoken`, `@neondatabase/serverless`.
-   **Frontend Core**: `react`, `react-dom`, `wouter`, `@tanstack/react-query`, `react-hook-form`, `zod`.
-   **UI Components**: `@radix-ui/*`, `lucide-react`, `class-variance-authority`, `tailwind-merge`, `clsx`.
-   **Environment Variables**: `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`, `ENCRYPTION_KEY`.