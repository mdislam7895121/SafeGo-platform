# SafeGo Global Super-App

## Overview
SafeGo is a production-ready, full-stack multi-service super-app platform designed for global on-demand services such as ride-hailing, food delivery, and parcel delivery. Its core purpose is to provide a scalable, secure, and feature-rich solution with capabilities including multi-role authentication, country-specific KYC, commission tracking, service lifecycle management, unified payment/payouts, multi-role support, and comprehensive driver identity and profile management. The project aims to achieve a leading position in the global on-demand services market.

## User Preferences
Preferred communication style: Simple, everyday language.
Development approach: Full-stack TypeScript with modern tooling, emphasizing code quality, security, and scalability.

## System Architecture

### UI/UX Decisions
The frontend utilizes React 18, TypeScript, Vite 5, shadcn/ui (Radix UI), Tailwind CSS 3, TanStack Query v5, wouter, and React Hook Form with Zod. It features a custom HSL color palette, Inter/Manrope typography, mobile-first responsive design, skeleton loading, toast notifications, error boundaries, and role-based access control. Key features include Uber-level profile experiences, multi-step onboarding, country-specific KYC, dedicated Food and Driver Profile Systems, professional UI/UX, responsive layouts, and WCAG 2.1 AA compliance.

### Technical Implementations
The backend is built with Node.js 20+, TypeScript, Express.js 4, and Prisma Client 6 with PostgreSQL 14+, employing a Generic Service Layer with Role Adapters.

Core systems and features include:
-   **Admin Capabilities**: Interactive admin panel with dashboards, document management, wallet settlement, and global analytics.
-   **Security & Compliance**: Admin Activity Audit Trail, Global Admin Notification Center, RBAC, secure UX, real-time threat monitoring, and fraud detection.
-   **Wallet & Earnings System**: Manages earnings, commissions, negative balances, and automated/manual payouts.
-   **Tax & Fees System**: Multi-country tax management with city-level overrides and various tax types.
-   **Multi-Role Multi-Channel Support Center**: AI-first chat with 4-role support, two-tier escalation, and an Admin Live Support Console.
-   **Opportunity Bonus Management System**: Admin-managed ride incentives with country-specific amounts, campaigns, and zone-based targeting for drivers.
-   **SafeGo Points System**: Uber Pro-style gamified loyalty program with 3 tiers and 90-day cycles.
-   **Identity Verification System**: Country-specific identity document management with AES-256-GCM encryption.
-   **Driver Account Settings & Preferences System**: Comprehensive account management with APIs for personal info and preference updates.
-   **Blocked Riders System**: Allows drivers to block specific customers.
-   **Restaurant Management Systems**: Includes Performance Insights, Review & Rating Management, Media Gallery & Branding, and Operational Settings.
-   **Restaurant Order Management System**: Production-ready order lifecycle management with real-time synchronization.
-   **Restaurant Staff & Role Management System**: Enables granular permission assignment and activity tracking.
-   **Restaurant Promotions & Coupon Management System**: Allows creation, management, and tracking of promotional campaigns.
-   **Customer-Facing Dynamic Pricing Display**: Real-time pricing transparency system showing surge multipliers, promotions, coupon eligibility, and pricing breakdowns.
-   **Payment & Payout Configuration System**: Enterprise-grade management for customer payment methods and payout rails by country, service type, actor type, and KYC level.
-   **Unified Payout System**: Production-ready payout infrastructure for individual withdrawals across all user roles with unified API routes, automatic weekly scheduling, and bank verification.
-   **Driver Profile System**: Supports multi-vehicle management, encrypted sensitive KYC fields, and a comprehensive document upload system with a large vehicle catalog.
-   **Driver Public Profile Card**: Customer-facing driver preview with profile photo, vehicle details, driver stats, and safety message.
-   **Driver Earnings & Payout Dashboard**: Comprehensive earnings visibility and payout management, including summary, breakdown, transaction history, and payout requests.
-   **Driver Promotions & Incentives System**: Comprehensive bonus management system allowing admins to create trip-based promotions with automated progress tracking and payouts.
-   **Promotions Date Strip (D7)**: Uber/Lyft-style horizontal scrollable date carousel for driver promotions, displaying a 14-day range with indicators for active promotions and server-side date filtering.
-   **Driver Document Management System**: Comprehensive document upload, verification, and management infrastructure with granular status tracking and country-specific requirements.
-   **Driver Support & Help Center System (D8)**: Uber-style driver support system with category selection, ticket creation, ticket list, and detail pages, integrated with an admin panel for ticket management and a robust status workflow.
-   **Driver In-App Training & Onboarding System (D9)**: Uber-style driver onboarding and training system with a 6-step guided onboarding wizard, progress tracking, and a comprehensive training hub with modules, progress persistence, and API integration.
-   **Driver Getting Started Page (D10)**: Uber-style onboarding checklist page with a progress summary, 12 dynamic checklist items adapting to country/city, and action links to relevant sections.
-   **Driver Document Center (D11)**: Uber-style document management page at `/driver/documents` with page header, progress summary card, document cards (License Front/Back, Registration, Insurance, Profile Photo), NYC-only TLC logic (Manhattan, Brooklyn, Queens, Bronx, Staten Island detection), SSN verification card (US only, masked display), upload modal with preview, status badges (Not Submitted/Pending/Approved/Rejected/Verified), and sidebar navigation link.
-   **Driver Vehicle Center (D12)**: Uber-style vehicle management page at `/driver/vehicle` with:
    - **Page Header**: "Vehicle Information" title with subtitle
    - **Progress Summary**: Completion status card with progress bar
    - **Editable Vehicle Cards**: Make (dropdown), Model, Year (dropdown), Color (dropdown), License Plate, VIN (masked display)
    - **Expiry Date Cards**: Registration Expiry, Insurance Expiry with color-coded warnings (green=valid, yellow=<30 days, red=expired)
    - **Vehicle Photo Upload**: Front, Back, Side view cards with preview, replace option, status badges
    - **Edit/Save Flow**: Each card has edit button, save/cancel in edit mode
    - **D10 Integration**: Updates `safego-driver-checklist-completed` localStorage when all fields complete
    - **VIN Security**: Masked display showing only last 4 digits with show/hide toggle
    - **Sidebar Navigation**: "Vehicle" link with Car icon
