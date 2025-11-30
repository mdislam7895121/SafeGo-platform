# SafeGo Global Super-App

## Overview
SafeGo is a production-ready, full-stack multi-service super-app platform for global on-demand services like ride-hailing, food, and parcel delivery. It offers a scalable, secure, and feature-rich solution with multi-role authentication, country-specific KYC, commission tracking, service lifecycle management, unified payment/payout systems, and comprehensive driver identity management. The project aims to capture a significant market share in the on-demand services sector by providing a superior and adaptable platform.

## User Preferences
Preferred communication style: Simple, everyday language.
Development approach: Full-stack TypeScript with modern tooling, emphasizing code quality, security, and scalability.

## System Architecture

### UI/UX Decisions
The frontend uses React 18, TypeScript, Vite 5, shadcn/ui, Tailwind CSS 3, TanStack Query v5, wouter, and React Hook Form with Zod. It features a custom HSL color palette, Inter/Manrope typography, mobile-first responsive design, skeleton loading, toast notifications, error boundaries, and role-based access control. Key UI/UX features include Uber-level profile experiences, multi-step onboarding, country-specific KYC, dedicated Food and Driver Profile Systems, and WCAG 2.1 AA compliance.

### Technical Implementations
The backend is built with Node.js 20+, TypeScript, Express.js 4, and Prisma Client 6 with PostgreSQL 14+, utilizing a Generic Service Layer with Role Adapters. Core functionalities include:
- **Admin Capabilities**: Interactive panel for dashboards, document management, wallet settlement, and global analytics.
- **Security & Compliance**: Implements HTTP security headers, rate limiting, 2FA, device/session security, multi-channel alerts, tamper-proof audit logs, secure audit routes, and AES-256-GCM field encryption.
- **Customer Account Lockout System**: User-initiated account lock with "LOCK" confirmation + password verification. Unlock requires password + OTP verification (bcrypt-hashed OTP stored with 10-minute expiry). Rate limiting blocks login after 5 failed attempts for 15 minutes. Locked accounts are blocked from all booking endpoints (rides, food, parcels) via requireUnlockedAccount middleware. Global ACCOUNT_LOCKED error handler on frontend redirects to profile page.
- **Wallet & Earnings System**: Manages earnings, commissions, negative balances, and automated/manual payouts.
- **Tax & Fees System**: Supports multi-country tax management with city-level overrides.
- **Multi-Role Multi-Channel Support Center**: AI-first chat with 4-role support and a two-tier escalation system.
- **Opportunity Bonus Management System**: Admin-managed ride incentives with country-specific and zone-based targeting.
- **SafeGo Points System**: Gamified loyalty program with three tiers.
- **Identity Verification System**: Manages country-specific identity documents with AES-256-GCM encryption.
- **Restaurant Management Systems**: Includes performance insights, review management, media gallery, branding, operational settings, order management, staff management, and promotions.
- **Food Order Tracking System**: Real-time food order tracking with 8-stage status timeline (placed, accepted, preparing, ready_for_pickup, driver_assigned, driver_arriving, picked_up, on_the_way, delivered), live map with restaurant/driver/delivery markers, driver info card with vehicle details, ETA calculations, and 5-second polling via useLiveFoodTracking hook.
- **Food Checkout Payment Validation**: Complete checkout verification with payment validation including expired card detection (isCardExpired/isCardExpiringSoon helpers), wallet balance checking, insufficient balance warnings, and card expiry badges. Supports cash, wallet, and saved card payment methods with visual indicators.
- **Food Order Lifecycle Notifications**: Comprehensive in-app notifications for all order lifecycle events with status-specific messages: Order Placed (customer), Order Accepted, Preparing, Ready for Pickup, Driver Assigned, Picked Up, Almost There, Delivered, Cancelled. Each status has tailored user-friendly notification messages.
- **Customer-Facing Dynamic Pricing Display**: Provides real-time pricing transparency with surge multipliers and breakdowns.
- **Unified Payout System**: Enterprise-grade management for customer payment methods and payout rails by country, service type, actor type, and KYC level, including automatic weekly scheduling and bank verification.
- **Driver Systems**: Comprehensive driver profile management (multi-vehicle, encrypted KYC, document upload), earnings & payout dashboard, promotions, in-app training, and a Safety Center. Includes Uber-style active trip screen and trip accept/decline flow.
- **Rider Ride-Booking Flow**: Complete Uber-style multi-step booking experience using `RideBookingContext` for state management, including map integration, vehicle tier selection, payment method selection, real-time trip tracking, and multi-route selection.
- **Multi-Route Fare Engine**: Enterprise-grade fare calculation system with a deterministic 19-step pipeline and real-time per-route pricing, including base fare, adjustments, multipliers, surcharges, tolls, and comprehensive fare breakdown.
- **Multi-Category Vehicle System**: Supports 7 Uber-style vehicle categories (SAFEGO_X, SAFEGO_COMFORT, SAFEGO_COMFORT_XL, SAFEGO_XL, SAFEGO_BLACK, SAFEGO_BLACK_SUV, SAFEGO_WAV) with configurable fare multipliers and minimum fares. Includes:
    - **Rider Vehicle Category UI**: Enhanced selection UI with real-time availability, automatic fallback, and reusable components.
    - **AI Category Suggestion**: Function to suggest vehicle categories based on properties.
    - **Admin-Only Category Assignment**: Admin verification required for final category assignment.
    - **Vehicle Verification Status**: Tracks workflow states with audit logging.
    - **Driver-Vehicle Binding**: `isCategoryCompatible()` enforces dispatch eligibility matrix.
    - **Driver Category Preferences**: Allows drivers to disable eligible categories via in-app UI.
    - **Legacy Mapping**: Functions for backward compatibility with older category IDs.
    - **Rider Price Card Discount UI**: Professional cards with bold final fare, strikethrough original fare, "You Save" badge, promo banners, and 3D vehicle images.
