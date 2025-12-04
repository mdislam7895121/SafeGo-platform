# SafeGo Global Super-App

## Overview
SafeGo is a production-ready, full-stack multi-service super-app platform offering global on-demand services like ride-hailing, food delivery, and parcel delivery. It provides a scalable, secure, and feature-rich solution with multi-role authentication, country-specific KYC, commission tracking, service lifecycle management, unified payment/payout systems, and comprehensive driver identity management to capture a significant market share.

## User Preferences
Preferred communication style: Simple, everyday language.
Development approach: Full-stack TypeScript with modern tooling, emphasizing code quality, security, and scalability.

## System Architecture
The frontend utilizes React 18, TypeScript, Vite 5, shadcn/ui, Tailwind CSS 3, TanStack Query v5, wouter, and React Hook Form with Zod, featuring a custom HSL color palette, Inter/Manrope typography, mobile-first responsive design, and WCAG 2.1 AA compliance. The backend uses Node.js 20+, TypeScript, Express.js 4, and Prisma Client 6 with PostgreSQL 14+, employing a Generic Service Layer with Role Adapters.

**Key Architectural and Feature Highlights:**

*   **Admin Capabilities**: Interactive panel for dashboards, document management, wallet settlement, and global analytics.
*   **Security & Compliance**: HTTP security headers, rate limiting, 2FA, device/session security, AES-256-GCM encryption, tamper-proof audit logs, and Customer Account Lockout. Includes advanced security modules for phone masking, proxy calling, enhanced SOS with 3-tier escalation, route deviation detection, device binding, admin 2FA, IP whitelisting, activity monitoring, developer access control with mTLS, and payout audit trails.
*   **Financial Systems**: Comprehensive Wallet & Earnings, Tax & Fees, and Unified Payout systems, managing commissions, negative balances, multi-country taxes, and enterprise-grade payment/payout rails by country and service type.
*   **Customer & Partner Onboarding**: Uber-level profiles, multi-step onboarding, country-specific KYC, real-time ID verification, background checks, and facial recognition.
*   **Service Offerings**:
    *   **Food Delivery**: Restaurant Management Systems (KDS, order management), Unified Eats Experience (customer web, real-time menu sync, promotions), and Driver Food Delivery Flow.
    *   **Ride-Hailing**: Rider Ride-Booking Flow (map integration, vehicle tier, real-time tracking), Multi-Route Fare Engine, Multi-Category Vehicle System, Cross-State Fare Engine, and Driver Active Ride Workflow.
    *   **Parcel Delivery**: Scheduled pickup, Proof-of-Delivery photos, and size/weight-based dynamic pricing.
*   **Loyalty & Incentives**: SafeGo Points System (gamified), Opportunity Bonus Management System, and Driver Incentive Engine.
*   **Real-Time & Optimization**: AI Marketplace Balancer, Real-Time Dispatch System (WebSocket-based, proximity matching), and Experience Intelligence with real-time ETA refinement, dynamic routing optimization, and smart personalized push notifications.
*   **Regional Expansion (Bangladesh)**: Specific roles (SafeGo Shop Partner, SafeGo Ticket & Rental Operator) with complete KYC, product/order management, wallet, payout systems, and customer-only signup flow with Bangla UX and error messages.
*   **Regulatory Compliance**: NYC TLC regulatory compliance including minimum pay enforcement, fees, surcharges, tolls, and report generation.
*   **API Design**: Robust API endpoints with enforcement of KYC, ownership validation, Zod schema validation, atomic transactions, and consistent error handling.
*   **Database Schema**: Uses UUID primary keys, indexed foreign keys, decimal types for monetary values, and comprehensive models for all core features and settings.

## External Dependencies

*   **Backend Core**: `@prisma/client`, `express`, `bcrypt`, `jsonwebtoken`, `@neondatabase/serverless`.
*   **Frontend Core**: `react`, `react-dom`, `wouter`, `@tanstack/react-query`, `react-hook-form`, `zod`.
*   **UI Components**: `@radix-ui/*`, `lucide-react`, `class-variance-authority`, `tailwind-merge`, `clsx`.
*   **Third-party Services**: Twilio (SMS OTP), AgentMail (Email OTP), Stripe (payment gateway), Google Maps Platform (Maps JavaScript API, Places API, Directions API, Geocoding API), bKash, Nagad, Checkr, AWS Rekognition, Persona/Onfido.