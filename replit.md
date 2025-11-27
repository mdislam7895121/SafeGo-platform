# SafeGo Global Super-App

## Overview
SafeGo is a production-ready, full-stack multi-service super-app platform for global on-demand services like ride-hailing, food, and parcel delivery. It aims to be a leading solution by offering scalable, secure, and feature-rich capabilities including multi-role authentication, country-specific KYC, commission tracking, service lifecycle management, unified payment/payouts, multi-role support, and comprehensive driver identity and profile management.

## User Preferences
Preferred communication style: Simple, everyday language.
Development approach: Full-stack TypeScript with modern tooling, emphasizing code quality, security, and scalability.

## System Architecture

### UI/UX Decisions
The frontend uses React 18, TypeScript, Vite 5, shadcn/ui (Radix UI), Tailwind CSS 3, TanStack Query v5, wouter, and React Hook Form with Zod. It features a custom HSL color palette, Inter/Manrope typography, mobile-first responsive design, skeleton loading, toast notifications, error boundaries, and role-based access control. Key UI/UX features include Uber-level profile experiences, multi-step onboarding, country-specific KYC, dedicated Food and Driver Profile Systems, and WCAG 2.1 AA compliance.

### Technical Implementations
The backend is built with Node.js 20+, TypeScript, Express.js 4, and Prisma Client 6 with PostgreSQL 14+, employing a Generic Service Layer with Role Adapters.

Core systems and features include:
-   **Admin Capabilities**: Interactive admin panel with dashboards, document management, wallet settlement, and global analytics.
-   **Security & Compliance (Phase 2 Hardening)**: 
    - **HTTP Security Headers**: HSTS, CSP, X-Frame-Options, X-Content-Type-Options via securityHeaders middleware
    - **Rate Limiting**: Admin login (5/min), analytics (30/min), payout (10/min), support (20/min) routes
    - **2FA System**: TOTP for admin, OTP (email/SMS) for driver/restaurant payout changes and password reset
    - **OTP Service** (otpService.ts): 6-digit codes, 10-min expiry, 3 max attempts, 3 req/15min rate limit per identifier
    - **Device Security** (deviceSecurityService.ts): User-Agent fingerprinting, IP geolocation detection, new device/location flagging
    - **Session Security** (sessionSecurityService.ts): Auto-revocation on suspicious login, device tracking, login history
    - **Security Alerts** (securityAlertService.ts): Multi-channel notifications for new device/location logins
    - **Tamper-Proof Audit Logs** (tamperProofAuditService.ts): Append-only SHA-256 hash chain, no edit/delete, verifiable integrity
    - **Secure Audit Routes** (secure-audit.ts): Admin-only internal endpoints for log viewing/querying/verification
    - **Payout 2FA Middleware**: OTP + password verification for driver/restaurant, TOTP for admin payout operations
    - **Audit Categories**: ADMIN_ACTION, PAYOUT_CHANGE, KYC_EVENT, SUPPORT_EVENT, AUTH_EVENT, SECURITY_EVENT, DATA_ACCESS
    - **Severity Levels**: INFO, WARNING, CRITICAL
    - AES-256-GCM field encryption, Admin Activity Audit Trail, Global Admin Notification Center, RBAC.
-   **Wallet & Earnings System**: Manages earnings, commissions, negative balances, and automated/manual payouts.
-   **Tax & Fees System**: Multi-country tax management with city-level overrides.
-   **Multi-Role Multi-Channel Support Center**: AI-first chat with 4-role support and a two-tier escalation system.
-   **Opportunity Bonus Management System**: Admin-managed ride incentives with country-specific amounts and zone-based targeting.
-   **SafeGo Points System**: Uber Pro-style gamified loyalty program with 3 tiers.
-   **Identity Verification System**: Country-specific identity document management with AES-256-GCM encryption.
-   **Restaurant Management Systems**: Includes Performance Insights, Review & Rating Management, Media Gallery, Branding, Operational Settings, Order Management, Staff & Role Management, and Promotions & Coupon Management.
-   **Customer-Facing Dynamic Pricing Display**: Real-time pricing transparency with surge multipliers, promotions, and breakdowns.
-   **Unified Payout System**: Enterprise-grade management for customer payment methods and payout rails by country, service type, actor type, and KYC level, including automatic weekly scheduling and bank verification.
    - **Supported Payout Types by Country**:
      - Bangladesh (BD): Bank Account, Mobile Wallet (bKash, Nagad, Rocket)
      - United States (US): Bank Account, Stripe Connect
    - **Bank Account Types**: CHECKING, SAVINGS, BUSINESS_CHECKING, BUSINESS_SAVINGS, OTHER (required for all bank account payout methods)
    - **Payout Method Status**: PENDING_VERIFICATION (for Stripe Connect), ACTIVE, DISABLED
    - Driver and Restaurant roles have consistent Add Payout Method UX with country-restricted options and dynamic form fields
