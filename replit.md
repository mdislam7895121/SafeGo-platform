# SafeGo Global Super-App

## Overview
SafeGo is a production-ready, full-stack multi-service super-app platform designed for global on-demand services such as ride-hailing, food delivery, and parcel delivery. Its primary purpose is to offer a scalable, secure, and feature-rich solution capable of handling multi-role authentication, country-specific KYC, commission tracking, service lifecycle management, unified payment and payout systems, multi-role support, and comprehensive driver identity and profile management.

## User Preferences
Preferred communication style: Simple, everyday language.
Development approach: Full-stack TypeScript with modern tooling, emphasizing code quality, security, and scalability.

## System Architecture

### UI/UX Decisions
The frontend utilizes React 18, TypeScript, Vite 5, shadcn/ui (Radix UI), Tailwind CSS 3, TanStack Query v5, wouter, and React Hook Form with Zod. It features a custom HSL color palette, Inter/Manrope typography, mobile-first responsive design, skeleton loading, toast notifications, error boundaries, and role-based access control. Key UI/UX features include Uber-level profile experiences, multi-step onboarding, country-specific KYC, dedicated Food and Driver Profile Systems, and WCAG 2.1 AA compliance.

### Technical Implementations
The backend is built with Node.js 20+, TypeScript, Express.js 4, and Prisma Client 6 with PostgreSQL 14+, employing a Generic Service Layer with Role Adapters. Core functionalities include:
-   **Admin Capabilities**: Interactive admin panel for dashboards, document management, wallet settlement, and global analytics.
-   **Security & Compliance**: Implements HTTP security headers, rate limiting, 2FA systems, device/session security, multi-channel security alerts, tamper-proof audit logs (SHA-256 hash chain), secure audit routes, and AES-256-GCM field encryption.
-   **Wallet & Earnings System**: Manages earnings, commissions, negative balances, and automated/manual payouts.
-   **Tax & Fees System**: Supports multi-country tax management with city-level overrides.
-   **Multi-Role Multi-Channel Support Center**: AI-first chat with 4-role support and a two-tier escalation system.
-   **Opportunity Bonus Management System**: Admin-managed ride incentives with country-specific and zone-based targeting.
-   **SafeGo Points System**: Gamified loyalty program with three tiers.
-   **Identity Verification System**: Manages country-specific identity documents with AES-256-GCM encryption.
-   **Restaurant Management Systems**: Includes performance insights, review management, media gallery, branding, operational settings, order management, staff management, and promotions.
-   **Customer-Facing Dynamic Pricing Display**: Provides real-time pricing transparency with surge multipliers and breakdowns.
-   **Unified Payout System**: Enterprise-grade management for customer payment methods and payout rails by country, service type, actor type, and KYC level, including automatic weekly scheduling and bank verification.
-   **Driver Systems**: Comprehensive driver profile management (multi-vehicle, encrypted KYC, document upload), earnings & payout dashboard, promotions, in-app training, and a Safety Center. This includes an Uber-style active trip screen and trip accept/decline flow.
-   **Rider Ride-Booking Flow**: Complete Uber-style multi-step booking experience using `RideBookingContext` for state management, including map integration, vehicle tier selection, payment method selection, real-time trip tracking, and multi-route selection.
-   **Multi-Route Fare Engine**: Enterprise-grade fare calculation system with a deterministic 18-step pipeline and real-time per-route pricing, including base fare, adjustments, multipliers, surcharges, tolls, and comprehensive fare breakdown.
-   **Promo Code System**: User-entered promotional codes with comprehensive validation for discount types, targeting, usage limits, date range validity, and user conditions. Frontend UI features real-time fare adjustment and discount propagation.
-   **Phase A Ride System Features**: Covers comprehensive ride lifecycle management including customer controls (cancel, chat, change destination), post-trip 5-star rating, detailed receipt system, and driver status workflow with audit trails.
-   **Driver Incentive Engine**: Comprehensive incentive system with 5 bonus types (Quest, Boost Zone, Airport Pickup, Weather, Late-Night) that stack additively on driver payouts without affecting rider fares, all independently configurable.
-   **AI Marketplace Balancer**: Enterprise-grade real-time marketplace optimization system with a 60-second control loop orchestrator, predictive models for demand/supply forecasting, and modular actuators for surge, commission, incentive, and dispatch optimization. Includes safety guards for critical thresholds.
-   **SafeGo Loyalty Engine**: Comprehensive dual-track loyalty system for riders and drivers with real-time per-ride processing and daily batch updates, including tiered rewards, points, goals, and various bonuses.
-   **NYC TLC HVFHV Driver Minimum Pay Enforcement System**: Regulatory compliance system implementing NYC Taxi & Limousine Commission High-Volume For-Hire Vehicle (HVFHV) minimum pay rules, including per-ride minimum, hourly utilization guarantee, and weekly settlement.
-   **NYC TLC Time-Distance Base Fare Formula**: Rider fare calculation using TLC-mandated formula ($2.50 base + $0.56/minute + $1.31/mile) with $8.00 minimum and $500.00 maximum fare enforcement. Automatically detects NYC trips via state code (NY) or borough codes (Manhattan, Brooklyn, Queens, Bronx, Staten Island). Exposes both raw component breakdown (tlcBaseFare, tlcTimeFare, tlcDistanceFare, tlcRawTotal) and enforced values (tlcEnforcedTotal, baseSubtotalForPipeline) for transparent reconciliation.
-   **NYC TLC Congestion Pricing**: Implements $2.75 flat fee for trips with pickup OR dropoff in the Manhattan Congestion Zone (below 96th Street). Uses polygon-based geo-detection for precise zone boundary matching. Congestion fee is applied at Step 6A (post-surge) as a flat regulatory fee that does NOT participate in surge multiplier. Full amount is treated as a regulatory pass-through cost for commission calculation (remitted to government). Exposes congestionFee amount and congestionFeeApplied flag for transparent billing.
-   **NYC TLC Airport Access Fees**: Implements TLC-mandated airport access fees with polygon-based geo-detection: JFK ($2.50), LaGuardia ($1.25), Newark ($2.00), and Westchester HPN ($1.00). Fee applies if pickup OR dropoff is inside the airport polygon boundary. Integrated into fare pipeline at Step 6B (post-surge) as a flat regulatory fee that does NOT participate in surge multiplier. Full amount is treated as regulatory pass-through for commission calculation (remitted to government). Exposes tlcAirportFee, tlcAirportName, tlcAirportCode, and tlcAirportFeeApplied flag for transparent billing and fare breakdown display.
-   **API Design**: Robust API endpoints with enforcement of KYC, ownership validation, UUID format validation, Zod schema validation, atomic transactions, and consistent error handling.

