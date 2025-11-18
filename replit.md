# SafeGo Global Super-App

## Overview

SafeGo is a global multi-service super-app platform that provides ride-hailing, food delivery, and parcel delivery services across multiple countries. The application supports four distinct user roles (customer, driver, restaurant, admin) with country-specific KYC requirements for Bangladesh and the United States. Built as a full-stack TypeScript application, it features a React frontend with shadcn/ui components and an Express backend with Prisma ORM for database management.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:**
- **Framework:** React with TypeScript, using Vite as the build tool
- **UI Library:** shadcn/ui components built on Radix UI primitives
- **Styling:** Tailwind CSS with custom design system based on "new-york" style
- **State Management:** TanStack Query (React Query) for server state
- **Routing:** wouter for lightweight client-side routing
- **Form Handling:** React Hook Form with Zod validation via @hookform/resolvers

**Design System:**
- Custom color palette with HSL-based theming supporting light/dark modes
- Typography system using Inter (primary) and Manrope (secondary) fonts
- Spacing scale following Tailwind convention (2, 3, 4, 6, 8, 12, 16, 24)
- Component variants for buttons, cards, badges with elevation effects
- Mobile-first responsive design with specific breakpoints

**Architecture Pattern:**
- Component-based architecture with reusable UI primitives
- Centralized API client with credential-based authentication
- Role-specific interfaces (customer app, driver panel, restaurant panel, admin dashboard)
- Reference-based design drawing from Uber, DoorDash, and Material Design patterns

### Backend Architecture

**Technology Stack:**
- **Runtime:** Node.js with TypeScript (ESM modules)
- **Framework:** Express.js for REST API
- **ORM:** Prisma Client (with migration to Drizzle ORM in progress via drizzle.config.ts)
- **Authentication:** JWT-based with bcrypt for password hashing
- **Database:** PostgreSQL via Neon serverless driver

**Core Features:**
1. **Multi-Role Authentication System**
   - Four distinct roles: customer, driver, restaurant, admin
   - JWT token-based authentication with role-based access control (RBAC)
   - Custom middleware for token verification and role checking
   - Country-specific registration flows (BD vs US)

2. **Country-Specific KYC System**
   - Bangladesh: Requires NID (National ID), father's name, addresses, emergency contacts
   - United States: Requires government ID, SSN last 4 digits, driver's license for drivers
   - Verification status tracking (pending, approved, rejected)
   - Admin approval workflow for KYC documents

3. **Service Management**
   - Ride-hailing service with vehicle management and driver stats
   - Food delivery with restaurant profiles and order management
   - Parcel delivery system
   - Status flow tracking for all service types

4. **Wallet & Commission System**
   - Separate wallets for drivers and restaurants
   - Commission tracking and balance management
   - Support for negative balances

5. **Notification System**
   - User notifications for service updates
   - Event-driven notification creation

**API Structure:**
- `/api/auth/*` - Authentication endpoints (signup, login)
- `/api/driver/*` - Driver-specific operations (dashboard, profile)
- `/api/admin/*` - Admin operations (KYC approval, user management)
- RESTful conventions with JSON request/response bodies

**Security Architecture:**
- JWT secret stored in environment variables (defaults provided for development)
- Password hashing using bcrypt with salt rounds
- Request body parsing with raw body preservation for webhook verification
- Role-based middleware chain for protected routes

**Database Schema Design:**
- User management tables with role-based profiles (DriverProfile, CustomerProfile, RestaurantProfile, AdminProfile)
- Service tables (Ride, FoodOrder, Delivery) with status tracking
- Supporting tables for vehicles, wallets, statistics, and notifications
- Country-code based data separation within profiles

### Build & Development

**Development Workflow:**
- `npm run dev` - Development server with tsx for TypeScript execution
- `npm run build` - Production build using Vite for frontend and esbuild for backend
- `npm run db:push` - Database schema synchronization via Drizzle Kit
- Hot module replacement enabled via Vite for frontend development

**Project Structure:**
- `/client` - Frontend React application
  - `/src/components/ui` - shadcn/ui component library
  - `/src/pages` - Route components
  - `/src/lib` - Utilities and query client
  - `/src/hooks` - Custom React hooks
- `/server` - Backend Express application
  - `/routes` - API route handlers
  - `/middleware` - Authentication and authorization
- `/shared` - Shared types and schemas (Drizzle schema definitions)
- `/migrations` - Database migration files (Drizzle)

**Migration Status:**
The project is transitioning from Prisma to Drizzle ORM:
- Prisma Client still in dependencies and used in route handlers
- Drizzle configuration present with schema in `/shared/schema.ts`
- Current schema only contains basic user table; full schema migration pending

## External Dependencies

### Database
- **PostgreSQL** via Neon serverless (@neondatabase/serverless)
- Connection managed through DATABASE_URL environment variable
- ORM: Transitioning from Prisma (@prisma/client v6.19.0) to Drizzle ORM

### Authentication & Security
- **jsonwebtoken** - JWT token generation and verification
- **bcrypt** v6.0.0 - Password hashing and comparison

### UI Component Libraries
- **Radix UI** - Headless component primitives for all interactive components
- **shadcn/ui** - Pre-built accessible components (accordion, dialog, dropdown, etc.)
- **Lucide React** - Icon library
- **class-variance-authority** - Component variant management
- **tailwind-merge** & **clsx** - CSS class merging utilities

### Form & Validation
- **React Hook Form** - Form state management
- **Zod** - Schema validation
- **@hookform/resolvers** - Integration between React Hook Form and Zod

### Development Tools
- **Vite** - Frontend build tool with React plugin
- **tsx** - TypeScript execution for development
- **esbuild** - Backend bundling for production
- **TypeScript** - Type checking and compilation
- **Replit-specific plugins** - Runtime error overlay, cartographer, dev banner

### Fonts
- **Google Fonts** - Inter and Manrope font families loaded via CDN

### Environment Variables Required
- `DATABASE_URL` - PostgreSQL connection string (required)
- `JWT_SECRET` - Secret key for JWT signing (defaults to "safego-secret-key-change-in-production")
- `NODE_ENV` - Environment designation (development/production)