-   **Driver Systems**: Comprehensive driver profile management (multi-vehicle, encrypted KYC, document upload), public profile card, earnings & payout dashboard, promotions & incentives system, document management, support & help center, in-app training & onboarding, getting started page, vehicle center, wallet center, trip history & earnings breakdown, performance & ratings center, incentives & milestones center, and Safety Center with incident reporting and emergency toolkit.
    - **C-3 Driver Active Trip Screen**: Uber-style active trip experience with:
      - SafeGo Map component (Leaflet-based) with driver/pickup/dropoff markers and route polyline
      - Trip status flow: accepted → arriving → arrived → started → completed
      - Status chip with ETA display and passenger card
      - Multi-map navigation options: SafeGo Map Only, Google Maps, Apple Maps, Waze
      - Driver navigation preference integration from Settings
      - API endpoints: GET /api/driver/trips/active, POST /api/driver/trips/:id/status
      - Audit logging for all status transitions
      - Auto route recalculation when driver goes 50m+ off-route
      - Dynamic map zoom on turns (30°+ angle detection)
      - Optional traffic layer toggle with OSM France HOT tiles
    - **C-4 Driver Trip Accept/Decline Flow**: Uber-style incoming request experience with:
      - Full-screen modal popup with fade-in animation and countdown ring (15 seconds)
      - Customer info display: name, rating, pickup/dropoff addresses
      - Trip metrics: distance to pickup, ETA, estimated fare
      - Surge/boost indicators when applicable
      - Accept (green) and Decline (gray) action buttons
      - Swipe-to-accept gesture with haptic and sound feedback
      - Auto-decline on countdown expiration
      - SafeGo Map preview with pickup/dropoff markers and route polyline
      - Driver online/offline status management with toggle switch
      - Real-time polling for pending requests (3s interval when online)
      - Trip locking mechanism (prevents duplicate acceptance)
      - Backend validation: verified driver, online status, no active trip
      - Decline reason logging with optional notes
      - Full audit trail: request_shown_at, action_taken, decision_time_ms
      - API endpoints: GET /api/driver/trips/requests/pending, POST /api/driver/trips/requests/:id/accept, POST /api/driver/trips/requests/:id/decline, GET/POST /api/driver/trips/driver-status
      - Comprehensive data-testid coverage for E2E testing
    - **Driver Sidebar Navigation**: Mobile-first organized menu with 5 sections:
      - Core (Dashboard, Active Trip, Trip History, Wallet, Incentives, Trust Score, Performance)
      - Account (Account hub, Documents, Vehicle)
      - Rewards (SafeGo Points, Opportunity, Refer a Friend)
      - Support (Getting Started, Training Videos, Safety Center, Support, Help Center)
      - Session (Logout in footer)
    - Auto-close drawer on navigation, active state highlighting, proper section headers
    - **Driver KYC Field Validation**:
      - Phone: E.164 format with country-specific patterns (US: +1XXX format, BD: +880XXX format) with normalization and storage in canonical format
      - Date of Birth: 18+ age requirement enforced on both frontend and backend
      - License Plate: Text-only input via dedicated endpoint without image upload requirement
-   **R-2 Rider Ride-Booking Flow**: Complete Uber-style multi-step booking experience with:
    - **RideBookingContext**: Centralized state management for multi-step booking flow with step validation guards
    - **RiderRoutes Component**: Hoisted provider wrapper ensuring context persistence across all rider routes
    - **6-Step Booking Flow**: /rider/ride/new → /rider/ride/pickup → /rider/ride/dropoff → /rider/ride/options → /rider/ride/confirm → /rider/trip/active
    - **Pickup Page**: SafeGoMap integration with GPS location, saved places, and address search
    - **Dropoff Page**: Map-based destination selection with search autocomplete and route preview
    - **Options Page**: Vehicle tier selection with fare estimation (Economy, Comfort, Premium)
    - **Confirm Page**: Payment method selector (Cash, Digital Wallet) with final trip creation
    - **Active Trip Page**: Real-time trip tracking with driver info, status polling, and map visualization
    - **Step Guards**: Automatic redirection if booking steps are skipped
    - **Backend Enhancements**: GET /api/rides/:id returns comprehensive driver details (name, rating, vehicle info, current location)
    - **Testing Coverage**: 62 data-testid attributes across all booking pages for E2E testing
    - **API Contract**: Only supported fields sent in ride creation (pickupAddress, pickupLat/Lng, dropoffAddress, dropoffLat/Lng, serviceFare, paymentMethod)
-   **API Design**: Robust API endpoints with enforcement of KYC, ownership validation, UUID format validation, Zod schema validation, atomic transactions, and consistent error handling.

### Database Schema Design
The schema utilizes UUID primary keys, indexed foreign keys, and decimal types for monetary values. It includes models for wallets, payouts, audit logs, notifications, platform settings, payment/payout accounts, opportunity settings, driver tiers and points, blocked riders, reviews, restaurant branding, media, hours, operational settings, delivery zones, surge settings, country payment/payout configurations, restaurant payout methods, categories, subcategories, menu item categories, promotion usage, multi-role support models, and driver safety incidents. It supports country-specific identity fields with AES-256-GCM encryption and includes flags for demo mode, US tax fields, driver preferences, and enhancements for promotions/coupons and review replies.

## External Dependencies

-   **Backend Core**: `@prisma/client`, `express`, `bcrypt`, `jsonwebtoken`, `@neondatabase/serverless`.
-   **Frontend Core**: `react`, `react-dom`, `wouter`, `@tanstack/react-query`, `react-hook-form`, `zod`.
-   **UI Components**: `@radix-ui/*`, `lucide-react`, `class-variance-authority`, `tailwind-merge`, `clsx`.
-   **Environment Variables**: `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`, `ENCRYPTION_KEY`, `SESSION_SECRET`.
-   **Optional Integrations**: Twilio (SMS OTP), AgentMail (Email OTP) - services degrade gracefully to console logging when not configured.