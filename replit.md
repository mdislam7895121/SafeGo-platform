# SafeGo Global Super-App

## Overview
SafeGo is a production-ready, full-stack multi-service super-app platform designed for global on-demand services like ride-hailing, food delivery, and parcel delivery. Its primary purpose is to capture significant market share by offering a scalable, secure, and feature-rich solution. Key capabilities include multi-role authentication, country-specific KYC, commission tracking, service lifecycle management, unified payment/payout systems, comprehensive driver identity management, and advanced automation for profit optimization and risk intelligence. The project aims to provide a robust and versatile platform capable of rapid regional expansion and compliance with global regulatory standards.

## User Preferences
Preferred communication style: Simple, everyday language.
Development approach: Full-stack TypeScript with modern tooling, emphasizing code quality, security, and scalability.

## System Architecture
The system employs a full-stack TypeScript approach. The frontend is built with React 18, Vite 5, shadcn/ui, Tailwind CSS 3, TanStack Query v5, wouter, and React Hook Form with Zod. The backend utilizes Node.js 20+, Express.js 4, and Prisma Client 6 with PostgreSQL 14+, following a Generic Service Layer with Role Adapters design pattern.

**Key Architectural and Feature Highlights:**

*   **UI/UX Decisions**: Features a custom HSL color palette, Inter/Manrope typography, mobile-first responsive design, WCAG 2.1 AA compliance, an Enterprise Admin Component Library, Dark/Light/System modes, and accessibility features.
*   **Security & Compliance**: Implements robust security measures including HTTP security headers, rate limiting, 2FA, device/session security, AES-256-GCM encryption, tamper-proof audit logs, account lockout, fraud detection, regulatory compliance, JWT rotation, OTP rate limiting, login throttling, suspicious login alerts, device history tracking, expanded admin audit logs, API rate limiting with auto-block, and a WAF security layer.
*   **Financial Systems**: Manages comprehensive Wallet & Earnings, Tax & Fees, and Unified Payout systems, handling commissions, negative balances, multi-country taxes, and enterprise-grade payment/payout rails. Includes a comprehensive Admin Finance Dashboard for monitoring and settlement.
*   **Customer & Partner Onboarding**: Features multi-step onboarding and country-specific KYC with real-time ID verification, background checks, and facial recognition.
*   **Unified Partner Verification Engine**: A shared module providing canonical verification states and consistent logic across all partner types (drivers, restaurants).
*   **Service Offerings**: Supports Food Delivery, Ride-Hailing, and Parcel Delivery with features like restaurant management, multi-route fare engine, dynamic pricing, and a comprehensive parcel system for Bangladesh.
*   **Driver Management**: Includes a Delivery Driver Dashboard with verification status, earnings summary, online/offline toggle, task navigation, and a Live Assignment System for universal task matching.
*   **Privacy & Consent Management**: GDPR-compliant system with consent tracking, policy versioning, configurable data retention, user data deletion/export requests, and policy auto-versioning.
*   **Loyalty & Incentives**: Features a SafeGo Points System, Opportunity Bonus Management System, and a Driver Incentive Engine.
*   **Real-Time & Optimization**: Leverages an AI Marketplace Balancer, Real-Time Dispatch System (WebSocket-based), dynamic routing optimization, personalized push notifications, and Admin Notifications.
*   **Profit-Focused Automation Systems**: A suite of 32 services covering core automation, security, risk intelligence, experience optimization, and platform operations.
*   **API Design**: Robust API endpoints with KYC enforcement, ownership validation, Zod schema validation, atomic transactions, and consistent error handling.
*   **Database Schema**: Uses UUID primary keys, indexed foreign keys, and decimal types for monetary values.
*   **Role-Based Access Control (RBAC)**: A comprehensive 8-role admin system with granular permissions, emergency lockdown, and admin impersonation.
*   **Global Audit Engine**: Tamper-proof logging with hash chain verification and regulator export mode.
*   **Enterprise Administration**: Features Feature Flags, Enterprise Search, Data Export Center, Incident Response, Customer Support, Partner Compliance, System Health Monitor, and an Intelligence Dashboard with 8 intelligence modules (SafePilot Intelligence Engine). Includes a Notification Center, Theme System, Feature Flags, People & KYC Center, and Safety & Risk Center.
*   **Complaint Resolution Center**: Includes an SLA timer system, AI summary generation, and resolution workflow.
*   **Policy & Safety Hub**: Comprehensive policy management, Partner Agreement E-Signature, Emergency SOS System, Safety Monitoring, user Report System, User Restrictions & Auto-Restriction, and a Safety Center.
*   **Fraud Prevention Layer**: Includes One-Account-Per-Device, Device Fingerprinting, Fake GPS Detection, COD Fraud Protection, Partner Manipulation Detection, IP Anomaly Detection, and Suspicious Behavior Scoring with an associated Fraud Prevention Center.
*   **Final Pre-Launch Systems**: Includes health checks for Payment Gateways, Notification Systems, and Map Services, along with a comprehensive UAT Pass + Launch Readiness Certificate process.

## External Dependencies

*   **Backend Core**: `@prisma/client`, `express`, `bcrypt`, `jsonwebtoken`, `@neondatabase/serverless`.
*   **Frontend Core**: `react`, `react-dom`, `wouter`, `@tanstack/react-query`, `react-hook-form`, `zod`.
*   **UI Components**: `@radix-ui/*`, `lucide-react`, `class-variance-authority`, `tailwind-merge`, `clsx`.
*   **Third-party Services**: Twilio (SMS OTP), AgentMail (Email OTP), Stripe (payment gateway - US), SSLCOMMERZ (payment gateway - Bangladesh), Google Maps Platform (Maps JavaScript API, Places API, Directions API, Geocoding API), bKash, Nagad, Checkr, AWS Rekognition, Persona/Onfido.

## Google Maps Configuration

The customer ride booking flow uses Google Maps for crisp map tiles and route visualization.

**Required Google APIs** (enable in Google Cloud Console):
- Maps JavaScript API
- Places API (for address autocomplete)
- Directions API (for route polyline)
- Geocoding API (for reverse geocoding)

**Environment Setup**:
- Set `GOOGLE_MAPS_API_KEY` secret in Replit Secrets panel
- The API key is served via `/api/maps/config` endpoint
- Fallback UI displays when API key is missing or unavailable

**Map Component**: `client/src/components/maps/GoogleMapsRideBooking.tsx`
- Dual-stroke route polyline (7px white outline, 4px #1DA1F2 blue)
- Green pickup marker, red dropoff marker
- Auto-fits bounds to include markers and route