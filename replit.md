# SafeGo Global Super-App

## Overview
SafeGo is a production-ready, full-stack multi-service super-app platform designed for global on-demand services such as ride-hailing, food delivery, and parcel delivery. Its primary goal is to deliver a scalable, secure, and feature-rich solution encompassing multi-role authentication, country-specific KYC, commission tracking, service lifecycle management, unified payment/payout systems, and comprehensive driver identity management. The project aims to secure a significant share in the on-demand services market through a superior and adaptable platform.

## User Preferences
Preferred communication style: Simple, everyday language.
Development approach: Full-stack TypeScript with modern tooling, emphasizing code quality, security, and scalability.

## System Architecture

### UI/UX Decisions
The frontend is built with React 18, TypeScript, Vite 5, shadcn/ui, Tailwind CSS 3, TanStack Query v5, wouter, and React Hook Form with Zod. It features a custom HSL color palette, Inter/Manrope typography, mobile-first responsive design, skeleton loading, toast notifications, error boundaries, and WCAG 2.1 AA compliance. Key UI/UX elements include Uber-level profile experiences, multi-step onboarding, country-specific KYC, and dedicated Food and Driver Profile Systems.

### Technical Implementations
The backend uses Node.js 20+, TypeScript, Express.js 4, and Prisma Client 6 with PostgreSQL 14+, employing a Generic Service Layer with Role Adapters.

**Core Features:**
*   **Admin Capabilities**: Interactive panel for dashboards, document management, wallet settlement, and global analytics.
*   **Security & Compliance**: Implements HTTP security headers, rate limiting, 2FA, device/session security, multi-channel alerts, tamper-proof audit logs, AES-256-GCM field encryption, and a Customer Account Lockout System.
*   **Wallet & Earnings System**: Manages earnings, commissions, negative balances, and automated/manual payouts.
*   **Tax & Fees System**: Supports multi-country tax management with city-level overrides.
*   **Multi-Role Multi-Channel Support Center**: AI-first chat with 4-role support and a two-tier escalation system.
*   **Opportunity Bonus Management System**: Admin-managed ride incentives with country-specific and zone-based targeting.
*   **SafeGo Points System**: Gamified loyalty program with three tiers.
*   **Identity Verification System**: Manages country-specific identity documents with AES-256-GCM encryption.
*   **Restaurant Management Systems**: Features performance insights, review management, media gallery, branding, operational settings, order management, staff management, and promotions.
*   **Unified Eats Experience**: DoorDash-style customer web experience for food ordering with hero search, cuisine categories, restaurant discovery, detailed restaurant pages, cart drawer, and full checkout flow. Includes real-time menu stock sync, advanced promo code system, menu item variants, and a full kitchen workflow.
*   **Driver Food Delivery Flow**: Connects restaurant orders to drivers for pickup and customer delivery, including driver assignment, status updates, and tracking. Features a complete driver food delivery experience with delivery inbox, payment method badges, cash blocking enforcement, and client/server-side protection.
*   **Ride Driver Web App Enhancement**: Comprehensive driver ride experience with mobile-first design, ride request details, and cash ride blocking.
*   **Driver Active Ride Workflow**: Complete ride lifecycle management with live location sharing, GPS tracking, and trip summary with earnings breakdown.
*   **Food Order Management**: Real-time order tracking with an 8-stage status timeline, live map, driver info, ETA calculations, in-app notifications, checkout payment validation, multiple delivery addresses, and order cancellation with refunds.
*   **Unified Payout System**: Enterprise-grade management for customer payment methods and payout rails by country, service type, actor type, and KYC level.
*   **Driver Systems**: Comprehensive driver profile management (multi-vehicle, encrypted KYC, document upload), earnings & payout dashboard, promotions, in-app training, and Safety Center. Includes active trip screen and accept/decline flow.
*   **Rider Ride-Booking Flow**: Uber-style multi-step booking experience with map integration, vehicle tier selection, payment method selection, real-time trip tracking, and multi-route selection.
*   **Multi-Route Fare Engine**: Enterprise-grade fare calculation system with a 19-step pipeline and real-time per-route pricing.
*   **Multi-Category Vehicle System**: Supports 7 Uber-style vehicle categories with configurable fare multipliers and minimum fares, enhanced rider selection UI, and driver-vehicle binding.
*   **Cross-State Fare Engine**: Dedicated Uber-style pricing for interstate trips.
*   **Promo Code System**: User-entered promotional codes with comprehensive validation.
*   **Ride System Features**: Ride lifecycle management including customer controls, post-trip rating, detailed receipts, and driver status workflow with audit trails.
*   **Driver Incentive Engine**: Comprehensive incentive system with 5 bonus types.
*   **AI Marketplace Balancer**: Enterprise-grade real-time marketplace optimization system.
*   **SafeGo Loyalty Engine**: Comprehensive dual-track loyalty system for riders and drivers.
*   **NYC TLC Regulatory Compliance**: Implements NYC Taxi & Limousine Commission regulations including minimum pay enforcement, fees, surcharges, and tolls detection and billing.
*   **TLC Report Generator & Audit Engine**: Monthly reporting system for TLC submissions and a comprehensive audit system with an automatic fix engine.
*   **NYC Borough Detection Service**: Polygon-based borough boundary detection using ray-casting.
*   **API Design**: Robust API endpoints with enforcement of KYC, ownership validation, UUID format validation, Zod schema validation, atomic transactions, and consistent error handling.
*   **Profile Navigation System**: Role-aware profile navigation with strict role validation, configurable routes, and reusable UI components.
*   **Real-Time Dispatch System**: WebSocket-based live customer-driver matching with JWT authentication, role-based rooms, proximity-based driver selection, automated offer management with configurable timeouts, and fallback to next candidate. Extensions include ETA calculation, live route tracking, fare recalculation, in-trip messaging, and multi-service dispatch support.
*   **Financial Integrity & Wallet System**: Comprehensive settlement, commission, tip, incentive, and cancellation fee infrastructure. Includes a `WalletService` for atomic operations, settlement status tracking for all trip types, dedicated tip handling, an `IncentiveRule` model for admin-defined bonuses, a `CancellationFeeRule` model, and a `PlatformRevenueLedger` for auditable tracking.
*   **Payment Gateway Integration & FCM Notifications**: Production-ready payment processing and push notification infrastructure. Features a `PaymentService` with a provider abstraction layer (supporting Mock and Stripe), a `NotificationService` for FCM integration, business-specific notification services, device registration endpoints, and payment webhooks.
*   **Database Schema Design**: Uses UUID primary keys, indexed foreign keys, decimal types for monetary values, and includes models for wallets, payouts, audit logs, notifications, platform settings, payment/payout accounts, opportunity settings, driver tiers and points, blocked riders, reviews, restaurant branding, media, hours, operational settings, delivery zones, surge settings, country payment/payout configurations, restaurant payout methods, categories, subcategories, menu item categories, promotion usage, multi-role support models, and driver safety incidents. Supports country-specific identity fields with AES-256-GCM encryption.

