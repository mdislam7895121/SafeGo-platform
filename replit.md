# SafeGo Global Super-App

## Overview
SafeGo is a production-ready, full-stack multi-service super-app platform designed for global on-demand services like ride-hailing, food delivery, and parcel delivery. Its core purpose is to secure a significant market share by offering a scalable, secure, and feature-rich solution. The platform includes multi-role authentication, country-specific KYC, commission tracking, service lifecycle management, unified payment/payout systems, and comprehensive driver identity management.

## User Preferences
Preferred communication style: Simple, everyday language.
Development approach: Full-stack TypeScript with modern tooling, emphasizing code quality, security, and scalability.

## System Architecture
The frontend is built with React 18, TypeScript, Vite 5, shadcn/ui, Tailwind CSS 3, TanStack Query v5, wouter, and React Hook Form with Zod, utilizing a custom HSL color palette, Inter/Manrope typography, mobile-first responsive design, and WCAG 2.1 AA compliance. The backend uses Node.js 20+, TypeScript, Express.js 4, and Prisma Client 6 with PostgreSQL 14+, employing a Generic Service Layer with Role Adapters.

**Key Architectural and Feature Highlights:**

*   **UI/UX Decisions**: Custom HSL color palette, Inter/Manrope typography, mobile-first responsive design, WCAG 2.1 AA compliance, and an Enterprise Admin Component Library for consistent UI.
*   **Security & Compliance**: Implements HTTP security headers, rate limiting, 2FA, device/session security, AES-256-GCM encryption, tamper-proof audit logs (with hash chain verification), Customer Account Lockout, phone masking, proxy calling, enhanced SOS, route deviation detection, device binding, admin 2FA, IP whitelisting, activity monitoring, developer access control with mTLS, payout audit trails, and adheres to NYC TLC regulatory compliance.
*   **Financial Systems**: Comprehensive Wallet & Earnings, Tax & Fees, and Unified Payout systems, managing commissions, negative balances, multi-country taxes, and enterprise-grade payment/payout rails.
*   **Customer & Partner Onboarding**: Features Uber-level profiles, multi-step onboarding, country-specific KYC (with real-time ID verification, background checks, facial recognition, and a multi-stage review queue with risk signals and duplicate detection).
*   **Service Offerings**: Supports Food Delivery (Restaurant Management, Unified Eats, Driver Flow), Ride-Hailing (Rider Booking, Multi-Route Fare Engine, Multi-Category Vehicle System, Driver Workflow), and Parcel Delivery (scheduled pickup, Proof-of-Delivery, dynamic pricing).
*   **Loyalty & Incentives**: SafeGo Points System, Opportunity Bonus Management System, and Driver Incentive Engine.
*   **Real-Time & Optimization**: AI Marketplace Balancer, Real-Time Dispatch System (WebSocket-based, proximity matching), Experience Intelligence with real-time ETA refinement, dynamic routing optimization, personalized push notifications, and Admin Notifications WebSocket (`/api/admin/notifications/ws`) with JWT auth, role-scoped broadcasts, real-time cache invalidation, and sound alerts.
*   **Profit-Focused Automation Systems**: A suite of 32 services covering core automation (e.g., Auto Assignment, Surge Pricing), security & fraud prevention, risk intelligence (e.g., Driver Fatigue Detection), experience optimization, and platform operations.
*   **Regional Expansion**: Supports specific roles and KYC for Bangladesh with Bangla UX.
*   **API Design**: Robust API endpoints with enforcement of KYC, ownership validation, Zod schema validation, atomic transactions, and consistent error handling.
*   **Database Schema**: Utilizes UUID primary keys, indexed foreign keys, decimal types for monetary values, and comprehensive models.
*   **Role-Based Access Control (RBAC)**: Comprehensive 8-role admin system (SUPER_ADMIN, ADMIN, COUNTRY_ADMIN, etc.) with granular permissions, permission bundles, emergency lockdown controls (GLOBAL, COUNTRY, SERVICE), admin impersonation mode (view-only with audit trail), and secure internal messaging.
*   **Global Audit Engine**: Tamper-proof logging with hash chain verification, evidence packets, and regulator export mode.

## Recent Changes (Phase 2 - December 4, 2025)

*   **Feature Flags Management**: Enterprise UI with grouped categories, rollout sliders, environment previews
*   **Real-time Notifications**: WebSocket-based admin notifications with JWT auth, role-scoped broadcasts
*   **Global Theme System**: Dark/Light/System modes, 5 admin presets, accessibility modes (high-contrast, reduced-motion, large-text)
*   **Mobile Optimization**: 44px tap targets, responsive typography
*   **Audit Logging Expansion**: Multi-admin tracking, region scoping (countryCode, userAgent, environment fields), export APIs
*   **Environment Separation**: Dev/staging/prod configuration with feature gates
*   **Access Governance**: Role visualization with hierarchy tree, permission matrix, country scope map

## External Dependencies

*   **Backend Core**: `@prisma/client`, `express`, `bcrypt`, `jsonwebtoken`, `@neondatabase/serverless`.
*   **Frontend Core**: `react`, `react-dom`, `wouter`, `@tanstack/react-query`, `react-hook-form`, `zod`.
*   **UI Components**: `@radix-ui/*`, `lucide-react`, `class-variance-authority`, `tailwind-merge`, `clsx`.
*   **Third-party Services**: Twilio (SMS OTP), AgentMail (Email OTP), Stripe (payment gateway), Google Maps Platform (Maps JavaScript API, Places API, Directions API, Geocoding API), bKash, Nagad, Checkr, AWS Rekognition, Persona/Onfido.

## Key Files & Directories (Phase 2)

*   `server/config/environmentConfig.ts` - Environment separation configuration
*   `server/services/tamperProofAuditService.ts` - Hash chain audit verification
*   `server/utils/audit.ts` - Enhanced audit logging with new fields
*   `client/src/contexts/ThemeContext.tsx` - Global theme provider
*   `client/src/pages/admin/feature-flags.tsx` - Feature flags management
*   `client/src/pages/admin/notifications.tsx` - Notification center
*   `client/src/pages/admin/access-governance.tsx` - Role visualization
*   `docs/PHASE2_REPORT.md` - Complete Phase 2 documentation
*   `docs/CHANGELOG_PHASE2.md` - Phase 2 changelog