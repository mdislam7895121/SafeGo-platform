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
-   **Security & Compliance**: Implements HTTP security headers, rate limiting, 2FA systems (TOTP, OTP), device and session security, multi-channel security alerts, tamper-proof audit logs (SHA-256 hash chain), secure audit routes, and AES-256-GCM field encryption.
-   **Wallet & Earnings System**: Manages earnings, commissions, negative balances, and automated/manual payouts.
-   **Tax & Fees System**: Supports multi-country tax management with city-level overrides.
-   **Multi-Role Multi-Channel Support Center**: AI-first chat with 4-role support and a two-tier escalation system.
-   **Opportunity Bonus Management System**: Admin-managed ride incentives with country-specific and zone-based targeting.
-   **SafeGo Points System**: Gamified loyalty program with three tiers.
-   **Identity Verification System**: Manages country-specific identity documents with AES-256-GCM encryption.
-   **Restaurant Management Systems**: Includes performance insights, review management, media gallery, branding, operational settings, order management, staff management, and promotions.
-   **Customer-Facing Dynamic Pricing Display**: Provides real-time pricing transparency with surge multipliers and breakdowns.
-   **Unified Payout System**: Enterprise-grade management for customer payment methods and payout rails by country, service type, actor type, and KYC level, including automatic weekly scheduling and bank verification.
-   **Driver Systems**: Comprehensive driver profile management (multi-vehicle, encrypted KYC, document upload), earnings & payout dashboard, promotions, in-app training, and a Safety Center. This includes an Uber-style active trip screen (SafeGo Map component, trip status flow, multi-map navigation) and trip accept/decline flow (countdown, customer info, estimated fare, accept/decline actions, online/offline status management). Driver KYC includes E.164 phone validation and age verification.
-   **Rider Ride-Booking Flow**: Complete Uber-style multi-step booking experience using `RideBookingContext` for state management. This 6-step flow (`/rider/ride/new` to `/rider/trip/active`) includes map integration for pickup/dropoff, vehicle tier selection, payment method selection, and real-time trip tracking. It also features multi-route selection with up to 3 unique route alternatives.
-   **Phase A Ride System Features**: Covers comprehensive ride lifecycle management including customer controls (cancel ride, in-app chat, change destination), a post-trip 5-star rating system, detailed receipt system, and a driver status workflow with audit trails.
-   **API Design**: Robust API endpoints with enforcement of KYC, ownership validation, UUID format validation, Zod schema validation, atomic transactions, and consistent error handling.

### Database Schema Design
The schema uses UUID primary keys, indexed foreign keys, and decimal types for monetary values. It includes models for wallets, payouts, audit logs, notifications, platform settings, payment/payout accounts, opportunity settings, driver tiers and points, blocked riders, reviews, restaurant branding, media, hours, operational settings, delivery zones, surge settings, country payment/payout configurations, restaurant payout methods, categories, subcategories, menu item categories, promotion usage, multi-role support models, and driver safety incidents. It supports country-specific identity fields with AES-256-GCM encryption and includes flags for demo mode, US tax fields, driver preferences, and enhancements for promotions/coupons and review replies.

## External Dependencies

-   **Backend Core**: `@prisma/client`, `express`, `bcrypt`, `jsonwebtoken`, `@neondatabase/serverless`.
-   **Frontend Core**: `react`, `react-dom`, `wouter`, `@tanstack/react-query`, `react-hook-form`, `zod`.
-   **UI Components**: `@radix-ui/*`, `lucide-react`, `class-variance-authority`, `tailwind-merge`, `clsx`.
-   **Environment Variables**: `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`, `ENCRYPTION_KEY`, `SESSION_SECRET`.
-   **Optional Integrations**: Twilio (SMS OTP), AgentMail (Email OTP) for communication, which degrade gracefully if not configured.
-   **Google Maps Integration**: Client-side only using `GOOGLE_MAPS_API_KEY` with HTTP referrer restrictions. Utilizes Maps JavaScript API, Places API, Directions API, and Geocoding API.