### Phase 3: Customer Experience, Restaurant Flow & Parcel Features
*   **Customer Saved Places**: CRUD system for managing favorite locations (home, work, other) with default pickup/dropoff settings. Enforces max 1 home and 1 work location. API: `/api/customer/saved-places`
*   **Customer Ride Preferences**: Personalization settings including temperature, music, conversation level, accessibility needs, pet-friendly, child seat requirements, and special instructions. API: `/api/customer/ride-preferences`
*   **Restaurant Kitchen Display System**: Real-time ticket management for restaurant kitchens with status progression (pending → preparing → ready → completed), priority handling, and average prep time tracking. API: `/api/restaurant/kitchen/tickets`
*   **Parcel Scheduled Pickup**: Allows customers to schedule parcel pickups for a future date/time instead of immediate dispatch. Integrated into parcel request flow.
*   **Proof-of-Delivery Photos**: Photo upload system for delivery proof with access control. API: `/api/parcel/deliveries/:id/pod-photos`
*   **Parcel Pricing Configuration**: Size/weight-based dynamic pricing with country-specific configurations. API: `/api/parcel/pricing-config`
*   **Phase 3 Feature Flags**: Configuration file (`server/config/phase3Features.ts`) controls feature availability for saved places, parcel scheduling, and POD photo requirements.

**Phase 3 New Database Models:**
- `CustomerSavedPlace`: Stores saved locations with labels, coordinates, and default flags
- `CustomerRidePreferences`: Stores ride comfort preferences per customer
- `KitchenTicket`: Tracks food order preparation status in restaurant kitchens
- `ParcelPricingConfig`: Defines size/weight pricing rules per country
- `DeliveryProofPhoto`: Stores proof-of-delivery photo metadata and access control

**Phase 3 Frontend Pages:**
- `/customer/saved-places`: Manage favorite locations
- `/customer/ride-preferences`: Set ride comfort preferences
- `/customer/profile`: Enhanced profile with avatarUrl, language, and notification preferences
- `/customer/payment-methods`: Full CRUD for customer payment methods
- `/restaurant/kitchen`: Kitchen display system with ticket management
- Enhanced `/customer/parcel`: Scheduled pickup option added

**Phase 3 Admin Visibility Routes:**
- `GET /api/admin/customers/:customerId/saved-places`: View customer's saved locations
- `GET /api/admin/customers/:customerId/ride-preferences`: View customer's ride preferences
- `GET /api/admin/customers/:customerId/payment-methods`: View customer's payment methods
- `GET /api/admin/parcels/scheduled`: List all scheduled parcel pickups with pagination
- `GET /api/admin/parcels/:deliveryId/proof-of-delivery`: View POD photos for a delivery
- `GET /api/parcel/admin/pricing`: Manage parcel pricing configurations

## External Dependencies

*   **Backend Core**: `@prisma/client`, `express`, `bcrypt`, `jsonwebtoken`, `@neondatabase/serverless`.
*   **Frontend Core**: `react`, `react-dom`, `wouter`, `@tanstack/react-query`, `react-hook-form`, `zod`.
*   **UI Components**: `@radix-ui/*`, `lucide-react`, `class-variance-authority`, `tailwind-merge`, `clsx`.
*   **Environment Variables**: `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`, `ENCRYPTION_KEY`, `SESSION_SECRET`.
*   **Third-party Services**: Twilio (SMS OTP), AgentMail (Email OTP), Stripe (payment gateway), Google Maps Platform (Maps JavaScript API, Places API, Directions API, Geocoding API).