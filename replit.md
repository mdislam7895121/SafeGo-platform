# SafeGo Global Super-App

## Overview
SafeGo is a production-ready, full-stack multi-service super-app platform designed for global market leadership in on-demand services such as ride-hailing, food delivery, and parcel delivery. It offers a comprehensive, scalable, and secure solution for integrated urban services, featuring multi-role authentication, country-specific KYC, commission tracking with negative balance support, full service lifecycle management, and unified payment/payout layouts.

## User Preferences
**Preferred communication style**: Simple, everyday language.
**Development approach**: Full-stack TypeScript with modern tooling, emphasizing code quality, security, and scalability.

## System Architecture

### UI/UX Decisions
The frontend utilizes React 18, TypeScript, Vite 5, shadcn/ui (Radix UI), Tailwind CSS 3, TanStack Query v5, wouter, and React Hook Form with Zod. It employs a custom HSL color palette, Inter/Manrope typography, mobile-first responsive design, skeleton loading, toast notifications, error boundaries, and role-based access controlled routes. Customer and Driver web apps feature Uber-level profile experiences, multi-step onboarding, country-specific KYC, and a dedicated Food System. The Driver Profile System includes a three-page experience (Main, Public, Compliments Detail) with dynamic content and privacy-compliant data display.

### Technical Implementations
The backend is built with Node.js 20+, TypeScript, Express.js 4, and Prisma Client 6 with PostgreSQL 14+. It supports multi-role authentication, country-specific KYC, and comprehensive service lifecycle management. Key features include:

