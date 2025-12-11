# SafeGo Setup Guide

Complete installation and configuration guide for the SafeGo platform.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Database Setup](#database-setup)
4. [Environment Configuration](#environment-configuration)
5. [Running the Application](#running-the-application)
6. [Seeding Demo Data](#seeding-demo-data)
7. [Development Workflow](#development-workflow)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

- **Node.js**: Version 20.x or higher
- **npm**: Version 10.x or higher (comes with Node.js)
- **PostgreSQL**: Version 14+ (local or cloud-hosted)
- **Git**: For version control

### Recommended Tools

- **VS Code**: With TypeScript and Prisma extensions
- **Postman**: For API testing
- **pgAdmin** or **TablePlus**: For database management

---

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/safego.git
cd safego
```

### 2. Install Dependencies

```bash
npm install
```

This will install all required packages for both frontend and backend:
- React, TypeScript, Vite (frontend)
- Express, Prisma, bcrypt, JWT (backend)
- shadcn/ui components
- Development tools

### 3. Verify Installation

```bash
node --version  # Should be v20.x or higher
npm --version   # Should be v10.x or higher
```

---

## Database Setup

### Option 1: Local PostgreSQL

#### Install PostgreSQL

**macOS (Homebrew):**
```bash
brew install postgresql@14
brew services start postgresql@14
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**Windows:**
Download and install from [postgresql.org](https://www.postgresql.org/download/windows/)

#### Create Database

```bash
# Access PostgreSQL
psql postgres

# Create database and user
CREATE DATABASE safego;
CREATE USER safego_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE safego TO safego_user;

# Exit psql
\q
```

### Option 2: Cloud PostgreSQL (Recommended for Production)

#### Neon (Serverless PostgreSQL)
1. Sign up at [neon.tech](https://neon.tech)
2. Create a new project
3. Copy the connection string

#### Railway
1. Sign up at [railway.app](https://railway.app)
2. Create new PostgreSQL database
3. Copy the connection string

#### Supabase
1. Sign up at [supabase.com](https://supabase.com)
2. Create new project
3. Get connection string from Settings → Database

---

## Environment Configuration

### 1. Create Environment File

```bash
cp .env.example .env
```

### 2. Configure Environment Variables

Edit `.env` with your settings:

```env
# Database Configuration
DATABASE_URL="postgresql://user:password@localhost:5432/safego"

# JWT Configuration
JWT_SECRET="your-super-secret-jwt-key-change-in-production"

# Node Environment
NODE_ENV="development"

# Server Port (optional, defaults to 5000)
PORT=5000
```

#### Environment Variables Explained

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | Secret key for JWT token signing | `your-256-bit-secret-key` |
| `NODE_ENV` | Environment mode | `development` or `production` |
| `PORT` | Server port (optional) | `5000` (default) |

### 3. Generate Strong JWT Secret

```bash
# Generate a random secret (Linux/macOS)
openssl rand -base64 32

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## Running the Application

### 1. Initialize Prisma

Generate Prisma Client and push schema to database:

```bash
# Generate Prisma Client
npx prisma generate

# Push schema to database (creates all tables)
npx prisma db push

# If you get data loss warnings, force push
npx prisma db push --force
```

### 2. Start Development Server

```bash
npm run dev
```

This starts:
- **Backend API** on port 5000
- **Frontend** with hot module replacement
- **Vite dev server** integrated with Express

The application will be available at:
```
http://localhost:5000
```

### 3. Verify Application is Running

Open your browser and navigate to `http://localhost:5000`. You should see the SafeGo homepage.

Check API health:
```bash
curl http://localhost:5000/api/health
```

---

## Seeding Demo Data

### Automatic Seeding (Recommended)

Run the seed script to create demo accounts for all roles:

```bash
tsx scripts/seed.ts
```

This creates:
- 2 customers (BD & US)
- 2 drivers (BD & US)
- 2 restaurants (BD & US)
- 1 admin

All accounts use password: `demo123`

### Manual Database Inspection

View created users:

```bash
# Using Prisma Studio
npx prisma studio

# Using psql
psql $DATABASE_URL -c "SELECT email, role, \"countryCode\" FROM \"User\";"
```

---

## Development Workflow

### Project Structure

```
safego/
├── client/           # React frontend
│   ├── src/
│   │   ├── pages/   # Route components
│   │   ├── components/ # Reusable components
│   │   └── contexts/   # Auth & Theme contexts
├── server/          # Express backend
│   ├── routes/      # API endpoints
│   └── middleware/  # Auth middleware
├── prisma/          # Database schema
└── package.json     # Dependencies
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with HMR |
| `npm run build` | Build for production |
| `tsx scripts/seed.ts` | Seed demo data |
| `npx prisma studio` | Open Prisma Studio (database GUI) |
| `npx prisma db push` | Sync schema to database |
| `npx prisma generate` | Generate Prisma Client |

> **Note:** This project uses Prisma ORM. Always use `npx prisma` commands directly.

### Hot Module Replacement (HMR)

The development server supports HMR:
- Frontend changes reload automatically
- Backend changes restart the Express server
- Database schema changes require manual `prisma db push`

### Making Code Changes

1. **Frontend changes**: Edit files in `client/src/` → auto-reload
2. **Backend changes**: Edit files in `server/` → auto-restart
3. **Schema changes**: Edit `prisma/schema.prisma` → run `npx prisma db push`

---

## Database Management

### View Database Schema

```bash
# Open Prisma Studio (visual database browser)
npx prisma studio
```

### Reset Database

**⚠️ WARNING: This deletes all data!**

```bash
# Drop all tables and recreate
npx prisma db push --force-reset

# Re-seed demo data
npm run seed
```

### Backup Database

```bash
# PostgreSQL dump
pg_dump $DATABASE_URL > backup.sql

# Restore from backup
psql $DATABASE_URL < backup.sql
```

---

## Troubleshooting

### Common Issues

#### Issue: "Cannot find module '@prisma/client'"

**Solution:**
```bash
npx prisma generate
```

#### Issue: "Port 5000 already in use"

**Solution:**
```bash
# Find process using port 5000
lsof -i :5000

# Kill the process
kill -9 <PID>

# Or change port in .env
PORT=3000
```

#### Issue: "Database connection failed"

**Solutions:**
1. Verify PostgreSQL is running:
   ```bash
   psql $DATABASE_URL -c "SELECT 1"
   ```

2. Check DATABASE_URL format:
   ```
   postgresql://username:password@host:port/database
   ```

3. Verify credentials and network access

#### Issue: "Prisma schema out of sync"

**Solution:**
```bash
npx prisma generate
npx prisma db push
```

#### Issue: "JWT token invalid"

**Solutions:**
- Clear browser localStorage
- Verify JWT_SECRET matches between restarts
- Check token expiration (default: 7 days)

### Debug Mode

Enable detailed logging:

```bash
# Backend API logs
DEBUG=* npm run dev

# Prisma query logs
DATABASE_LOGGING=true npm run dev
```

### Database Connection Issues

Test connection:
```bash
# Using psql
psql $DATABASE_URL -c "SELECT version();"

# Using Node.js script
node -e "require('@prisma/client').PrismaClient().prototype.\$connect().then(() => console.log('Connected!'))"
```

---

## Next Steps

After successful setup:

1. **Login with demo accounts** - See [DEMO_ACCOUNTS.md](./DEMO_ACCOUNTS.md)
2. **Explore API endpoints** - See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)
3. **Review database schema** - See [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)
4. **Deploy to production** - See [DEPLOYMENT.md](./DEPLOYMENT.md)

---

## Getting Help

- **Documentation**: Check other `.md` files in this repository
- **GitHub Issues**: Report bugs or request features
- **Community**: Join our Discord server (coming soon)

---

## Development Tips

### VS Code Extensions

Recommended extensions:
- **Prisma** - Syntax highlighting for schema files
- **TypeScript** - Better IntelliSense
- **ESLint** - Code linting
- **Tailwind CSS IntelliSense** - CSS class suggestions

### Code Quality

```bash
# Type checking
npx tsc --noEmit

# Linting (if configured)
npm run lint
```

### Database Migrations

For production, use proper migrations:

```bash
# Create migration
npx prisma migrate dev --name your_migration_name

# Apply migrations
npx prisma migrate deploy
```

---

**Setup complete!** Your SafeGo development environment is ready. 🎉