- **Cross-State Fare Engine**: Dedicated Uber-style pricing for interstate trips, overriding normal fare calculation when pickup and drop-off states differ.
- **Promo Code System**: User-entered promotional codes with comprehensive validation.
- **Phase A Ride System Features**: Covers ride lifecycle management including customer controls (cancel, chat, change destination), post-trip rating, detailed receipts, and driver status workflow with audit trails.
- **Driver Incentive Engine**: Comprehensive incentive system with 5 bonus types that stack additively on driver payouts.
- **AI Marketplace Balancer**: Enterprise-grade real-time marketplace optimization system with a 60-second control loop orchestrator, predictive models, and modular actuators.
- **SafeGo Loyalty Engine**: Comprehensive dual-track loyalty system for riders and drivers with real-time processing and daily batch updates.
- **NYC TLC Regulatory Compliance**: Implements NYC Taxi & Limousine Commission regulations including minimum pay enforcement, time-distance base fare, congestion pricing, airport fees, various fund fees, state surcharge, long trip surcharge, out-of-town surcharge, cross-borough fee, and comprehensive tolls detection and billing.
- **TLC Compliance Report Generator**: Enterprise-grade monthly reporting system for TLC submissions (TRR, DPR, HSR, etc.) with JSON/CSV export, validation, and filtering.
- **TLC Audit & Reconciliation Engine**: Comprehensive audit system for HVFHV compliance verification (Fare Consistency, Driver Pay Consistency, Location/Zone Accuracy, Time/Distance Integrity, TLC Fee Validation), with an automatic fix engine and batch audit capabilities.
- **NYC Borough Detection Service**: Polygon-based borough boundary detection using ray-casting algorithm for accurate cross-borough trip identification.
- **API Design**: Robust API endpoints with enforcement of KYC, ownership validation, UUID format validation, Zod schema validation, atomic transactions, and consistent error handling.

