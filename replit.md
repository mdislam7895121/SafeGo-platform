# SafeGo Global Super-App

## Overview
SafeGo is a production-ready, full-stack multi-service super-app platform designed for global market leadership in on-demand services such as ride-hailing, food delivery, and parcel delivery. Its purpose is to provide a comprehensive, scalable, and secure solution for integrated urban services. Key capabilities include multi-role authentication, country-specific KYC, commission tracking with negative balance support, full service lifecycle management, unified payment/payout layouts, and comprehensive multi-role support ticket management.

## User Preferences
**Preferred communication style**: Simple, everyday language.
**Development approach**: Full-stack TypeScript with modern tooling, emphasizing code quality, security, and scalability.

## System Architecture

### UI/UX Decisions
The frontend utilizes React 18, TypeScript, Vite 5, shadcn/ui (Radix UI), Tailwind CSS 3, TanStack Query v5, wouter, and React Hook Form with Zod. It incorporates a custom HSL color palette, Inter/Manrope typography, mobile-first responsive design, skeleton loading, toast notifications, error boundaries, and role-based access controlled routes. Specific features include Uber-level profile experiences, multi-step onboarding, country-specific KYC, a dedicated Food System, and a robust Driver Profile System. The SafeGo Eats restaurant portal features a professional UI/UX, including a redesigned header, unified feature placeholders, a comprehensive responsive layout system, and WCAG 2.1 AA compliant search and notification UX.

### Technical Implementations
The backend is built with Node.js 20+, TypeScript, Express.js 4, and Prisma Client 6 with PostgreSQL 14+. A Generic Service Layer with Role Adapters is used for DRY principle implementation across various services.

Core systems and features include:
-   **Admin Capabilities**: Interactive admin panel with dashboard, Document Center, Wallet Settlement, Global Earnings & Payout Analytics, and advanced analytics.
-   **Security & Compliance**: Admin Activity Audit Trail, Global Admin Notification Center, RBAC, secure UX, real-time threat monitoring, and fraud detection.
-   **Wallet & Earnings System**: Manages earnings, commissions, negative balances, and automated/manual payouts.
-   **Tax & Fees System**: Uber-style multi-country tax management with city-level overrides and 7 tax types, including US 1099 Tax System and Bangladesh Tax Reporting System.
-   **Multi-Role Multi-Channel Support Center**: AI-first chat with 4-role support, two-tier escalation, automatic/manual escalation, and an Admin Live Support Console. This system supports Live Chat, Phone Support, and Email/Ticket Support across all user roles with dedicated database models, a generic service layer with role-specific adapters, and comprehensive backend APIs.
-   **Demo Mode**: Comprehensive demo data generation for multi-jurisdiction scenarios.
-   **Opportunity Bonus Management System**: Admin-managed ride incentives with country-specific amounts, campaigns, and zone-based targeting for drivers.
-   **SafeGo Points System**: Uber Pro-style gamified loyalty program with 3 exclusive tiers and 90-day cycles.
-   **Driver Wallet System**: Displays balance, payouts, and transaction timeline, supporting country-specific currencies.
-   **Identity Verification System**: Country-specific identity document management with AES-256-GCM encryption.
-   **Driver Account Settings & Preferences System**: Comprehensive account management with APIs for personal info updates and preference management.
-   **Blocked Riders System**: Allows drivers to block specific customers.
-   **Restaurant Analytics & Management Systems**: Includes Performance Insights with KPI tracking, time-series charts, and recent orders table. Also includes Review & Rating Management, Media Gallery & Branding Management, and Operational Settings System.
-   **Restaurant Order Management System**: Production-ready order lifecycle management enabling restaurant staff to accept/reject/update order status with real-time synchronization. Implements React Query key factory pattern for hierarchical cache management.
-   **Restaurant Staff & Role Management System**: Enables restaurant owners to invite team members, assign granular permissions, and track staff activity.
-   **Restaurant Promotions & Coupon Management System**: Allows creation, management, and tracking of promotional campaigns. Features 8 promotion management endpoints with KYC-gated access control and full audit logging.
-   **Restaurant Reviews & Ratings System**: Enables customers to leave reviews, restaurants to reply, and admins to moderate content.
-   **Restaurant Earnings & Commission Center**: Manages commission tracking and earnings for the SafeGo Eats restaurant portal, including hierarchical commission calculation and wallet integration for reversals.
-   **Relational Menu Category System with Smart Search & Auto-Suggest**: Provides a fully relational categorization system for SafeGo Eats with smart category search and an auto-suggest engine.
-   **Customer-Facing Dynamic Pricing Display**: Real-time pricing transparency system showing surge multipliers, active promotions, coupon eligibility, and pricing breakdowns.
-   **Payment & Payout Configuration System**: Enterprise-grade implementation for managing customer payment methods and payout rails by country, service type, actor type, and KYC level.
-   **Unified Payout System**: Production-ready payout infrastructure for individual withdrawals across all user roles with unified API routes. Features include automatic weekly payout scheduling, bank verification, country-specific minimum payout amounts, and comprehensive withdrawal request validation.

### Database Schema Design
The schema uses UUID primary keys, indexed foreign keys, and decimal types for monetary values. It includes models for wallets, payouts, audit logs, notifications, platform settings, payment/payout accounts, opportunity settings, driver tiers and points, blocked riders, reviews, restaurant branding, media, hours, operational settings, delivery zones, surge settings, country payment/payout configurations, restaurant payout methods, categories, subcategories, menu item categories, promotion usage, and multi-role support models. It supports country-specific identity fields with AES-256-GCM encryption and includes flags for demo mode, US tax fields, driver preferences, and enhancements for promotions/coupons and review replies.

## External Dependencies

-   **Backend Core**: `@prisma/client`, `express`, `bcrypt`, `jsonwebtoken`, `@neondatabase/serverless`.
-   **Frontend Core**: `react`, `react-dom`, `wouter`, `@tanstack/react-query`, `react-hook-form`, `zod`.
-   **UI Components**: `@radix-ui/*`, `lucide-react`, `class-variance-authority`, `tailwind-merge`, `clsx`.
-   **Environment Variables**: `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`, `ENCRYPTION_KEY`.