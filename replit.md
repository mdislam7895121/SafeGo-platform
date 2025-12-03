# SafeGo Global Super-App

## Overview
SafeGo is a production-ready, full-stack multi-service super-app platform for global on-demand services like ride-hailing, food delivery, and parcel delivery. It aims to provide a scalable, secure, and feature-rich solution with multi-role authentication, country-specific KYC, commission tracking, service lifecycle management, unified payment/payout systems, and comprehensive driver identity management to capture a significant market share.

## User Preferences
Preferred communication style: Simple, everyday language.
Development approach: Full-stack TypeScript with modern tooling, emphasizing code quality, security, and scalability.

## System Architecture

### UI/UX Decisions
The frontend utilizes React 18, TypeScript, Vite 5, shadcn/ui, Tailwind CSS 3, TanStack Query v5, wouter, and React Hook Form with Zod. It features a custom HSL color palette, Inter/Manrope typography, mobile-first responsive design, skeleton loading, toast notifications, error boundaries, and WCAG 2.1 AA compliance. Key UI/UX includes Uber-level profiles, multi-step onboarding, country-specific KYC, and dedicated Food/Driver Profile Systems.

### Technical Implementations
The backend uses Node.js 20+, TypeScript, Express.js 4, and Prisma Client 6 with PostgreSQL 14+, employing a Generic Service Layer with Role Adapters.