### Database Schema Design
The schema uses UUID primary keys, indexed foreign keys, and decimal types for monetary values. It includes models for wallets, payouts, audit logs, notifications, platform settings, payment/payout accounts, opportunity settings, driver tiers and points, blocked riders, reviews, restaurant branding, media, hours, operational settings, delivery zones, surge settings, country payment/payout configurations, restaurant payout methods, categories, subcategories, menu item categories, promotion usage, multi-role support models, and driver safety incidents. It supports country-specific identity fields with AES-256-GCM encryption and includes flags for demo mode, US tax fields, driver preferences, and enhancements for promotions/coupons and review replies.

## External Dependencies

-   **Backend Core**: `@prisma/client`, `express`, `bcrypt`, `jsonwebtoken`, `@neondatabase/serverless`.
-   **Frontend Core**: `react`, `react-dom`, `wouter`, `@tanstack/react-query`, `react-hook-form`, `zod`.
-   **UI Components**: `@radix-ui/*`, `lucide-react`, `class-variance-authority`, `tailwind-merge`, `clsx`.
-   **Environment Variables**: `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`, `ENCRYPTION_KEY`, `SESSION_SECRET`.
-   **Optional Integrations**: Twilio (SMS OTP), AgentMail (Email OTP).
-   **Google Maps Integration**: Client-side only using `GOOGLE_MAPS_API_KEY` for Maps JavaScript API, Places API, Directions API, and Geocoding API.