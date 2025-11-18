# SafeGo Production Deployment Guide

Complete guide for deploying SafeGo to production environments.

---

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Environment Configuration](#environment-configuration)
3. [Production Build](#production-build)
4. [Deployment Platforms](#deployment-platforms)
   - [Replit (Easiest)](#replit)
   - [Heroku](#heroku)
   - [Railway](#railway)
   - [Vercel + Separate Backend](#vercel--separate-backend)
   - [DigitalOcean](#digitalocean)
   - [AWS](#aws)
5. [Database Setup](#database-setup)
6. [Post-Deployment](#post-deployment)
7. [Monitoring & Maintenance](#monitoring--maintenance)

---

## Pre-Deployment Checklist

Before deploying to production:

- [ ] All tests passing
- [ ] Environment variables configured
- [ ] Strong JWT secret generated
- [ ] Database migrations ready
- [ ] Production database provisioned
- [ ] Error monitoring set up (Sentry)
- [ ] Logging configured
- [ ] CORS configured for production domains
- [ ] SSL/HTTPS enabled
- [ ] Rate limiting implemented (optional but recommended)

---

## Environment Configuration

### Required Environment Variables

```env
# Database
DATABASE_URL="postgresql://user:pass@host:5432/safego_prod"

# Authentication
JWT_SECRET="<strong-random-256-bit-key>"

# Server
NODE_ENV="production"
PORT=5000
```

### Generate Secure JWT Secret

```bash
# Use OpenSSL (recommended)
openssl rand -base64 32

# Or Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Optional Environment Variables

```env
# External Services
GOOGLE_MAPS_API_KEY="your-api-key"
STRIPE_SECRET_KEY="sk_live_..."
SENDGRID_API_KEY="SG..."
TWILIO_AUTH_TOKEN="..."

# Monitoring
SENTRY_DSN="https://...@sentry.io/..."

# Storage
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."
AWS_S3_BUCKET="safego-uploads"
```

---

## Production Build

### Build Process

```bash
# Install dependencies
npm install --production

# Generate Prisma Client
npx prisma generate

# Build frontend and backend
npm run build

# Start production server
npm start
```

### Build Output

- **Frontend**: `dist/public/` - Static assets served by Express
- **Backend**: `dist/` - Compiled TypeScript → JavaScript

---

## Deployment Platforms

### Replit

**Easiest option** - Zero configuration required.

1. **Create Replit Account**
   - Go to [replit.com](https://replit.com)
   - Create account or login

2. **Import Repository**
   - Click "Create Repl"
   - Choose "Import from GitHub"
   - Enter repository URL

3. **Configure Environment**
   - Click "Secrets" (🔒 icon)
   - Add environment variables:
     - `DATABASE_URL`
     - `JWT_SECRET`

4. **Deploy**
   - Click "Run" button
   - Replit automatically detects `npm run dev`
   - Application deploys instantly

5. **Get URL**
   - Copy Replit URL: `https://your-repl.your-username.repl.co`

**Pros:** 
- Zero config deployment
- Built-in PostgreSQL
- Automatic HTTPS
- Free tier available

**Cons:**
- May sleep on free tier
- Limited resources on free plan

---

### Heroku

Traditional PaaS platform with good PostgreSQL support.

1. **Install Heroku CLI**
```bash
curl https://cli-assets.heroku.com/install.sh | sh
heroku login
```

2. **Create Heroku App**
```bash
heroku create safego-app
```

3. **Add PostgreSQL**
```bash
heroku addons:create heroku-postgresql:essential-0
```

4. **Configure Environment**
```bash
heroku config:set JWT_SECRET="$(openssl rand -base64 32)"
heroku config:set NODE_ENV=production
```

5. **Deploy**
```bash
git push heroku main
```

6. **Run Migrations**
```bash
heroku run npx prisma db push
```

7. **Open Application**
```bash
heroku open
```

**Pricing:** 
- Eco Dynos: $5/month
- Basic PostgreSQL: $9/month
- Total: ~$14/month

---

### Railway

Modern deployment platform with excellent developer experience.

1. **Create Account**
   - Go to [railway.app](https://railway.app)
   - Sign in with GitHub

2. **New Project**
   - Click "New Project"
   - Choose "Deploy from GitHub"
   - Select your repository

3. **Add PostgreSQL**
   - Click "+ New"
   - Select "Database" → "PostgreSQL"
   - Copy `DATABASE_URL` from variables

4. **Configure Environment**
   - Go to project variables
   - Add:
     - `DATABASE_URL` (from PostgreSQL)
     - `JWT_SECRET`
     - `NODE_ENV=production`

5. **Deploy**
   - Railway auto-deploys on git push
   - View logs in dashboard

6. **Get Domain**
   - Click "Settings" → "Generate Domain"
   - Use provided `*.railway.app` domain

**Pricing:** 
- $5/month usage-based
- Free $5 credit monthly

---

### Vercel + Separate Backend

Deploy frontend to Vercel, backend separately.

**Not Recommended** - SafeGo uses unified server architecture. Consider Railway or Heroku instead.

If you must separate:

1. **Split Frontend/Backend**
   - Deploy frontend to Vercel
   - Deploy backend to Railway/Heroku
   - Configure CORS

2. **Update API Calls**
   - Change API base URL in frontend
   - Update environment variables

---

### DigitalOcean

VPS deployment with full control.

1. **Create Droplet**
   - Ubuntu 22.04 LTS
   - Minimum: $6/month (1GB RAM)
   - Recommended: $12/month (2GB RAM)

2. **Install Dependencies**
```bash
# SSH into droplet
ssh root@your-droplet-ip

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Install PostgreSQL
apt-get install -y postgresql postgresql-contrib

# Install PM2 (process manager)
npm install -g pm2
```

3. **Setup Database**
```bash
# Switch to postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE safego;
CREATE USER safego_user WITH PASSWORD 'strong_password';
GRANT ALL PRIVILEGES ON DATABASE safego TO safego_user;
\q
```

4. **Clone Repository**
```bash
git clone https://github.com/yourusername/safego.git
cd safego
```

5. **Configure Environment**
```bash
cp .env.example .env
nano .env  # Edit with production values
```

6. **Install & Build**
```bash
npm install
npx prisma generate
npm run build
```

7. **Start with PM2**
```bash
pm2 start npm --name safego -- start
pm2 save
pm2 startup
```

8. **Setup Nginx (Reverse Proxy)**
```bash
apt-get install nginx

# Create nginx config
nano /etc/nginx/sites-available/safego
```

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable site
ln -s /etc/nginx/sites-available/safego /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

9. **Setup SSL (Let's Encrypt)**
```bash
apt-get install certbot python3-certbot-nginx
certbot --nginx -d your-domain.com
```

**Pricing:**
- Droplet: $6-12/month
- Database: Included in droplet
- Total: $6-12/month

---

### AWS

Enterprise-grade deployment (most complex).

**Components:**
- **EC2**: Application server
- **RDS**: PostgreSQL database
- **S3**: Static assets (optional)
- **CloudFront**: CDN (optional)
- **ELB**: Load balancer
- **Route 53**: DNS

**Estimated Cost:** $30-100/month minimum

**Not recommended for small projects** due to complexity. Use Railway or Heroku instead.

---

## Database Setup

### Option 1: Managed PostgreSQL

**Neon (Recommended - Serverless)**
- Free tier: 0.5GB storage
- Serverless: Scales to zero
- Get connection string from dashboard

**Railway PostgreSQL**
- Automatic provisioning
- Backups included
- Connection string in variables

**Heroku PostgreSQL**
- Essential: $9/month
- Built-in backups
- `DATABASE_URL` auto-configured

### Option 2: Self-Hosted

**DigitalOcean Managed Database**
- Starting at $15/month
- Automatic backups
- High availability

**AWS RDS**
- db.t3.micro: ~$15/month
- Multi-AZ for production
- Automated backups

### Database Migrations

```bash
# Push schema to production database
npx prisma db push

# Or use migrations (recommended for production)
npx prisma migrate deploy
```

---

## Post-Deployment

### 1. Verify Deployment

```bash
# Check health endpoint
curl https://your-domain.com/api/health

# Test authentication
curl -X POST https://your-domain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"demo123"}'
```

### 2. Seed Production Data

```bash
# Create admin account
tsx scripts/seed.ts
```

### 3. Test All Features

- [ ] User signup/login
- [ ] Customer ride request
- [ ] Driver registration
- [ ] Restaurant order flow
- [ ] Admin KYC approval
- [ ] Wallet transactions

### 4. Configure Monitoring

**Sentry (Error Tracking)**
```bash
npm install @sentry/node

# In server/index.ts
import * as Sentry from "@sentry/node";
Sentry.init({ dsn: process.env.SENTRY_DSN });
```

**LogTail (Logging)**
```bash
# Setup log aggregation
# Alternative: Datadog, New Relic
```

---

## Monitoring & Maintenance

### Health Checks

Add health endpoint (already included):

```typescript
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date() });
});
```

### Logging

Production logs should include:
- API requests/responses
- Errors with stack traces
- Database query performance
- Authentication events

### Backups

**Database Backups:**
```bash
# Manual backup
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Automated (using cron)
0 2 * * * pg_dump $DATABASE_URL > /backups/safego-$(date +\%Y\%m\%d).sql
```

**Application Backups:**
- Code: GitHub repository
- Environment: Documented in .env.example
- Database: Daily automated backups

### Scaling

**Horizontal Scaling:**
- Add more server instances
- Use load balancer (Nginx, AWS ALB)
- Database connection pooling

**Vertical Scaling:**
- Increase server resources (RAM, CPU)
- Upgrade database tier

### Security

**Recommended Practices:**
- [ ] HTTPS/SSL enforced
- [ ] Strong JWT secrets
- [ ] Rate limiting enabled
- [ ] SQL injection prevention (Prisma handles this)
- [ ] Input validation on all endpoints
- [ ] CORS configured properly
- [ ] Helmet.js for security headers
- [ ] Regular dependency updates

---

## Troubleshooting

### Issue: Database connection fails

**Check:**
- `DATABASE_URL` format correct
- Database server reachable
- Firewall rules allow connection
- SSL mode configured (`?sslmode=require`)

### Issue: Build fails

**Check:**
- All dependencies installed
- TypeScript compiles without errors
- Prisma client generated
- Node version matches (20+)

### Issue: App crashes on start

**Check:**
- Environment variables set
- Port not already in use
- Database migrations applied
- Logs for error details

---

## Rollback Strategy

### Quick Rollback

```bash
# Revert to previous deployment (Heroku)
heroku rollback

# Restore database backup
psql $DATABASE_URL < backup-20240115.sql
```

---

## Cost Comparison

| Platform | Monthly Cost | Includes |
|----------|-------------|----------|
| Replit | $0-20 | Database, hosting, SSL |
| Railway | $5-20 | Database, hosting, SSL |
| Heroku | $14+ | Database, hosting, SSL |
| DigitalOcean | $6-25 | VPS only, setup required |
| AWS | $30-100+ | Full control, complex setup |

**Recommendation for small projects:** Railway or Replit
**Recommendation for production:** Railway or Heroku

---

## Next Steps

After deployment:
1. Monitor error rates
2. Set up alerts
3. Configure backups
4. Plan scaling strategy
5. Document runbooks

---

For development setup, see:
- [Setup Guide](./SETUP.md)
- [API Documentation](./API_DOCUMENTATION.md)
