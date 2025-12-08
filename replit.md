# SafeGo Global Super-App

## Overview
SafeGo is a production-ready, full-stack multi-service super-app platform offering global on-demand services such as ride-hailing, food delivery, and parcel delivery. It aims to capture significant market share by providing a scalable, secure, and feature-rich solution including multi-role authentication, country-specific KYC, commission tracking, service lifecycle management, unified payment/payout systems, and comprehensive driver identity management.

## User Preferences
Preferred communication style: Simple, everyday language.
Development approach: Full-stack TypeScript with modern tooling, emphasizing code quality, security, and scalability.

## System Architecture
The frontend is built with React 18, TypeScript, Vite 5, shadcn/ui, Tailwind CSS 3, TanStack Query v5, wouter, and React Hook Form with Zod. The backend utilizes Node.js 20+, TypeScript, Express.js 4, and Prisma Client 6 with PostgreSQL 14+, following a Generic Service Layer with Role Adapters design.

**Key Architectural and Feature Highlights:**

*   **UI/UX Decisions**: Custom HSL color palette, Inter/Manrope typography, mobile-first responsive design, WCAG 2.1 AA compliance, Enterprise Admin Component Library, Dark/Light/System modes, accessibility features, and optimized touch targets.
*   **Security & Compliance**: Implements HTTP security headers, rate limiting, 2FA, device/session security, AES-256-GCM encryption, tamper-proof audit logs, account lockout, fraud detection, and regulatory compliance (e.g., NYC TLC).
*   **Financial Systems**: Comprehensive Wallet & Earnings, Tax & Fees, and Unified Payout systems, managing commissions, negative balances, multi-country taxes, and enterprise-grade payment/payout rails.
*   **Customer & Partner Onboarding**: Multi-step onboarding and country-specific KYC with real-time ID verification, background checks, and facial recognition.
*   **Service Offerings**: Supports Food Delivery, Ride-Hailing, and Parcel Delivery with features like restaurant management, multi-route fare engine, and dynamic pricing.
    *   **SafeGo Parcel System (BD)**: Comprehensive parcel delivery for Bangladesh with 4-zone domestic and 4-corridor international pricing, dynamic pricing (volumetric weight, speed tiers), and COD settlement.
    *   **Bangladesh Tax System**: Comprehensive VAT calculation (15% default) for all 6 SafeGo services in Bangladesh, configurable via Admin Panel.
*   **Delivery Driver Dashboard + Go-Online Engine**: Complete delivery driver management system:
    *   **Verification Status Badge**: pending (blocks go-online), approved (allows go-online), rejected (shows rejection reason)
    *   **Earnings Summary**: Today's earnings, weekly earnings, negative balance (commission owed), total earnings
    *   **Online/Offline Toggle**: Disabled until isVerified=true, triggers real-time location updates when enabled
    *   **Task Navigation Cards**: Food delivery tasks, parcel delivery tasks with pending/active counters
    *   **Notification Center**: Verification updates, new tasks, payout notifications
    *   **Go-Online Engine**: Status management (offline/available/busy), location broadcasting, matching pool registration for food and parcel delivery services
    *   **Backend API**: GET /driver/delivery/dashboard, POST /driver/delivery/go-online, POST /driver/delivery/go-offline, POST /driver/delivery/update-location
*   **Privacy & Consent Management System**: GDPR-compliant privacy management with consent tracking, policy versioning, configurable data retention, and user data deletion/export requests.
    *   **Post-Verification Enforcement**: Policy acceptance required ONLY after KYC/onboarding is complete and user is verified - unverified users can complete sign-up, onboarding, and KYC without being blocked. Admins are never blocked from Admin Panel.
