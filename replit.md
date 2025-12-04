# SafeGo Global Super-App

## Overview
SafeGo is a production-ready, full-stack multi-service super-app platform offering global on-demand services such as ride-hailing, food delivery, and parcel delivery. The platform aims to capture a significant market share by providing a scalable, secure, and feature-rich solution that includes multi-role authentication, country-specific KYC, commission tracking, service lifecycle management, unified payment/payout systems, and comprehensive driver identity management.

## User Preferences
Preferred communication style: Simple, everyday language.
Development approach: Full-stack TypeScript with modern tooling, emphasizing code quality, security, and scalability.

## System Architecture
The frontend is built with React 18, TypeScript, Vite 5, shadcn/ui, Tailwind CSS 3, TanStack Query v5, wouter, and React Hook Form with Zod. It features a custom HSL color palette, Inter/Manrope typography, mobile-first responsive design, and WCAG 2.1 AA compliance. The backend utilizes Node.js 20+, TypeScript, Express.js 4, and Prisma Client 6 with PostgreSQL 14+, following a Generic Service Layer with Role Adapters design.

**Key Architectural and Feature Highlights:**

*   **UI/UX Decisions**: Custom HSL color palette, Inter/Manrope typography, mobile-first responsive design, WCAG 2.1 AA compliance, and an Enterprise Admin Component Library. Supports Dark/Light/System modes, accessibility modes (high-contrast, reduced-motion, large-text), responsive typography, and optimized touch targets.
*   **Security & Compliance**: Implements HTTP security headers, rate limiting, 2FA, device/session security, AES-256-GCM encryption, tamper-proof audit logs, account lockout, phone masking, proxy calling, enhanced SOS, route deviation detection, device binding, admin 2FA, IP whitelisting, activity monitoring, developer access control with mTLS, payout audit trails, and NYC TLC regulatory compliance. Includes fraud detection dashboard, session security management, and emergency controls.
*   **Financial Systems**: Comprehensive Wallet & Earnings, Tax & Fees, and Unified Payout systems, managing commissions, negative balances, multi-country taxes, and enterprise-grade payment/payout rails. Includes a payment verification console.
*   **Customer & Partner Onboarding**: Features multi-step onboarding and country-specific KYC with real-time ID verification, background checks, facial recognition, and a multi-stage review queue.
*   **Service Offerings**: Supports Food Delivery (Restaurant Management, Unified Eats, Driver Flow), Ride-Hailing (Rider Booking, Multi-Route Fare Engine, Multi-Category Vehicle System, Driver Workflow), and Parcel Delivery (scheduled pickup, Proof-of-Delivery, dynamic pricing).
*   **Loyalty & Incentives**: SafeGo Points System, Opportunity Bonus Management System, and Driver Incentive Engine.
*   **Real-Time & Optimization**: AI Marketplace Balancer, Real-Time Dispatch System (WebSocket-based, proximity matching), Experience Intelligence with real-time ETA refinement, dynamic routing optimization, personalized push notifications, and Admin Notifications WebSocket.
*   **Profit-Focused Automation Systems**: A suite of 32 services covering core automation (e.g., Auto Assignment, Surge Pricing), security & fraud prevention, risk intelligence (e.g., Driver Fatigue Detection), experience optimization, and platform operations.
*   **Regional Expansion**: Supports specific roles and KYC for Bangladesh with Bangla UX.
*   **API Design**: Robust API endpoints with enforcement of KYC, ownership validation, Zod schema validation, atomic transactions, and consistent error handling.
*   **Database Schema**: Utilizes UUID primary keys, indexed foreign keys, decimal types for monetary values, and comprehensive models.
*   **Role-Based Access Control (RBAC)**: Comprehensive 8-role admin system with granular permissions, permission bundles, emergency lockdown controls, admin impersonation mode, and secure internal messaging. Includes role visualization and permission matrix.
*   **Global Audit Engine**: Tamper-proof logging with hash chain verification, evidence packets, and regulator export mode, with an expanded full audit console.
*   **Enterprise Administration**: Features such as Feature Flags Management, Enterprise Search Engine, Data Export Center, Incident Response Playbook, Customer Support Panel, Partner Compliance Center, System Health Monitor, Push Notifications, Policy Manager, Backup & Recovery, and an Intelligence Dashboard with service analytics, driver performance, customer satisfaction, and automated insights.

## External Dependencies

*   **Backend Core**: `@prisma/client`, `express`, `bcrypt`, `jsonwebtoken`, `@neondatabase/serverless`.
*   **Frontend Core**: `react`, `react-dom`, `wouter`, `@tanstack/react-query`, `react-hook-form`, `zod`.
*   **UI Components**: `@radix-ui/*`, `lucide-react`, `class-variance-authority`, `tailwind-merge`, `clsx`.
*   **Third-party Services**: Twilio (SMS OTP), AgentMail (Email OTP), Stripe (payment gateway), Google Maps Platform (Maps JavaScript API, Places API, Directions API, Geocoding API), bKash, Nagad, Checkr, AWS Rekognition, Persona/Onfido.