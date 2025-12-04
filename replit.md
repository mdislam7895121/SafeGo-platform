# SafeGo Global Super-App

## Overview
SafeGo is a production-ready, full-stack multi-service super-app platform designed for global on-demand services such as ride-hailing, food delivery, and parcel delivery. Its purpose is to capture a significant market share by offering a scalable, secure, and feature-rich solution. Key capabilities include multi-role authentication, country-specific KYC, commission tracking, service lifecycle management, unified payment/payout systems, and comprehensive driver identity management.

## User Preferences
Preferred communication style: Simple, everyday language.
Development approach: Full-stack TypeScript with modern tooling, emphasizing code quality, security, and scalability.

## System Architecture
The frontend is built with React 18, TypeScript, Vite 5, shadcn/ui, Tailwind CSS 3, TanStack Query v5, wouter, and React Hook Form with Zod, incorporating a custom HSL color palette, Inter/Manrope typography, mobile-first responsive design, and WCAG 2.1 AA compliance. The backend uses Node.js 20+, TypeScript, Express.js 4, and Prisma Client 6 with PostgreSQL 14+, employing a Generic Service Layer with Role Adapters.

**Key Architectural and Feature Highlights:**

*   **Admin Capabilities**: Interactive panel for dashboards, document management, wallet settlement, and global analytics.
*   **Security & Compliance**: Implements HTTP security headers, rate limiting, 2FA, device/session security, AES-256-GCM encryption, tamper-proof audit logs, Customer Account Lockout, phone masking, proxy calling, enhanced SOS, route deviation detection, device binding, admin 2FA, IP whitelisting, activity monitoring, developer access control with mTLS, and payout audit trails.
*   **Financial Systems**: Comprehensive Wallet & Earnings, Tax & Fees, and Unified Payout systems, managing commissions, negative balances, multi-country taxes, and enterprise-grade payment/payout rails.
*   **Customer & Partner Onboarding**: Features Uber-level profiles, multi-step onboarding, country-specific KYC, real-time ID verification, background checks, and facial recognition.
*   **Service Offerings**:
    *   **Food Delivery**: Includes Restaurant Management Systems, a Unified Eats Experience, and Driver Food Delivery Flow.
    *   **Ride-Hailing**: Provides Rider Ride-Booking Flow (map integration, real-time tracking), Multi-Route Fare Engine, Multi-Category Vehicle System, and Driver Active Ride Workflow.
    *   **Parcel Delivery**: Supports scheduled pickup, Proof-of-Delivery photos, and size/weight-based dynamic pricing.
*   **Loyalty & Incentives**: Integrates a SafeGo Points System, Opportunity Bonus Management System, and Driver Incentive Engine.
*   **Real-Time & Optimization**: Features an AI Marketplace Balancer, Real-Time Dispatch System (WebSocket-based, proximity matching), and Experience Intelligence with real-time ETA refinement, dynamic routing optimization, and smart personalized push notifications.
*   **Profit-Focused Automation Systems**: A suite of 32 services with comprehensive admin visibility, covering:
    *   **Core Automation**: Auto Assignment Engine, Surge Pricing Automation, Auto Settlement Service, Recommendation Engine, Dynamic Pricing Service, Performance Scoring Service, Auto Cancellation Service, and Auto Payout Service.
    *   **Security & Fraud Prevention**: Fraud Detection Automation, Login Security Automation, High Risk Activity Automation, Customer Abuse Automation, Partner Fraud Automation, Customer Payment Scoring, and Partner Risk Monitoring.
    *   **Risk Intelligence**: Order Success Prediction, Driver Fatigue Detection, Demand Sensing, and Traffic ETA Correction.
    *   **Experience Optimization**: Inventory Forecasting, Repeat Purchase Trigger, Negative Review Recovery, Seasonal Intelligence, Refund Optimization, and Marketing Budget Optimization.
    *   **Platform Operations**: Server Scaling Automation, DevOps Deployment Pipeline, Employee Productivity Dashboard, and System Monitoring Automation.
*   **Regional Expansion**: Supports specific roles and KYC requirements for Bangladesh (SafeGo Shop Partner, SafeGo Ticket & Rental Operator) with Bangla UX and error messages.
*   **Regulatory Compliance**: Adheres to NYC TLC regulatory compliance including minimum pay enforcement, fees, surcharges, tolls, and report generation.
*   **API Design**: Robust API endpoints with enforcement of KYC, ownership validation, Zod schema validation, atomic transactions, and consistent error handling.
*   **Database Schema**: Utilizes UUID primary keys, indexed foreign keys, decimal types for monetary values, and comprehensive models for all core features and settings.

## External Dependencies

*   **Backend Core**: `@prisma/client`, `express`, `bcrypt`, `jsonwebtoken`, `@neondatabase/serverless`.
*   **Frontend Core**: `react`, `react-dom`, `wouter`, `@tanstack/react-query`, `react-hook-form`, `zod`.
*   **UI Components**: `@radix-ui/*`, `lucide-react`, `class-variance-authority`, `tailwind-merge`, `clsx`.
*   **Third-party Services**: Twilio (SMS OTP), AgentMail (Email OTP), Stripe (payment gateway), Google Maps Platform (Maps JavaScript API, Places API, Directions API, Geocoding API), bKash, Nagad, Checkr, AWS Rekognition, Persona/Onfido.