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

## External Dependencies

*   **Backend Core**: `@prisma/client`, `express`, `bcrypt`, `jsonwebtoken`, `@neondatabase/serverless`.
*   **Frontend Core**: `react`, `react-dom`, `wouter`, `@tanstack/react-query`, `react-hook-form`, `zod`.
*   **UI Components**: `@radix-ui/*`, `lucide-react`, `class-variance-authority`, `tailwind-merge`, `clsx`.
*   **Third-party Services**: Twilio (SMS OTP), AgentMail (Email OTP), Stripe (payment gateway), Google Maps Platform (Maps JavaScript API, Places API, Directions API, Geocoding API), bKash, Nagad, Checkr, AWS Rekognition, Persona/Onfido.