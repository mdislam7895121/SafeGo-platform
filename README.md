# SafeGo - Global Super-App Platform

<div align="center">

**A comprehensive multi-service platform providing ride-hailing, food delivery, and parcel delivery services across multiple countries**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-blue)](https://reactjs.org/)
[![Express](https://img.shields.io/badge/Express-4-green)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-6-brightgreen)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14-blue)](https://www.postgresql.org/)

</div>

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Documentation](#documentation)
- [Demo Accounts](#demo-accounts)
- [Project Structure](#project-structure)
- [License](#license)

---

## 🌟 Overview

SafeGo is a full-stack super-app platform inspired by Uber, DoorDash, and Grab, providing three core services:

1. **🚗 Ride-Hailing** - Book rides with verified drivers
2. **🍔 Food Delivery** - Order from restaurants with real-time tracking
3. **📦 Parcel Delivery** - Send packages across the city

The platform supports **four distinct user roles** with country-specific KYC requirements for Bangladesh and the United States.

---

## ✨ Features

### Multi-Role System
- **Customer**: Request rides, order food, send parcels
- **Driver**: Accept jobs, manage earnings, track wallet balance
- **Restaurant**: Manage menu, process orders, view commissions
- **Admin**: Approve KYC, manage users, handle wallet settlements

### Country-Specific KYC
- **Bangladesh**: NID verification, father's name, dual addresses
- **United States**: Government ID, SSN last 4 digits, driver's license

### Commission & Wallet System
- Automated commission calculation (20% platform fee)
- Real-time wallet balance tracking
- Negative balance support for restaurants
- Admin wallet settlement interface

### Status Flow Management
Complete lifecycle tracking for:
- Ride requests: requested → accepted → in_progress → completed
- Food orders: pending → accepted → preparing → ready → delivering → delivered
- Parcel deliveries: requested → accepted → picked_up → in_transit → delivered

---

## 🛠️ Tech Stack

### Frontend
- **React 18** with TypeScript
- **Wouter** for client-side routing
- **TanStack Query** for server state management
- **shadcn/ui** components (Radix UI primitives)
- **Tailwind CSS** for styling
- **Vite** as build tool

### Backend
- **Node.js** with TypeScript
- **Express.js** REST API
- **Prisma ORM** for database management
- **PostgreSQL** database (Neon)
- **JWT** authentication with bcrypt
- **Role-based access control (RBAC)**

### Development
- **ESM modules** throughout
- **tsx** for TypeScript execution
- **esbuild** for production builds
- Hot module replacement (HMR) in development

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+ installed
- PostgreSQL database (local or cloud)
- npm or yarn package manager

### Installation

1. **Clone the repository**
```bash
# Replace YOUR_USERNAME with your GitHub username
git clone https://github.com/YOUR_USERNAME/safego.git
cd safego
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env
```

Edit `.env` with your database credentials:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/safego"
JWT_SECRET="your-secret-key-change-in-production"
NODE_ENV="development"
```

4. **Initialize database**
```bash
# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# (Optional) Seed demo data
tsx scripts/seed.ts
```

5. **Start development server**
```bash
npm run dev
```

The application will be available at:
- **Frontend & Backend**: http://localhost:5000
- **API Base**: http://localhost:5000/api

> **Note:** This project uses Prisma ORM. Use `npx prisma` commands directly (e.g., `npx prisma db push`, `npx prisma generate`) rather than the npm scripts. The `db:push` script in package.json references legacy Drizzle configuration.

---

## 📚 Documentation

Comprehensive guides are available:

- [**SETUP.md**](./SETUP.md) - Detailed installation and configuration
- [**API_DOCUMENTATION.md**](./API_DOCUMENTATION.md) - Complete API reference
- [**DATABASE_SCHEMA.md**](./DATABASE_SCHEMA.md) - Database structure and relationships
- [**DEPLOYMENT.md**](./DEPLOYMENT.md) - Production deployment guide
- [**DEMO_ACCOUNTS.md**](./DEMO_ACCOUNTS.md) - Test credentials and workflows

---

## 🔐 Demo Accounts

For testing, use these pre-configured accounts (password: `demo123`):

| Role       | Country    | Email                    |
|------------|------------|--------------------------|
| Customer   | Bangladesh | customer.bd@demo.com     |
| Customer   | USA        | customer.us@demo.com     |
| Driver     | Bangladesh | driver.bd@demo.com       |
| Driver     | USA        | driver.us@demo.com       |
| Restaurant | Bangladesh | restaurant.bd@demo.com   |
| Restaurant | USA        | restaurant.us@demo.com   |
| Admin      | USA        | admin@demo.com           |

See [DEMO_ACCOUNTS.md](./DEMO_ACCOUNTS.md) for detailed test workflows.

---

## 📁 Project Structure

```
safego/
├── client/                 # React frontend application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   │   └── ui/        # shadcn/ui component library
│   │   ├── contexts/      # React contexts (Auth, Theme)
│   │   ├── hooks/         # Custom React hooks
│   │   ├── lib/           # Utility functions and query client
│   │   ├── pages/         # Route components by role
│   │   │   ├── admin/     # Admin panel pages
│   │   │   ├── customer/  # Customer app pages
│   │   │   ├── driver/    # Driver panel pages
│   │   │   └── restaurant/# Restaurant panel pages
│   │   └── App.tsx        # Root component with routing
│   └── index.html
├── server/                 # Express backend application
│   ├── routes/            # API route handlers
│   │   ├── auth.ts        # Authentication endpoints
│   │   ├── customer.ts    # Customer operations
│   │   ├── driver.ts      # Driver operations
│   │   ├── restaurant.ts  # Restaurant operations
│   │   ├── admin.ts       # Admin operations
│   │   ├── rides.ts       # Ride service
│   │   ├── food-orders.ts # Food delivery service
│   │   └── deliveries.ts  # Parcel delivery service
│   ├── middleware/        # Auth and RBAC middleware
│   ├── index.ts           # Server entry point
│   ├── routes.ts          # Route registration
│   └── vite.ts            # Vite integration
├── prisma/
│   └── schema.prisma      # Database schema definition
├── attached_assets/        # Static assets
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
├── tailwind.config.ts     # Tailwind CSS configuration
├── vite.config.ts         # Vite configuration
└── README.md              # This file
```

---

## 🔑 Key Concepts

### Authentication Flow
1. User signs up with email, password, role, and country
2. Role-specific profile is created automatically
3. JWT token issued on login (7-day expiration)
4. Token validated on each protected API request

### Commission Model
**Rides & Deliveries**: 20% platform commission
- SafeGo: 20%
- Driver: 80%

**Food Orders**: 20% total commission
- SafeGo: 20% (15% from restaurant + 5% from delivery)
- Restaurant: 75% of order value
- Driver: 5% delivery fee

### Wallet System
- Drivers earn from completed jobs (positive balance)
- Restaurants owe commission fees (negative balance)
- Admin can settle wallets to reset balances

---

## 🧪 Testing

Run end-to-end tests:
```bash
npm run test
```

Manual testing checklist:
1. Sign up as each role (customer, driver, restaurant)
2. Complete KYC verification (admin approval)
3. Test service flows (ride request, food order, parcel delivery)
4. Verify wallet balance updates
5. Test cross-role interactions

---

## 🚢 Production Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions on deploying to:
- Heroku
- Vercel
- Railway
- DigitalOcean
- AWS

Key considerations:
- Set `NODE_ENV=production`
- Use secure `JWT_SECRET`
- Configure PostgreSQL connection pooling
- Enable HTTPS/SSL
- Set up error monitoring (Sentry)

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 🙏 Acknowledgments

- Design inspiration: Uber, DoorDash, Grab
- UI Components: [shadcn/ui](https://ui.shadcn.com/)
- Icons: [Lucide React](https://lucide.dev/)
- Database: [Neon PostgreSQL](https://neon.tech/)

---

## 📧 Support

For questions or issues:
- Open an issue on GitHub
- Email: support@safego.com
- Documentation: [Full Docs](./SETUP.md)

---

<div align="center">

**Built with ❤️ using TypeScript, React, and Express**

</div>