-   **Country-Specific Payment & Payout Configuration (D8)**: Comprehensive country-aware payout system with extended models for wallets and payouts, driver wallet APIs, payout methods, payout requests with KYC enforcement, admin configuration APIs, and monitoring, supporting various currencies and business rules.
-   **Driver Earnings & Wallet Center (D16)**: Production-ready driver wallet experience using the unified payout system:
    - **Wallet Snapshot** (`/driver/wallet`): Balance card with KYC warnings, payout activity preview, cash out dialog, and quick links to methods/history/help.
    - **Payout Methods** (`/driver/wallet/methods`): Full CRUD for payout methods using `/api/payout/methods` with add/delete dialogs, KYC error handling, bank account and mobile wallet support.
    - **Payout History** (`/driver/wallet/history`): Paginated history using `/api/payout/history` with status filtering, stats cards from `/api/payout/stats`, and empty state handling.
    - **KYC/Verification Behavior**: KYC banners shown when driver is not fully verified, graceful 403 handling, and disabled payout actions until verification complete.
    - **Mobile-First Design**: Responsive layouts working at 320px width, stacked cards, and consistent SafeGo design language.
-   **Driver Trip History & Earnings Breakdown (D17)**: Uber-style trip history center with comprehensive earnings visibility:
    - **Trip History List** (`/driver/trips`): Paginated list of all trips (rides, food, parcel) with service type icons, route summary, status badges, driver earnings, and customer ratings.
    - **Filters & Search**: Quick date filters (Today/7 days/30 days/Custom), service type filter (Ride/Food/Parcel), status filter (Completed/Cancelled/In Progress/Pending).
    - **Summary Cards**: Total trips, completed trips, cancelled trips, and total earnings (KYC-gated).
    - **Trip Detail View** (`/driver/trips/:id`): Full trip breakdown with fare components (base fare, delivery fee, surge/boost, tips), SafeGo commission, driver earnings, payment method, and route information.
    - **Unified Trip Adapter**: Backend service that aggregates Ride, FoodOrder, and Delivery models into a unified DriverTrip view with consistent status mapping.
    - **KYC/Verification Behavior**: Earnings breakdown hidden for unverified drivers with clear verification CTAs.
    - **Audit Logging**: Driver trip history and detail views are logged for compliance.
    - **Support Integration**: Direct links to support center with trip code prefilled for issue reporting.
-   **Driver Performance & Ratings Center (D18)**: Uber-style performance dashboard with comprehensive metrics:
    - **Performance Summary** (`/driver/performance`): Overall rating, total trips, completion rate, cancellation rate with time range filters (7d/30d/All).
    - **Rating Breakdown**: Star distribution (5★ to 1★) with visual progress bars and average calculation.
    - **Service Breakdown**: Performance metrics split by service type (Ride/Food/Parcel) with trip counts, ratings, and earnings.
    - **Customer Reviews**: Paginated list of customer feedback with ratings, comments, and trip codes.
    - **Quality Guidelines**: Informational thresholds for priority access, minimum rating, cancellation limits, and quality bonuses.
    - **Backend Routes**: `/api/driver/performance/summary`, `/api/driver/performance/ratings`, `/api/driver/performance/reviews`, `/api/driver/performance/service-breakdown`.
    - **KYC/Verification Behavior**: Earnings data hidden for unverified drivers with verification CTAs.
    - **Audit Logging**: Performance views are logged for compliance.
    - **Mobile-First Design**: Responsive layouts with tabbed interface for different metric categories.
-   **API Design**: Robust API endpoints with enforcement of KYC, ownership validation, UUID format validation, Zod schema validation, atomic transactions, and consistent error handling.

### Database Schema Design
The schema uses UUID primary keys, indexed foreign keys, and decimal types for monetary values. It includes models for wallets, payouts, audit logs, notifications, platform settings, payment/payout accounts, opportunity settings, driver tiers and points, blocked riders, reviews, restaurant branding, media, hours, operational settings, delivery zones, surge settings, country payment/payout configurations, restaurant payout methods, categories, subcategories, menu item categories, promotion usage, and multi-role support models. It supports country-specific identity fields with AES-256-GCM encryption and includes flags for demo mode, US tax fields, driver preferences, and enhancements for promotions/coupons and review replies.

## External Dependencies

-   **Backend Core**: `@prisma/client`, `express`, `bcrypt`, `jsonwebtoken`, `@neondatabase/serverless`.
-   **Frontend Core**: `react`, `react-dom`, `wouter`, `@tanstack/react-query`, `react-hook-form`, `zod`.
-   **UI Components**: `@radix-ui/*`, `lucide-react`, `class-variance-authority`, `tailwind-merge`, `clsx`.
-   **Environment Variables**: `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`, `ENCRYPTION_KEY`.