-   **Admin Capabilities**: Interactive admin panel with dashboard, Document Center, Wallet Settlement, Global Earnings & Payout Analytics, and advanced analytics.
-   **Security & Compliance**: Admin Activity Audit Trail, Global Admin Notification Center, RBAC, secure UX, real-time threat monitoring, and fraud detection.
-   **Wallet & Earnings System**: Manages earnings, commissions, negative balances, and automated/manual payouts.
-   **Tax & Fees System**: Uber-style multi-country tax management with city-level overrides and 7 tax types, storing detailed breakdowns.
-   **System Monitoring**: Real-time performance monitoring, stability alerts, and an enterprise performance dashboard.
-   **Bot-First Support System**: AI-first support chat with 4-role support (driver, customer, restaurant, parcel), pre-chat verification, two-tier escalation (bot FAQ → human agent escalation), automatic escalation after 3 unresolved attempts, manual escalation, end-chat rating system, and production-ready race condition prevention. Includes **Admin Live Support Console** for SUPPORT_ADMIN agents with real-time conversation management, assignment system, unread tracking, user info panel, filters (status, role), and full RBAC access control.
-   **Demo Mode**: Comprehensive demo data generation for multi-jurisdiction scenarios.
-   **Opportunity Bonus Management System**: Admin-managed ride incentives with country-specific amounts, campaigns, and zone-based targeting for drivers.
-   **SafeGo Points System**: Uber Pro-style gamified loyalty program with 3 exclusive tiers (Blue, Gold, Premium) and 90-day cycles based on time-based trip points (Night/Morning, Peak Evening, Evening shifts). Includes a Driver UI, a `TimeSlotPointEngine` for tamper-proof calculation, and `CycleTrackingService`.
-   **Driver Wallet System**: Uber-style wallet experience displaying balance, payouts, transaction timeline, and supporting country-specific currencies, negative balance warnings, and minimum cash-out validation.
-   **Identity Verification System**: Country-specific identity document management (e.g., NID for Bangladesh, SSN for USA) with AES-256-GCM encryption for sensitive data and masked display.
-   **US 1099 Tax System**: Manages 1099-K and 1099-NEC tax reporting for US drivers, including W-9 certification, automatic earnings categorization, year-to-date totals, and downloadable tax documents.
-   **Bangladesh Tax Reporting System**: Provides annual income summaries for BD drivers, displaying aggregated earnings, SafeGo commission, and net payout, with downloadable summaries.
-   **Driver Account Settings & Preferences System**: Comprehensive account management with APIs for personal info updates and preference management (navigation, work hub, privacy, notifications, language, theme).
-   **Blocked Riders System**: Allows drivers to block specific customers from future matches, with API endpoints for managing the blocked list and reasons.
-   **Restaurant Order Analytics & Performance Dashboard**: Comprehensive analytics system with four dedicated pages (Overview, Items, Customers, Drivers) featuring day/hour heatmaps, order trends, item performance ranking, customer retention metrics, and driver performance tracking. Includes backend aggregation functions with RBAC restaurant_id scoping, KYC gating, accurate cancellation rate calculations (totalAttempts tracking), performance-based ranking for worst items (revenue per attempt), and admin platform-wide analytics view. Features automated weekly performance insights with anomaly detection (cancellation spikes, order drops, prep time issues) and notification generation for restaurant owners.
-   **Restaurant Review & Rating Management System (Phase 8)**: Comprehensive review system allowing customers to submit one review per delivered order with 1-5 star rating, text, and up to 5 images. Features complete customer identity masking for restaurant/admin views (using hashed identifiers), strict immutability after submission (no update/delete routes), unique orderId constraint preventing race conditions, KYC-gated restaurant dashboard with filters and rating statistics, RBAC-compliant access (STAFF with canViewAnalytics can view reviews), and admin moderation capabilities (hide/restore/flag) with full audit logging. Enforces security through database-level unique constraint on orderId and runtime eligibility validation (delivered orders only, one per order, customer ownership verification).
-   **Restaurant Media Gallery & Branding Management System (Phase 9)**: Visual identity and media gallery system for SafeGo Eats restaurants. Includes restaurant branding settings (logo, cover photo, primary/secondary colors, theme mode) with OWNER-only edit access and STAFF read-only via canViewAnalytics permission. Features media gallery with 50-photo limit, category tagging (food, ambience, team, kitchen, other), upload/delete/reorder functionality, and KYC gating. Admin moderation system provides hide/unhide/flag actions with mandatory reasoning, notifications to restaurants, and full audit logging. All endpoints enforce RBAC constraints and validate signed URLs for secure media access.
-   **Restaurant Operational Settings System (Phase 10)**: Comprehensive operational control system for SafeGo Eats restaurants. Features four restaurant settings pages (Business Hours with split-shift support, Delivery & Pickup Settings with throttling, Delivery Zones with fees and ETA, Surge Pricing with peak hours). Admin Oversight Panel provides read-only settings view, temporary open/close override controls, and full audit logging with RBAC enforcement. Customer-facing integration displays real-time restaurant status (Open/Closed/Busy), today's hours with split shifts, preparation time estimates, surge pricing indicators, delivery zone coverage, and throttling notices. All endpoints enforce authentication, KYC verification, and country/city matching with sanitized customer responses (no internal field exposure).

### Database Schema Design
The schema uses UUID primary keys, indexed foreign keys, decimal types for monetary values. It includes models for `Wallet`, `WalletTransaction`, `Payout`, `PayoutBatch`, `AuditLog`, `AdminNotification`, `PlatformSettings`, `PayoutAccount`, `PaymentMethod`, `OpportunitySetting`, `OpportunityReward`, `DriverTier`, `DriverPoints`, `TierBenefit`, `PointsRule`, `PointsTransaction`, `BlockedRider`, `Review` (Phase 8), `RestaurantBranding`, `RestaurantMedia` (Phase 9), `RestaurantHours`, `OperationalSettings`, `DeliveryZone`, `SurgeSettings` (Phase 10). It supports country-specific identity fields (e.g., `nidEncrypted`, `ssnEncrypted`) with AES-256-GCM encryption, an `isDemo` flag, fields for US tax and driver preferences, and operational settings including business hours with split shifts (DayOfWeek enum), delivery zones, and surge pricing.

## External Dependencies

-   **Backend Core**: `@prisma/client`, `express`, `bcrypt`, `jsonwebtoken`, `@neondatabase/serverless`.
-   **Frontend Core**: `react`, `react-dom`, `wouter`, `@tanstack/react-query`, `react-hook-form`, `zod`.
-   **UI Components**: `@radix-ui/*`, `lucide-react`, `class-variance-authority`, `tailwind-merge`, `clsx`.
-   **Environment Variables**: `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`, `ENCRYPTION_KEY`.