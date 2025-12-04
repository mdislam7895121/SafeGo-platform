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
*   **Profit-Focused Automation Systems** (8 services with comprehensive admin visibility):
    *   **Auto Assignment Engine**: Proximity-based partner assignment with verification status, performance score, and cancellation history weighting
    *   **Surge Pricing Automation**: Real-time demand/supply analysis with configurable multipliers, peak hours, and weekend/festival bonuses
    *   **Auto Settlement Service**: Weekly commission settlement with cash recovery, negative balance management, and auto freeze/unfreeze
    *   **Recommendation Engine**: AI-powered personalized suggestions for rides, restaurants, shops, rentals, and tickets
    *   **Dynamic Pricing Service**: Time-based, demand-based, and festival/weekend-based price optimization
    *   **Performance Scoring Service**: Automated driver/partner scoring with tier system (platinum/gold/silver/bronze/warning/suspended)
    *   **Auto Cancellation Service**: Driver cooldowns, customer penalty windows, and restaurant/shop delay compensation
    *   **Auto Payout Service**: Risk-based payout processing with auto-approval thresholds, fraud detection, and admin override
*   **Regional Expansion (Bangladesh)**: Specific roles (SafeGo Shop Partner, SafeGo Ticket & Rental Operator) with complete KYC, product/order management, wallet, payout systems, and customer-only signup flow with Bangla UX and error messages.
*   **Regulatory Compliance**: NYC TLC regulatory compliance including minimum pay enforcement, fees, surcharges, tolls, and report generation.
*   **API Design**: Robust API endpoints with enforcement of KYC, ownership validation, Zod schema validation, atomic transactions, and consistent error handling.
*   **Database Schema**: Uses UUID primary keys, indexed foreign keys, decimal types for monetary values, and comprehensive models for all core features and settings.

## External Dependencies

*   **Backend Core**: `@prisma/client`, `express`, `bcrypt`, `jsonwebtoken`, `@neondatabase/serverless`.
*   **Frontend Core**: `react`, `react-dom`, `wouter`, `@tanstack/react-query`, `react-hook-form`, `zod`.
*   **UI Components**: `@radix-ui/*`, `lucide-react`, `class-variance-authority`, `tailwind-merge`, `clsx`.
*   **Third-party Services**: Twilio (SMS OTP), AgentMail (Email OTP), Stripe (payment gateway), Google Maps Platform (Maps JavaScript API, Places API, Directions API, Geocoding API), bKash, Nagad, Checkr, AWS Rekognition, Persona/Onfido.

## Security Audit (December 2024)

### Critical Fixes Applied
- **Hardcoded Secret Fallbacks Removed**: JWT_SECRET and ENCRYPTION_KEY now fail-fast across all modules (auth middleware, routes, WebSocket handlers, encryption utilities) - no default values that could allow token forgery or data decryption
- **Environment Guard**: Validates all critical secrets at startup with clear error messages; production deployments fail fast if misconfigured
- **WebSocket Security**: All WebSocket handlers (supportChat, rideChat, dispatch, foodOrderNotifications) require valid JWT_SECRET
- **Automation Admin Routes Secured**: All `/api/admin/automation/*` endpoints protected with `authenticateToken` + `requireAdminRole` middleware, `getRequiredAdminId()` helper prevents any mutation without verified admin identity (no fallback to 'system')

### Security Controls Verified
- **Authentication**: JWT with short-lived access tokens (15m), HTTP-only refresh tokens (30d), bcrypt password hashing (cost 10), account lockout after 5 failed attempts
- **Authorization**: Role-based access control (RBAC) with granular permissions, admin 2FA support, admin role hierarchy (SUPER_ADMIN, COMPLIANCE_ADMIN, SUPPORT_ADMIN, FINANCE_ADMIN, READONLY_ADMIN)
- **Encryption**: AES-256-GCM for sensitive data (NID, SSN, bank accounts, 2FA secrets), proper IV/auth tag validation, legacy CBC migration path
- **Rate Limiting**: Admin login (5 attempts/15min), analytics (60 req/min), auth (10 req/min), payout (20 req/min), support (30 req/min)
- **Security Headers**: CSP, HSTS (production), X-Frame-Options DENY, X-Content-Type-Options nosniff, strict CORS
- **File Uploads**: Path traversal protection via sanitizeFilename, MIME type whitelist, size limits (5-10MB)
- **Audit Logging**: Tamper-proof with hash chaining, excludes sensitive fields (passwords, tokens, secrets)

### Known Dependency CVEs (Lower Priority)
- `lodash.pick` (via @react-three/drei): Prototype pollution - not exploited in current code
- `glob` 10.2.0-10.4.5: CLI command injection - not applicable (library usage only)
- `esbuild` <=0.24.2: Dev server cross-origin bypass - development only

### Recommended Future Improvements
1. Consolidate duplicate `authenticateToken` implementations (auth.ts vs authz.ts) into single shared module
2. Schedule dependency upgrades for CVE remediation
3. Add refresh token revocation on logout