### Database Schema Design
The schema uses UUID primary keys, indexed foreign keys, and decimal types for monetary values. It includes models for wallets, payouts, audit logs, notifications, platform settings, payment/payout accounts, opportunity settings, driver tiers and points, blocked riders, reviews, restaurant branding, media, hours, operational settings, delivery zones, surge settings, country payment/payout configurations, restaurant payout methods, categories, subcategories, menu item categories, promotion usage, multi-role support models, and driver safety incidents. It supports country-specific identity fields with AES-256-GCM encryption and includes flags for demo mode, US tax fields, driver preferences, and enhancements for promotions/coupons and review replies.

## External Dependencies

- **Backend Core**: `@prisma/client`, `express`, `bcrypt`, `jsonwebtoken`, `@neondatabase/serverless`.
- **Frontend Core**: `react`, `react-dom`, `wouter`, `@tanstack/react-query`, `react-hook-form`, `zod`.
- **UI Components**: `@radix-ui/*`, `lucide-react`, `class-variance-authority`, `tailwind-merge`, `clsx`.
- **Environment Variables**: `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`, `ENCRYPTION_KEY`, `SESSION_SECRET`.
- **Optional Integrations**: Twilio (SMS OTP), AgentMail (Email OTP).
- **Google Maps Integration**: Client-side only using `GOOGLE_MAPS_API_KEY` for Maps JavaScript API, Places API, Directions API, and Geocoding API.

## Security Rules - Data Visibility

### PERMANENT VISIBILITY RULES (DO NOT MODIFY)

These rules define what data each user role can see. Violations are security incidents.

#### Customer (Rider) - NEVER Sees:
- `driverPayout` / `driverEarnings` / `netEarnings`
- `safegoCommission` / `safeGoCommission` / `platformCommission`
- `commissionRate` / `commissionAmount` / `commissionPercentage`
- `driverEarningsNet` / `driverEarningsBase`
- Any field revealing how fare is split between platform and driver

#### Customer (Rider) - CAN See:
- `totalFare` / `finalFare` / `estimatedFare`
- `baseFare`, `distanceFare`, `timeFare` (fare components)
- `discountAmount` / `promoDiscount` / `promoCode`
- `paymentMethod` / `paymentType`
- `estimatedTime` / `estimatedDistance` / `etaMinutes`
- `taxesAndSurcharges` / `regulatoryFeesTotal` (aggregate)
- `tollsTotal` / `surgeAmount` / `surgeMultiplier`

#### Driver - CAN See (in addition to customer fields):
- All DRIVER-ONLY fields listed above
- `bonusAmount` / `incentiveAmount`
- `tollsBreakdown` / `regulatoryFeesBreakdown`
- `tipAmount` / `tollsAmount` / `adjustments`

### Implementation Enforcement

1. **API Level** (server/routes/):
   - Customer endpoints must strip driver-only fields before response
   - Use `shared/visibilityRules.ts::stripDriverOnlyFields()` helper
   - Validate responses don't contain driver-only fields

2. **Component Level** (client/src/components/):
   - `FareBreakdown` and `FareDetailsAccordion` have `showDriverEarnings` prop
   - Defaults to `false` - only set `true` in driver-facing pages
   - Type interfaces have DRIVER-ONLY comments on sensitive fields

3. **Type Level** (shared/):
   - `shared/visibilityRules.ts` defines `DRIVER_ONLY_FIELDS` array
   - `CustomerSafeView<T>` type strips driver fields
   - `validateCustomerSafe()` logs violations in dev

### Files to Check When Modifying Fare/Earnings:
- `shared/visibilityRules.ts` - Central visibility definitions
- `client/src/lib/fareTypes.ts` - Client fare type definitions
- `client/src/components/ride/FareBreakdown.tsx` - Main fare display
- `client/src/components/ride/FareDetailsAccordion.tsx` - Compact fare display
- `server/routes/customer.ts` - Customer API endpoints
- `server/routes/rides.ts` - Ride endpoints (role-aware)
- `server/routes/driver-trips.ts` - Driver-only earnings endpoints