**Core Features:**
*   **Admin Capabilities**: Interactive panel for dashboards, document management, wallet settlement, and global analytics.
*   **Security & Compliance**: HTTP security headers, rate limiting, 2FA, device/session security, multi-channel alerts, tamper-proof audit logs, AES-256-GCM encryption, and Customer Account Lockout System.
*   **Wallet & Earnings System**: Manages earnings, commissions, negative balances, and automated/manual payouts.
*   **Tax & Fees System**: Multi-country tax management with city-level overrides.
*   **Multi-Role Multi-Channel Support Center**: AI-first chat with 4-role support and two-tier escalation.
*   **Opportunity Bonus Management System**: Admin-managed ride incentives with country-specific and zone-based targeting.
*   **SafeGo Points System**: Gamified loyalty program with three tiers.
*   **Identity Verification System**: Manages country-specific identity documents with AES-256-GCM encryption, real-time ID verification (Persona/Onfido), background checks (Checkr), and facial recognition matching (AWS Rekognition).
*   **Restaurant Management Systems**: Performance insights, review management, media gallery, branding, operational settings, order management, staff management, and promotions. Includes a Kitchen Display System for real-time ticket management.
*   **Unified Eats Experience**: DoorDash-style customer web experience for food ordering with discovery, detailed restaurant pages, cart, full checkout, real-time menu stock sync, advanced promo codes, menu item variants, and a full kitchen workflow.
*   **Driver Food Delivery Flow**: Connects restaurant orders to drivers for pickup and customer delivery, including assignment, status updates, and tracking.
*   **Ride Driver Web App Enhancement**: Comprehensive driver ride experience with mobile-first design, ride request details, and cash ride blocking.
*   **Driver Active Ride Workflow**: Ride lifecycle management with live location sharing, GPS tracking, and trip summary.
*   **Food Order Management**: Real-time order tracking (8-stage status), live map, driver info, ETA, in-app notifications, checkout validation, multiple delivery addresses, and order cancellation with refunds.
*   **Unified Payout System**: Enterprise-grade management for customer payment methods and payout rails by country, service type, actor type, and KYC level. Integrates with Bangladesh mobile wallets (bKash, Nagad).
*   **Driver Systems**: Comprehensive driver profile management (multi-vehicle, encrypted KYC, document upload), earnings & payout dashboard, promotions, in-app training, Safety Center, and active trip screen.
*   **Rider Ride-Booking Flow**: Uber-style multi-step booking with map integration, vehicle tier, payment, real-time tracking, and multi-route selection. Includes customer saved places and ride preferences.
*   **Multi-Route Fare Engine**: Enterprise-grade 19-step fare calculation system with real-time per-route pricing.
*   **Multi-Category Vehicle System**: Supports 7 Uber-style vehicle categories with configurable fare multipliers and minimum fares.
*   **Cross-State Fare Engine**: Dedicated Uber-style pricing for interstate trips.
*   **Promo Code System**: User-entered promotional codes with comprehensive validation.
*   **Social Media Sharing for Promotions**: Reusable SocialShareButton component (client/src/components/ui/social-share-button.tsx) enabling promotion sharing to Twitter/X, Facebook, LinkedIn, WhatsApp with copy-link and native Web Share API support. Includes UTM tracking parameters for analytics. Integrated in admin ride promotions and restaurant promotion management pages.
*   **Ride System Features**: Ride lifecycle management with customer controls, post-trip rating, detailed receipts, and driver status workflow with audit trails.
*   **Driver Incentive Engine**: Comprehensive incentive system with 5 bonus types.
*   **AI Marketplace Balancer**: Enterprise-grade real-time marketplace optimization.
*   **SafeGo Loyalty Engine**: Comprehensive dual-track loyalty system for riders and drivers.
*   **NYC TLC Regulatory Compliance**: Implements NYC Taxi & Limousine Commission regulations including minimum pay enforcement, fees, surcharges, and tolls.
*   **TLC Report Generator & Audit Engine**: Monthly reporting system for TLC submissions and a comprehensive audit system.
*   **NYC Borough Detection Service**: Polygon-based borough boundary detection.
*   **API Design**: Robust API endpoints with enforcement of KYC, ownership validation, UUID format, Zod schema validation, atomic transactions, and consistent error handling.
*   **Profile Navigation System**: Role-aware profile navigation with strict role validation.
*   **Real-Time Dispatch System**: WebSocket-based live customer-driver matching with JWT authentication, proximity-based driver selection, automated offer management, and fallback.
*   **Financial Integrity & Wallet System**: Comprehensive settlement, commission, tip, incentive, and cancellation fee infrastructure with a `WalletService` for atomic operations and `PlatformRevenueLedger`.
*   **Payment Gateway Integration & FCM Notifications**: Production-ready payment processing (`PaymentService` with provider abstraction) and push notification infrastructure (`NotificationService` for FCM).
*   **Database Schema Design**: Uses UUID primary keys, indexed foreign keys, decimal types for monetary values, and models for wallets, payouts, audit logs, notifications, platform settings, payment/payout accounts, opportunity settings, driver tiers and points, blocked riders, reviews, restaurant branding, media, hours, operational settings, delivery zones, surge settings, country payment/payout configurations, restaurant payout methods, categories, subcategories, menu item categories, promotion usage, multi-role support models, and driver safety incidents. Supports country-specific identity fields.
*   **Parcel Features**: Scheduled pickup, Proof-of-Delivery photos, and size/weight-based dynamic pricing configuration.
*   **Phase 5: Experience Intelligence & Real-Time Optimization**: Driver turn-by-turn navigation with multi-provider support (Google Maps, Mapbox, OpenRouteService), smart personalized push notifications with quiet hours and channel preferences, dynamic routing optimization with configurable weights (distance, time, traffic, safety), real-time ETA refinement using driver performance history, enhanced rider safety with SOS features and location sharing, driver incentive optimization engine with AI-generated recommendations, and comprehensive admin dashboard for monitoring navigation sessions, safety events, and incentive management.
*   **Phase 6B: Extended Security for Customer & Company Protection**: Enterprise-grade security modules including:
    - **Customer Security**: Phone masking (E.164 format), proxy calling with encrypted data, enhanced SOS with 3-tier escalation and encrypted GPS streams, route deviation detection, and device binding with fingerprint-based validation
    - **Company Security**: Admin 2FA (TOTP-based with backup codes), IP whitelisting for admin access, admin activity monitoring with tamper-proof audit logs, developer access control with mTLS certificate binding, and payout audit trails
    - **Platform Hardening**: Bot protection with behavioral analysis, API firewall with rate limiting and DDoS protection, content moderation service, privacy compliance (GDPR/CCPA data subject requests), and breach response system with notification tracking
    - **Security Infrastructure**: AES-256-GCM encryption with strict key validation (no fallback keys), per-operation random IVs, authenticated tags, and fail-fast behavior when ENCRYPTION_KEY is missing/invalid
    - **API Routes**: Customer-facing at /api/security/*, admin-only at /api/admin/security/*
    - **Critical Deployment Note**: ENCRYPTION_KEY environment variable (64-character hex string) MUST be set before production deployment
*   **Bangladesh Expansion (BD-Only Roles)**: Two new BD-exclusive partner roles with complete KYC onboarding and commerce workflows:
    - **SafeGo Shop Partner**: Product sales platform enabling local shops to list products and receive orders via SafeGo
      - Full KYC onboarding with NID, trade license, MFS accounts (bKash, Nagad)
      - Product catalog management (CRUD, inventory, categories)
      - Order lifecycle: requested → confirmed → preparing → ready → picked_up → delivered
      - Commission tracking with cash/online payment handling
      - Wallet system with negative balance management for COD orders
    - **SafeGo Ticket & Rental Operator**: Transportation and rental services
      - Operator types: bus_company, ferry_company, train_operator, rental_service
      - Ticket listings with seat capacity, route management, and booking workflow
      - Vehicle rentals with daily rates, availability calendar, and booking lifecycle
      - Separate commission rates for tickets vs rentals
      - Status flows: Tickets (available → booked → confirmed → used), Rentals (available → booked → confirmed → active → completed)
    - **Admin Management**: /api/admin/bd-expansion/* endpoints for verification, commission adjustment, and balance settlement
    - **Country Enforcement**: All BD expansion routes validate countryCode="BD" for strict role isolation
*   **BD Customer Signup System (December 2025)**: Production-ready customer-only signup flow for Bangladesh:
    - **Public Routes**: /login and /signup only (customer-only public signup)
    - **Signup Page**: BD-only (no country selector), optional fullName field, password strength validation with Bangla UX, auto-login after signup → redirect to /customer
    - **Backend Security**: POST /api/auth/signup enforces role="customer" and countryCode="BD" server-side, ignores any role/countryCode from client
    - **Bangla Error Messages**: All validation errors use Bangla messages with error codes (EMAIL_IN_USE, PASSWORD_MISMATCH, etc.)
    - **Audit Logging**: CUSTOMER_SIGNUP_SUCCESS event logged with country="BD" metadata
    - **Partner Upgrade Flow**: Logged-in customers can upgrade to shop_partner or ticket_operator via /shop-partner/onboarding or /ticket-operator/onboarding
    - **Role Preservation**: All existing roles (customer, driver, restaurant, admin, shop_partner, ticket_operator) remain intact

## External Dependencies

*   **Backend Core**: `@prisma/client`, `express`, `bcrypt`, `jsonwebtoken`, `@neondatabase/serverless`.
*   **Frontend Core**: `react`, `react-dom`, `wouter`, `@tanstack/react-query`, `react-hook-form`, `zod`.
*   **UI Components**: `@radix-ui/*`, `lucide-react`, `class-variance-authority`, `tailwind-merge`, `clsx`.
*   **Third-party Services**: Twilio (SMS OTP), AgentMail (Email OTP), Stripe (payment gateway), Google Maps Platform (Maps JavaScript API, Places API, Directions API, Geocoding API), bKash, Nagad, Checkr, AWS Rekognition, Persona/Onfido.