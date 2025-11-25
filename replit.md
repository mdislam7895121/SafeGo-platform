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
-   **Promotions Date Strip (D7)**: Uber/Lyft-style horizontal scrollable date carousel on the driver Promotions page (`/driver/promotions`). Features include:
    - 14-day date range display with swipeable/scrollable pills (3 days past, 11 days future)
    - Each pill shows weekday initial (M, T, W, etc.) and day number
    - Today's date highlighted with a ring indicator (side-by-side with promotion indicator if both apply)
    - Selected date visually distinguished with white background and scale effect
    - **Calendar Indicators**: Green dots on date pills indicating days with active promotions/bonuses
    - **Server-side date filtering**: `GET /api/driver/promotions/active?date=YYYY-MM-DD` returns promotions active for specified date
    - **Professional date header**: Shows formatted date (e.g., "Monday, Nov 25") with promotion count badge
    - Auto-scroll to center the selected date on load
    - Date-aware empty states (e.g., "No promotions for Monday, Nov 25")
    - Component: `client/src/components/driver/PromotionsDateStrip.tsx`
    - Integration: `client/src/pages/driver/promotions.tsx`
    - **API**: `GET /api/driver/promotions/calendar` - Returns aggregated calendar data with promotion counts per date
    - **Query Architecture**: Uses dynamic query keys `["/api/driver/promotions/active", selectedDate]` for proper cache management
    - **Bug Fix (Nov 2025)**: Fixed off-by-one date selection bug caused by JavaScript's `new Date()` UTC parsing. Now uses `parseISO()` from date-fns with `startOfDay()` normalization to ensure correct local timezone handling. All date comparisons use normalized start-of-day values for consistency.
-   **Driver Document Management System**: Comprehensive document upload, verification, and management infrastructure with granular status tracking for individual documents and country-specific requirements.
-   **Driver Support & Help Center System (D8)**: Uber-style driver support system with:
    - **Help Center Navigation**: "Help Center" link in driver sidebar (`/driver/support-help-center`) - appears on both desktop and mobile drawer
    - **Category Selection Page**: 6 support categories (Account & Documents, Trip Issues, Payment & Earnings, Incentives & Promotions, Safety & Emergency, App & Technical) with dynamic subcategories
    - **Ticket Creation**: Subject, description, optional trip association, category/subcategory selection, file attachments
    - **Ticket List Page** (`/driver/support-tickets`): Active/Resolved tabs, status badges, message counts, search and filters
    - **Ticket Detail Page** (`/driver/support-ticket/:id`): Complete timeline with status changes and messages, reply functionality
    - **Admin Panel** (`/admin/driver-support`): Ticket management dashboard with status counts, filters by status/category/priority, status updates with notes, internal admin notes (not visible to drivers), reply capability
    - **Status Workflow**: open → in_progress → resolved → closed with full audit trail
    - **API Routes**: Driver routes at `/api/driver/support-center/`, Admin routes at `/api/admin/support-center/driver-tickets`
-   **Driver In-App Training & Onboarding System (D9)**: Uber-style driver onboarding and training system with:
    - **Onboarding Wizard** (`/driver/onboarding`): 6-step guided onboarding (Welcome, Earnings, Payouts, Safety, Help Center, Completion)
    - **Progress Tracking**: Step completion with timestamps, completion percentage, and resumable sessions
    - **Training Hub** (`/driver/tutorials`): Comprehensive training platform with 13 modules across 6 categories:
      - **Module Data Model**: id, title, shortDescription, category, estimatedDurationMinutes, difficulty (Beginner/Intermediate/Advanced), status (available/coming_soon/locked), isRequiredForActivation, videoUrl, lastUpdated, keyTakeaways[]
      - **Categories**: Getting Started, Rides, Earnings, Safety, Support, Advanced with category filter tabs
      - **Module Cards**: Responsive grid with category pills, duration, difficulty badges, Required/Coming Soon/Completed status badges
      - **Detail Modal**: Video placeholder or "Coming Soon" state, key takeaways bullet points, "Mark as Completed" button
      - **Progress Tracking**: localStorage-based completion persistence (`safego-driver-training-completed`), overall and onboarding-required completion percentages
      - **Onboarding Integration**: Visual badges for required modules, onboarding progress widget
    - **Skip/Reset**: Options to skip entire onboarding or reset progress for re-training
    - **API Routes**: `GET /api/driver/onboarding/status`, `POST /api/driver/onboarding/complete-step`, `POST /api/driver/onboarding/skip`, `POST /api/driver/onboarding/reset`, `GET /api/driver/tutorials`, `POST /api/driver/tutorials/:id/view`
    - **Database Model**: `DriverOnboarding` with step completion flags, timestamps, tutorialsViewed array, and completion status
    - **Sidebar Integration**: "Getting Started" with "New" badge and "Training Videos" in driver sidebar navigation (uses `asChild` prop for proper Link navigation)
-   **Country-Specific Payment & Payout Configuration (D8)**: Comprehensive country-aware payout system with:
    - **Models Extended**: `Wallet` (holdAmount), `Payout` (feeAmount, netAmount, payoutMethodId), `CountryPayoutConfig` (serviceType, currency, maxPayoutAmount, platformFeeType, platformFeeValue, payoutDayOfWeek, payoutDayOfMonth)
    - **Driver Wallet APIs**: `GET /api/driver/wallet/summary` (balance, currency, hold, payout rules), `GET /api/driver/wallet/transactions` (paginated history)
    - **Driver Payout Methods**: `GET/POST /api/driver/payout-methods`, `PATCH /:id/set-primary`, `DELETE /:id`
    - **Driver Payout Requests**: `POST /api/driver/payouts` with KYC enforcement, country config validation, fee calculation
    - **Admin Config APIs**: `GET/POST/PATCH /api/admin/payout-configs` for country-specific payout rules
    - **Admin Monitoring**: `GET /api/admin/payouts` (filtered list), `POST /:id/mark-processed` (success/fail with reversal)
    - **Business Rules**: KYC APPROVED required for payouts, country-specific minPayoutAmount, fee types (NONE/FLAT/PERCENT), schedule enforcement (DAILY/WEEKLY/MONTHLY/ON_DEMAND)
    - **Currency Support**: USD (US), BDT (BD) with proper symbols
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