*   **Loyalty & Incentives**: SafeGo Points System, Opportunity Bonus Management System, and Driver Incentive Engine.
*   **Real-Time & Optimization**: AI Marketplace Balancer, Real-Time Dispatch System (WebSocket-based), dynamic routing optimization, personalized push notifications, and Admin Notifications.
*   **Profit-Focused Automation Systems**: A suite of 32 services covering core automation, security, risk intelligence, experience optimization, and platform operations.
*   **Regional Expansion**: Supports specific roles and KYC for Bangladesh with Bangla UX.
*   **API Design**: Robust API endpoints with KYC enforcement, ownership validation, Zod schema validation, atomic transactions, and consistent error handling.
*   **Database Schema**: Utilizes UUID primary keys, indexed foreign keys, decimal types for monetary values.
*   **Role-Based Access Control (RBAC)**: Comprehensive 8-role admin system with granular permissions, emergency lockdown, and admin impersonation.
*   **Global Audit Engine**: Tamper-proof logging with hash chain verification and regulator export mode.
*   **Enterprise Administration**: Features such as Feature Flags, Enterprise Search, Data Export Center, Incident Response, Customer Support, Partner Compliance, System Health Monitor, and an Intelligence Dashboard. Includes advanced admin tools for monitoring, configuration, and compliance.
*   **Intelligence Layer**: Enhanced Intelligence Dashboard with service analytics, driver performance, customer satisfaction, fraud detection, platform health, and automated insights.
*   **Complaint Resolution Center**: SLA timer system, AI summary generation, and resolution workflow.
*   **Driver Violation Management**: Violation types, severity levels, point system, penalty management, and appeal processing.
*   **SafePilot Intelligence Engine**: Upgraded business automation engine with 8 intelligence modules (Growth, Cost Reduction, Fraud & Safety, Partner Success, Customer Retention, Marketing, Financial, Legal & Compliance).
    *   **SafePilot Master Upgrade (v2.0)**: Enterprise-grade intelligence features including One-Click Crisis Report, Explain This Decision Mode, Background Autonomous Monitoring, Company Survival Mode, and enhanced mobile responsiveness.
*   **Backup & Disaster Recovery**: Comprehensive backup management system with metadata tracking, retention settings, and restore operations.
*   **Policy & Safety Hub (SafeGo Master Tasks 1-15)**: Comprehensive policy management and safety system including:
    *   **Terms & Conditions System**: Version-controlled terms with country-specific support and activation workflow.
    *   **Refund & Cancellation Policies**: Service-specific and actor-based policies with fee configuration.
    *   **Community Guidelines & Code of Conduct**: Role-specific guidelines for customers and partners.
    *   **Safety Policy Management**: Platform-wide safety rules and procedures with version control.
    *   **Partner Agreement E-Signature**: Digital agreement signing with typed/drawn signature support.
    *   **Emergency SOS System**: One-touch emergency alerts with GPS location and emergency contact notification.
    *   **Safety Monitoring**: Real-time ride safety events (speeding, route deviation, harsh braking).
    *   **Audio Recording Sessions**: Encrypted ride audio recording for safety disputes.
    *   **Report System**: User-submitted reports with category-based classification and admin review workflow.
    *   **User Restrictions & Auto-Restriction**: Account status management with suspension/ban capabilities.
    *   **Safety Center**: Customer and driver safety tools including emergency contacts, trip sharing, and safety policies.
*   **Fraud Prevention Layer (SafeGo Master Tasks 16-22)**: Comprehensive fraud detection and prevention system including:
    *   **One-Account-Per-Device**: Device registration with multi-device detection and automatic flagging.
    *   **Device Fingerprinting**: Hashed device IDs, OS/model tracking, app version monitoring, and device whitelisting.
    *   **Fake GPS Detection**: Impossible movement detection (>5km in <5s), teleport pattern analysis, and GPS/IP mismatch alerts.
    *   **COD Fraud Protection**: Repeated cancellation detection, high-value monitoring, and location mismatch flagging.
    *   **Partner Manipulation Detection**: Self-ordering, order padding, fake delivery cycles, and acceptance-cancellation loop detection.
    *   **IP Anomaly Detection**: VPN/proxy detection, rapid country changes, datacenter IP flagging, and GPS/IP region mismatch.
    *   **Suspicious Behavior Scoring**: 0-100 fraud score with component scores (device, GPS, IP, COD, reports, cancellations, manipulation), auto-restriction at threshold, and manual clearance workflow.
    *   **Fraud Prevention Center**: Admin dashboard with events, scores, devices, settings, and whitelist management.
