# SafeGo Global Super-App

## Overview
SafeGo is a production-ready, full-stack multi-service super-app platform designed for global market leadership in on-demand services such as ride-hailing, food delivery, and parcel delivery. It offers a comprehensive, scalable, and secure solution for integrated urban services, featuring multi-role authentication, country-specific KYC, commission tracking with negative balance support, full service lifecycle management, unified payment/payout layouts, and comprehensive multi-role support ticket management system.

## User Preferences
**Preferred communication style**: Simple, everyday language.
**Development approach**: Full-stack TypeScript with modern tooling, emphasizing code quality, security, and scalability.

## System Architecture

### UI/UX Decisions
The frontend utilizes React 18, TypeScript, Vite 5, shadcn/ui (Radix UI), Tailwind CSS 3, TanStack Query v5, wouter, and React Hook Form with Zod. It employs a custom HSL color palette, Inter/Manrope typography, mobile-first responsive design, skeleton loading, toast notifications, error boundaries, and role-based access controlled routes. Specific features include Uber-level profile experiences, multi-step onboarding, country-specific KYC, a dedicated Food System, and a robust Driver Profile System. Recent enhancements include a professional UI/UX upgrade for the SafeGo Eats restaurant portal, featuring a redesigned header, unified feature placeholders, a comprehensive responsive layout system, and enhanced search and notification UX that is WCAG 2.1 AA compliant.

### Technical Implementations
The backend is built with Node.js 20+, TypeScript, Express.js 4, and Prisma Client 6 with PostgreSQL 14+. Key systems include:
-   **Admin Capabilities**: Interactive admin panel with dashboard, Document Center, Wallet Settlement, Global Earnings & Payout Analytics, and advanced analytics.
-   **Security & Compliance**: Admin Activity Audit Trail, Global Admin Notification Center, RBAC, secure UX, real-time threat monitoring, and fraud detection.
-   **Wallet & Earnings System**: Manages earnings, commissions, negative balances, and automated/manual payouts.
-   **Tax & Fees System**: Uber-style multi-country tax management with city-level overrides and 7 tax types, including US 1099 Tax System and Bangladesh Tax Reporting System.
-   **Bot-First Support System**: AI-first chat with 4-role support, two-tier escalation, automatic/manual escalation, and an Admin Live Support Console. Includes a comprehensive multi-service support ticket management system.
-   **Restaurant Support Center**: Production-ready general support system with Help Center (FAQ categories), Contact Support (ticket creation with collision-free codes, message threading), and System Status pages, implementing enterprise-grade security with KYC/RBAC gating and audit logging.
-   **Demo Mode**: Comprehensive demo data generation for multi-jurisdiction scenarios.
-   **Opportunity Bonus Management System**: Admin-managed ride incentives with country-specific amounts, campaigns, and zone-based targeting for drivers.
-   **SafeGo Points System**: Uber Pro-style gamified loyalty program with 3 exclusive tiers and 90-day cycles.
-   **Driver Wallet System**: Displays balance, payouts, and transaction timeline, supporting country-specific currencies.
-   **Identity Verification System**: Country-specific identity document management with AES-256-GCM encryption.
-   **Driver Account Settings & Preferences System**: Comprehensive account management with APIs for personal info updates and preference management.
-   **Blocked Riders System**: Allows drivers to block specific customers.
-   **Restaurant Analytics & Management Systems**: Includes Order Analytics & Performance Dashboard, Review & Rating Management, Media Gallery & Branding Management, and Operational Settings System (business hours, delivery/pickup settings, delivery zones, surge pricing).
-   **Customer-Facing Dynamic Pricing Display**: Real-time pricing transparency system showing surge multipliers, active promotions, coupon eligibility, and pricing breakdowns.
-   **Multi-Channel Support Center**: Production-ready, enterprise-grade three-channel support system (Live Chat, Phone Support, Email Support) with dedicated database models, backend services, and APIs. Features include real-time messaging, callback scheduling, searchable articles, ticket management with collision-free codes, and comprehensive security measures.
-   **Payment & Payout Configuration System**: Enterprise-grade implementation for managing customer payment methods and payout rails by country, service type, actor type, and KYC level. Features anti-spoofing measures, AES-256-GCM encryption for sensitive metadata, country/provider/KYC validation, and full audit logging for all operations.

### Database Schema Design
The schema uses UUID primary keys, indexed foreign keys, and decimal types for monetary values. It includes models for `Wallet`, `WalletTransaction`, `Payout`, `PayoutBatch`, `AuditLog`, `AdminNotification`, `PlatformSettings`, `PayoutAccount`, `PaymentMethod`, `OpportunitySetting`, `OpportunityReward`, `DriverTier`, `DriverPoints`, `TierBenefit`, `PointsRule`, `PointsTransaction`, `BlockedRider`, `Review`, `RestaurantBranding`, `RestaurantMedia`, `RestaurantHours`, `OperationalSettings`, `DeliveryZone`, `SurgeSettings`, `CountryPaymentConfig`, `CountryPayoutConfig`, `RestaurantPayoutMethod`, `LiveChatSession`, `LiveChatMessage`, `SupportCallback`, `SupportArticle`, `RestaurantSupportTicket`, and `RestaurantSupportMessage`. It supports country-specific identity fields with AES-256-GCM encryption and includes an `isDemo` flag, fields for US tax and driver preferences, and operational settings like business hours with split shifts, delivery zones, and surge pricing. The payment/payout configuration models enable country-aware payment method and payout rail management with multi-actor support. The multi-channel support models enable enterprise-grade three-channel support (live chat, phone callbacks, email tickets) with real-time messaging, session management, callback scheduling, article management, and collision-free ticketCode generation with full message threading.

## External Dependencies

-   **Backend Core**: `@prisma/client`, `express`, `bcrypt`, `jsonwebtoken`, `@neondatabase/serverless`.
-   **Frontend Core**: `react`, `react-dom`, `wouter`, `@tanstack/react-query`, `react-hook-form`, `zod`.
-   **UI Components**: `@radix-ui/*`, `lucide-react`, `class-variance-authority`, `tailwind-merge`, `clsx`.
-   **Environment Variables**: `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`, `ENCRYPTION_KEY`.