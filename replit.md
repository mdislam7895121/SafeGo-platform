# SafeGo Global Super-App

## Overview
SafeGo is a production-ready, full-stack multi-service super-app platform designed for global on-demand services such as ride-hailing, food delivery, and parcel delivery. It provides a scalable, secure, and feature-rich solution capable of handling multi-role authentication, country-specific KYC, commission tracking, service lifecycle management, unified payment and payout systems, multi-role support, and comprehensive driver identity and profile management. The project aims to capture a significant market share in the on-demand services sector by offering a superior and highly adaptable platform.

## User Preferences
Preferred communication style: Simple, everyday language.
Development approach: Full-stack TypeScript with modern tooling, emphasizing code quality, security, and scalability.

## System Architecture

### UI/UX Decisions
The frontend uses React 18, TypeScript, Vite 5, shadcn/ui (Radix UI), Tailwind CSS 3, TanStack Query v5, wouter, and React Hook Form with Zod. It features a custom HSL color palette, Inter/Manrope typography, mobile-first responsive design, skeleton loading, toast notifications, error boundaries, and role-based access control. Key UI/UX features include Uber-level profile experiences, multi-step onboarding, country-specific KYC, dedicated Food and Driver Profile Systems, and WCAG 2.1 AA compliance.

### Technical Implementations
The backend is built with Node.js 20+, TypeScript, Express.js 4, and Prisma Client 6 with PostgreSQL 14+, employing a Generic Service Layer with Role Adapters. Core functionalities include:
-   **Admin Capabilities**: Interactive admin panel for dashboards, document management, wallet settlement, and global analytics.
-   **Security & Compliance**: Implements HTTP security headers, rate limiting, 2FA, device/session security, multi-channel security alerts, tamper-proof audit logs, secure audit routes, and AES-256-GCM field encryption.
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
-   **Promo Code System**: User-entered promotional codes with comprehensive validation for discount types, targeting, usage limits, date range validity, and user conditions.
-   **Phase A Ride System Features**: Covers comprehensive ride lifecycle management including customer controls (cancel, chat, change destination), post-trip 5-star rating, detailed receipt system, and driver status workflow with audit trails.
-   **Driver Incentive Engine**: Comprehensive incentive system with 5 bonus types (Quest, Boost Zone, Airport Pickup, Weather, Late-Night) that stack additively on driver payouts.
-   **AI Marketplace Balancer**: Enterprise-grade real-time marketplace optimization system with a 60-second control loop orchestrator, predictive models for demand/supply forecasting, and modular actuators for surge, commission, incentive, and dispatch optimization.
-   **SafeGo Loyalty Engine**: Comprehensive dual-track loyalty system for riders and drivers with real-time per-ride processing and daily batch updates, including tiered rewards, points, goals, and various bonuses.
-   **NYC TLC Regulatory Compliance**: Implements NYC Taxi & Limousine Commission regulations including HVFHV Driver Minimum Pay Enforcement, Time-Distance Base Fare Formula, Congestion Pricing, Airport Access Fees, Accessible Vehicle Fund (AVF) Fee, Black Car Fund (BCF) Fee, HVFHV Workers' Compensation (HVRF) Fee, State Surcharge, Long Trip Surcharge, Out-of-Town Surcharge, Cross-Borough Fee ($2.50 for trips crossing borough boundaries using polygon-based detection), and a comprehensive Tolls Detection and Billing System for NYC metro area bridges and tunnels.
-   **TLC Compliance Report Generator**: Enterprise-grade monthly reporting system for TLC submissions including Trip Record Report (TRR), Driver Pay Report (DPR), HVFHV Summary Report (HSR), Out-of-Town Trips Report, Accessibility Report (AVF metrics), and Airport Activity Report. Features JSON/CSV export, validation functions, and comprehensive filtering by date range, driver, borough, trip type, and airport. All reports accessible via `/api/tlc/reports/*` endpoints with admin-only access.
-   **TLC Audit & Reconciliation Engine**: Comprehensive audit system for HVFHV compliance verification including: (1) Fare Consistency Audits - validates final fare matches sum of components, commission excludes TLC pass-through fees, surge/discount applied correctly, cross-city fees included; (2) Driver Pay Consistency - verifies TLC minimum pay enforcement using $0.56/min + $1.31/mile formula, $27.86/hr hourly guarantee, adjustment calculations; (3) Location/Zone Accuracy - polygon-based borough detection using ray-casting algorithm, Manhattan congestion zone validation, airport zone detection (JFK, LGA, EWR, WCY) via haversine radius, out-of-town fee eligibility, cross-borough fee validation with suppression logic (cross-state > airport > cross-borough > generic cross-city); (4) Time/Distance Integrity - haversine distance computation, duration calculation, speed reasonableness checks (0-120 mph), variance thresholds (10% distance, 15% duration); (5) TLC Fee Validation - AVF ($0.125), BCF ($0.625), HVRF ($0.05), State Surcharge ($2.50), Congestion ($2.75), Airport Access ($5.00), Long Trip ($2.50 for >20mi), Out-of-Town Return ($17.50), Cross-Borough ($2.50 for cross-borough trips within NYC); (6) Automatic Fix Engine - applies corrections for minor mismatches within tolerance thresholds, recalculates final fare; (7) Batch Audit & Reconciliation - processes multiple trips with filtering by driver, severity, category, generates audit summary with scores. All audit endpoints at `/api/tlc/audit/*` with admin-only access, JSON/CSV export support.
-   **NYC Borough Detection Service**: Polygon-based borough boundary detection using ray-casting algorithm for accurate cross-borough trip identification. Supports all 5 NYC boroughs (Manhattan, Brooklyn, Queens, Bronx, Staten Island) with simplified polygon boundaries. Integrated into fare engine and audit engine for cross-city fee calculation and validation.
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