*   **Security Hardening Layer (SafeGo Master Tasks 29-36)**: Enterprise-grade security infrastructure including:
    *   **JWT Rotation System (Task 29)**: Rotating access tokens (15min) and refresh tokens (7 days) with token family tracking, reuse detection, automatic revocation on suspicious activity, and device-bound sessions.
    *   **OTP Rate Limiting (Task 30)**: Rate limiting for OTP requests (3/minute, 8/hour) with automatic 15-minute blocking on threshold violations.
    *   **Login Throttling (Task 31)**: Progressive login protection with 5-attempt cooldown (5 min), 10-attempt lockout (30 min), and device/IP correlation.
    *   **Suspicious Login Alerts (Task 32)**: Real-time detection of new devices, new countries, rapid IP changes, and high-risk locations with email/SMS notifications.
    *   **Device History System (Task 33)**: Comprehensive device tracking with first/last seen timestamps, login count, risk scoring, trusted device management, and user-controlled device removal.
    *   **Admin Audit Log Expansion (Task 34)**: Tamper-proof logging with SHA-256 hash chain verification, comprehensive action categories (login, user_management, kyc, payout, settings, fraud, settlement), severity levels, and regulator export support.
    *   **API Rate Limiting + Auto-Block (Task 35)**: Category-based rate limits (auth: 20/min, public: 60/min, partner: 40/min, admin: 100/min) with automatic blocking and admin override capabilities.
    *   **WAF Security Layer (Task 36)**: Web Application Firewall with detection rules for SQL injection, XSS, path traversal, command injection, bad user agents, and invalid headers. Threat scoring (0-100) with automatic blocking at threshold 50.
    *   **Security Center**: Admin dashboard with 6 tabs (Overview, JWT Tokens, Rate Limits, WAF Logs, Audit Logs, Devices) for comprehensive security monitoring and management.
*   **Data Rights & Retention Layer (SafeGo Master Tasks 43-47)**: GDPR-compliant data management including:
    *   **Data Export Automation (Task 43)**: User-initiated data export with background processing and downloadable archive.
    *   **Account Deletion with 72-Hour Delay (Task 44)**: GDPR-compliant deletion workflow with cancellation period and data anonymization.
    *   **Data Retention Engine (Task 45)**: Configurable retention policies with automated cleanup and compliance logging.
    *   **Policy Auto-Versioning (Task 46)**: Policy version management with publishing workflow and acceptance tracking.
    *   **Backup & Disaster Recovery (Task 47)**: System health monitoring, component status checks, and DR simulation.
    *   **Data Governance Center**: Admin dashboard with Overview, Exports, Deletions, Retention, and Policies tabs.
*   **Final Pre-Launch System Readiness Layer (SafeGo Master Tasks 48-51)**: Comprehensive system validation including:
    *   **Payment Gateway Health Check (Task 48)**: Periodic health checks for bKash, Nagad, and Stripe with credential validation, response time monitoring, and error rate tracking.
    *   **Notification System Health Check (Task 49)**: SMS (Twilio), Email (SMTP), and Push (FCM) service monitoring with queue depth tracking and auto-alerts on 5+ consecutive failures.
    *   **Map Service Health & Load Testing (Task 50)**: Google Maps API monitoring (geocoding, directions, autocomplete) with 100-request load tests and degradation detection at >2s latency.
    *   **UAT Pass + Launch Readiness Certificate (Task 51)**: Comprehensive 38-item UAT checklist covering KYC, ride booking, delivery, food ordering, partner onboarding, finance, fraud, security, notifications, ratings, and data export. Category sign-off workflow with Launch Readiness Certificate generation only when ALL tests pass.
    *   **System Health Center**: Admin dashboard with 4 tabs (Overview, Payment Gateways, Notifications, Map Services) showing real-time health indicators.
    *   **Launch Readiness Center**: Admin dashboard with UAT report management, checklist testing, category sign-offs, and certificate generation.

## External Dependencies

*   **Backend Core**: `@prisma/client`, `express`, `bcrypt`, `jsonwebtoken`, `@neondatabase/serverless`.
*   **Frontend Core**: `react`, `react-dom`, `wouter`, `@tanstack/react-query`, `react-hook-form`, `zod`.
*   **UI Components**: `@radix-ui/*`, `lucide-react`, `class-variance-authority`, `tailwind-merge`, `clsx`.
*   **Third-party Services**: Twilio (SMS OTP), AgentMail (Email OTP), Stripe (payment gateway), Google Maps Platform (Maps JavaScript API, Places API, Directions API, Geocoding API), bKash, Nagad, Checkr, AWS Rekognition, Persona/Onfido.