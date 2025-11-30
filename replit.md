# SafeGo Global Super-App

## Overview
SafeGo is a production-ready, full-stack multi-service super-app platform for global on-demand services like ride-hailing, food delivery, and parcel delivery. Its purpose is to provide a scalable, secure, and feature-rich solution with capabilities such as multi-role authentication, country-specific KYC, commission tracking, service lifecycle management, unified payment/payout systems, and comprehensive driver identity management. The project aims to capture a significant market share in the on-demand services sector by offering a superior and adaptable platform.

## User Preferences
Preferred communication style: Simple, everyday language.
Development approach: Full-stack TypeScript with modern tooling, emphasizing code quality, security, and scalability.

## System Architecture

### UI/UX Decisions
The frontend uses React 18, TypeScript, Vite 5, shadcn/ui, Tailwind CSS 3, TanStack Query v5, wouter, and React Hook Form with Zod. It features a custom HSL color palette, Inter/Manrope typography, mobile-first responsive design, skeleton loading, toast notifications, error boundaries, and WCAG 2.1 AA compliance. Key UI/UX elements include Uber-level profile experiences, multi-step onboarding, country-specific KYC, and dedicated Food and Driver Profile Systems.

### Technical Implementations
The backend is built with Node.js 20+, TypeScript, Express.js 4, and Prisma Client 6 with PostgreSQL 14+, utilizing a Generic Service Layer with Role Adapters.

**Core Features:**
*   **Admin Capabilities**: Interactive panel for dashboards, document management, wallet settlement, and global analytics.
*   **Security & Compliance**: Implements HTTP security headers, rate limiting, 2FA, device/session security, multi-channel alerts, tamper-proof audit logs, secure audit routes, AES-256-GCM field encryption, and a Customer Account Lockout System.
*   **Wallet & Earnings System**: Manages earnings, commissions, negative balances, and automated/manual payouts.
*   **Tax & Fees System**: Supports multi-country tax management with city-level overrides.
*   **Multi-Role Multi-Channel Support Center**: AI-first chat with 4-role support and a two-tier escalation system.
*   **Opportunity Bonus Management System**: Admin-managed ride incentives with country-specific and zone-based targeting.
*   **SafeGo Points System**: Gamified loyalty program with three tiers.
*   **Identity Verification System**: Manages country-specific identity documents with AES-256-GCM encryption.
*   **Restaurant Management Systems**: Features performance insights, review management, media gallery, branding, operational settings, order management, staff management, and promotions.
*   **Unified Eats Experience**: DoorDash-style customer web experience for food ordering with hero search, cuisine categories, featured carousels, restaurant discovery, detailed restaurant pages with menu items, cart drawer, and full checkout flow. Includes real-time menu stock sync and advanced promo code system. Supports menu item variants and add-ons with price delta calculations. Includes a full kitchen workflow for restaurants.
*   **Driver Food Delivery Flow**: Connects restaurant orders to drivers for pickup and customer delivery, including driver assignment, status updates, and tracking.
*   **Ride Driver Web App Enhancement**: Comprehensive driver ride experience with mobile-first design, ride request details (route visualization, customer info, fare breakdown), and cash ride blocking based on negative balance.
*   **Driver Active Ride Workflow**: Complete ride lifecycle management with live location sharing, GPS tracking, and trip summary with earnings breakdown.
*   **Food Order Management**: Real-time order tracking with an 8-stage status timeline, live map, driver info, ETA calculations, in-app notifications, checkout payment validation, multiple delivery addresses, and order cancellation with refunds.
*   **Unified Payout System**: Enterprise-grade management for customer payment methods and payout rails by country, service type, actor type, and KYC level.
*   **Driver Systems**: Comprehensive driver profile management (multi-vehicle, encrypted KYC, document upload), earnings & payout dashboard, promotions, in-app training, and Safety Center. Includes active trip screen and accept/decline flow.
*   **Rider Ride-Booking Flow**: Uber-style multi-step booking experience with map integration, vehicle tier selection, payment method selection, real-time trip tracking, and multi-route selection.
*   **Multi-Route Fare Engine**: Enterprise-grade fare calculation system with a 19-step pipeline and real-time per-route pricing.
*   **Multi-Category Vehicle System**: Supports 7 Uber-style vehicle categories with configurable fare multipliers and minimum fares. Includes enhanced rider selection UI and driver-vehicle binding.
*   **Cross-State Fare Engine**: Dedicated Uber-style pricing for interstate trips.
*   **Promo Code System**: User-entered promotional codes with comprehensive validation.
*   **Ride System Features**: Ride lifecycle management including customer controls (cancel, chat, change destination), post-trip rating, detailed receipts, and driver status workflow with audit trails.
*   **Driver Incentive Engine**: Comprehensive incentive system with 5 bonus types.
*   **AI Marketplace Balancer**: Enterprise-grade real-time marketplace optimization system.
*   **SafeGo Loyalty Engine**: Comprehensive dual-track loyalty system for riders and drivers.
*   **NYC TLC Regulatory Compliance**: Implements NYC Taxi & Limousine Commission regulations including minimum pay enforcement, fees, surcharges, and tolls detection and billing.
*   **TLC Report Generator & Audit Engine**: Monthly reporting system for TLC submissions and a comprehensive audit system with an automatic fix engine.
*   **NYC Borough Detection Service**: Polygon-based borough boundary detection using ray-casting.
*   **API Design**: Robust API endpoints with enforcement of KYC, ownership validation, UUID format validation, Zod schema validation, atomic transactions, and consistent error handling.
*   **Profile Navigation System**: Role-aware profile navigation with strict role validation. Includes `profileNavConfig.ts` for route mapping, `ProfileAvatarButton.tsx` for reusable avatar buttons with dropdown/drawer support, and `AdminLayout.tsx` providing consistent admin page headers with profile navigation and logout functionality.

### Database Schema Design
The schema uses UUID primary keys, indexed foreign keys, and decimal types for monetary values. It includes models for wallets, payouts, audit logs, notifications, platform settings, payment/payout accounts, opportunity settings, driver tiers and points, blocked riders, reviews, restaurant branding, media, hours, operational settings, delivery zones, surge settings, country payment/payout configurations, restaurant payout methods, categories, subcategories, menu item categories, promotion usage, multi-role support models, and driver safety incidents. It supports country-specific identity fields with AES-256-GCM encryption.

## External Dependencies

*   **Backend Core**: `@prisma/client`, `express`, `bcrypt`, `jsonwebtoken`, `@neondatabase/serverless`.
*   **Frontend Core**: `react`, `react-dom`, `wouter`, `@tanstack/react-query`, `react-hook-form`, `zod`.
*   **UI Components**: `@radix-ui/*`, `lucide-react`, `class-variance-authority`, `tailwind-merge`, `clsx`.
*   **Environment Variables**: `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`, `ENCRYPTION_KEY`, `SESSION_SECRET`.
*   **Optional Integrations**: Twilio (SMS OTP), AgentMail (Email OTP).
*   **Google Maps Integration**: Client-side using `GOOGLE_MAPS_API_KEY` for Maps JavaScript API, Places API, Directions API, and Geocoding API.