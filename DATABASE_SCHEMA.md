# SafeGo Database Schema

Complete database structure and relationships for the SafeGo platform.

---

## Table of Contents

1. [Overview](#overview)
2. [Schema Diagram](#schema-diagram)
3. [User & Authentication](#user--authentication)
4. [Role-Specific Profiles](#role-specific-profiles)
5. [Service Tables](#service-tables)
6. [Wallet System](#wallet-system)
7. [Relationships](#relationships)
8. [Indexes & Constraints](#indexes--constraints)

---

## Overview

The SafeGo database is designed with:
- **PostgreSQL** as the database engine
- **Prisma ORM** for type-safe database access
- **UUID** primary keys for all tables
- **Cascade deletes** for data integrity
- **Country-specific fields** for BD and US KYC requirements

---

## Schema Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                          USERS                              │
│  id, email, passwordHash, role, countryCode, isBlocked      │
└───────────┬─────────────────────────────────────────────────┘
            │
            ├─────────────┬─────────────┬──────────────┬───────────────┐
            │             │             │              │               │
            ▼             ▼             ▼              ▼               ▼
    ┌─────────────┐ ┌──────────┐ ┌────────────┐ ┌───────────┐ ┌───────────────┐
    │   DRIVER    │ │ CUSTOMER │ │ RESTAURANT │ │   ADMIN   │ │ NOTIFICATIONS │
    │   PROFILE   │ │ PROFILE  │ │  PROFILE   │ │  PROFILE  │ └───────────────┘
    └──────┬──────┘ └────┬─────┘ └─────┬──────┘ └───────────┘
           │             │              │
           ├───┬─────┬───┘              │
           │   │     │                  │
           ▼   ▼     ▼                  ▼
    ┌──────┐ ┌─────┐ ┌───────┐  ┌────────────┐
    │VEHICL│ │STATS│ │WALLET │  │  RESTAURANT│
    │  E   │ │     │ │       │  │   WALLET   │
    └──────┘ └─────┘ └───────┘  └────────────┘
           │             │              │
           │             │              │
           ▼             ▼              ▼
    ┌──────────────────────────────────────────┐
    │         RIDES / FOOD_ORDERS / DELIVERIES │
    │  (Services linking Customers & Drivers)  │
    └──────────────────────────────────────────┘
```

---

## User & Authentication

### User Table

**Table:** `users`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| email | String | Unique email address |
| passwordHash | String | Bcrypt hashed password |
| role | String | User role: `customer`, `driver`, `restaurant`, `admin` |
| countryCode | String | Country code: `BD`, `US` |
| isBlocked | Boolean | Admin can block/unblock users |
| createdAt | DateTime | Account creation timestamp |
| updatedAt | DateTime | Last update timestamp |

**Relationships:**
- Has one: DriverProfile, CustomerProfile, RestaurantProfile, AdminProfile (based on role)
- Has many: Notifications

**Constraints:**
- `email` must be unique
- Cascade delete on all related profiles

---

## Role-Specific Profiles

### Driver Profile

**Table:** `driver_profiles`

#### Bangladesh-Specific Fields
- `fatherName`: Father's full name
- `presentAddress`: Current residential address
- `permanentAddress`: Permanent address (village/hometown)
- `nidNumber`: National ID number (13 digits)
- `nidFrontImageUrl`: NID front photo URL
- `nidBackImageUrl`: NID back photo URL

#### USA-Specific Fields
- `homeAddress`: Full residential address
- `governmentIdType`: `passport` or `state_id`
- `governmentIdLast4`: Last 4 digits of government ID
- `driverLicenseNumber`: Driver's license number
- `driverLicenseImageUrl`: License photo URL
- `driverLicenseExpiry`: License expiration date
- `ssnLast4`: Last 4 digits of SSN

#### Common Fields
- `dateOfBirth`: Date of birth
- `emergencyContactName`: Emergency contact person
- `emergencyContactPhone`: Emergency contact number
- `verificationStatus`: `pending`, `approved`, `rejected`
- `rejectionReason`: Admin feedback if rejected
- `isVerified`: Boolean flag for quick checks

**Relationships:**
- Belongs to: User (userId)
- Has one: Vehicle, DriverStats, DriverWallet
- Has many: Rides, FoodOrders, Deliveries

---

### Customer Profile

**Table:** `customer_profiles`

#### Bangladesh-Specific Fields
- `fatherName`: Father's full name
- `presentAddress`: Current address
- `permanentAddress`: Permanent address
- `nidNumber`: National ID number
- `nidFrontImageUrl`: NID front photo
- `nidBackImageUrl`: NID back photo

#### USA-Specific Fields
- `homeAddress`: Full residential address
- `governmentIdType`: Type of government ID
- `governmentIdLast4`: Last 4 digits of ID

#### Common Fields
- Same verification fields as Driver Profile

**Relationships:**
- Belongs to: User (userId)
- Has many: Rides, FoodOrders, Deliveries

---

### Restaurant Profile

**Table:** `restaurant_profiles`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| userId | UUID | Foreign key to users |
| restaurantName | String | Business name |
| address | String | Business address |
| verificationStatus | String | `pending`, `approved`, `rejected` |
| rejectionReason | String | Optional rejection reason |
| isVerified | Boolean | Verification flag |

**Relationships:**
- Belongs to: User (userId)
- Has one: RestaurantWallet
- Has many: FoodOrders

---

### Admin Profile

**Table:** `admin_profiles`

Minimal profile - admins only need userId relationship.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| userId | UUID | Foreign key to users |
| createdAt | DateTime | Account creation |

---

## Service Tables

### Rides

**Table:** `rides`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| customerId | UUID | Customer who requested |
| driverId | UUID | Assigned driver (nullable) |
| pickupAddress | String | Pickup location text |
| pickupLat | Float | Pickup latitude |
| pickupLng | Float | Pickup longitude |
| dropoffAddress | String | Destination text |
| dropoffLat | Float | Destination latitude |
| dropoffLng | Float | Destination longitude |
| serviceFare | Decimal(10,2) | Total fare amount |
| safegoCommission | Decimal(10,2) | Platform commission (20%) |
| driverPayout | Decimal(10,2) | Driver earnings (80%) |
| paymentMethod | String | `cash` or `online` |
| status | String | Current ride status |
| customerRating | Int | 1-5 rating from customer |
| customerFeedback | String | Optional feedback |
| driverRating | Int | 1-5 rating from driver |
| driverFeedback | String | Optional feedback |
| completedAt | DateTime | Completion timestamp |

**Status Flow:**
```
requested → accepted → in_progress → completed
    ↓
cancelled_by_customer
cancelled_by_driver
```

---

### Food Orders

**Table:** `food_orders`

Similar structure to Rides but includes:
- `restaurantId`: Restaurant fulfilling order
- `restaurantPayout`: Restaurant earnings (75%)
- `driverPayout`: Delivery fee (5%)
- `safegoCommission`: Platform fee (20%)

**Status Flow:**
```
pending → accepted → preparing → ready → delivering → delivered
    ↓
cancelled_by_customer
cancelled_by_restaurant
```

**Commission Model:**
- Total: 100.00
- Restaurant: 75.00 (75%)
- Driver: 5.00 (5%)
- SafeGo: 20.00 (20%)

---

### Deliveries (Parcel)

**Table:** `deliveries`

Similar to Rides with additional field:
- `parcelDescription`: Description of package

**Status Flow:**
```
requested → accepted → picked_up → in_transit → delivered
    ↓
cancelled_by_customer
cancelled_by_driver
```

---

## Wallet System

### Driver Wallet

**Table:** `driver_wallets`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| driverId | UUID | Foreign key to driver_profiles |
| balance | Decimal(10,2) | Positive balance (SafeGo owes driver) |
| negativeBalance | Decimal(10,2) | Commission owed to SafeGo |

**How it works:**

**CASH Payments:**
1. Driver collects full fare from customer
2. SafeGo commission tracked as negative balance
3. Driver settles negative balance later

**ONLINE Payments:**
1. Customer pays through app
2. SafeGo keeps commission automatically
3. Driver balance increased by payout amount

**Example (Ride: $100, Cash):**
- Driver collects: $100 from customer
- Driver balance: +$80 (payout)
- Negative balance: +$20 (commission owed)

---

### Restaurant Wallet

**Table:** `restaurant_wallets`

Same structure as Driver Wallet.

**How it works:**

**CASH Food Orders:**
1. Customer pays driver in cash
2. Restaurant owes SafeGo commission
3. Tracked as negative balance

**Example (Food Order: $100, Cash):**
- Restaurant earns: $75
- Driver delivery fee: $5 (collected in cash)
- SafeGo commission: $20
- Restaurant negative balance: +$20

---

## Supporting Tables

### Vehicle

**Table:** `vehicles`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| driverId | UUID | Foreign key to driver_profiles (unique) |
| vehicleType | String | Type: `motorcycle`, `car`, `van`, `truck` |
| vehicleModel | String | Make and model |
| vehiclePlate | String | License plate number |
| isOnline | Boolean | Current online status |
| totalEarnings | Decimal(10,2) | Lifetime earnings |

**Constraints:**
- One vehicle per driver
- Driver must have vehicle to go online

---

### Driver Stats

**Table:** `driver_stats`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| driverId | UUID | Foreign key to driver_profiles (unique) |
| rating | Decimal(3,2) | Average rating (1.00 - 5.00) |
| totalTrips | Int | Total completed trips |

**Updates:**
- Rating recalculated after each completed ride
- Total trips incremented on ride completion

---

### Notifications

**Table:** `notifications`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| userId | UUID | Foreign key to users |
| type | String | Notification category |
| title | String | Notification title |
| body | String | Notification message |
| isRead | Boolean | Read status |
| createdAt | DateTime | Creation timestamp |

**Notification Types:**
- `ride_update`: Ride status changes
- `food_update`: Food order updates
- `parcel_update`: Delivery updates
- `verification`: KYC approval/rejection
- `admin`: Admin announcements

---

## Relationships

### One-to-One
- User → DriverProfile
- User → CustomerProfile
- User → RestaurantProfile
- User → AdminProfile
- DriverProfile → Vehicle
- DriverProfile → DriverStats
- DriverProfile → DriverWallet
- RestaurantProfile → RestaurantWallet

### One-to-Many
- User → Notifications
- DriverProfile → Rides (as driver)
- DriverProfile → FoodOrders (as driver)
- DriverProfile → Deliveries (as driver)
- CustomerProfile → Rides (as customer)
- CustomerProfile → FoodOrders (as customer)
- CustomerProfile → Deliveries (as customer)
- RestaurantProfile → FoodOrders (as restaurant)

---

## Indexes & Constraints

### Unique Constraints
- `users.email` - Enforces unique email addresses
- `driver_profiles.userId` - One profile per user
- `customer_profiles.userId` - One profile per user
- `restaurant_profiles.userId` - One profile per user
- `admin_profiles.userId` - One profile per user
- `vehicles.driverId` - One vehicle per driver
- `driver_stats.driverId` - One stats record per driver
- `driver_wallets.driverId` - One wallet per driver
- `restaurant_wallets.restaurantId` - One wallet per restaurant

### Foreign Key Constraints
All foreign keys include `onDelete: Cascade`:
- Deleting a User cascades to all related profiles
- Deleting a DriverProfile cascades to Vehicle, Stats, Wallet
- Deleting a RestaurantProfile cascades to RestaurantWallet

### Recommended Indexes (for performance)
```sql
-- User lookups
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- Service status queries
CREATE INDEX idx_rides_status ON rides(status);
CREATE INDEX idx_rides_driver ON rides(driverId);
CREATE INDEX idx_rides_customer ON rides(customerId);

CREATE INDEX idx_food_orders_status ON food_orders(status);
CREATE INDEX idx_food_orders_restaurant ON food_orders(restaurantId);

CREATE INDEX idx_deliveries_status ON deliveries(status);

-- KYC queries
CREATE INDEX idx_driver_verification ON driver_profiles(verificationStatus);
CREATE INDEX idx_customer_verification ON customer_profiles(verificationStatus);
CREATE INDEX idx_restaurant_verification ON restaurant_profiles(verificationStatus);
```

---

## Data Types

### Decimal Precision
All monetary values use `Decimal(10, 2)`:
- Max value: 99,999,999.99
- Precision: 2 decimal places
- Suitable for fares up to $99M

### Coordinates
Latitude/Longitude stored as `Float`:
- Standard GPS precision
- Example: 23.8103, 90.4125

### UUIDs
All primary keys use UUID v4:
- Format: `123e4567-e89b-12d3-a456-426614174000`
- Generated by PostgreSQL `uuid_generate_v4()`

---

## Database Migrations

### Using Prisma

```bash
# Generate Prisma Client
npx prisma generate

# Push schema to database (development)
npx prisma db push

# Create migration (production)
npx prisma migrate dev --name migration_name

# Apply migrations
npx prisma migrate deploy
```

### Viewing Data

```bash
# Open Prisma Studio
npx prisma studio

# Direct PostgreSQL access
psql $DATABASE_URL
```

---

## Sample Queries

### Get pending KYC users
```sql
SELECT u.email, u.role, d.verificationStatus
FROM users u
JOIN driver_profiles d ON u.id = d.userId
WHERE d.verificationStatus = 'pending';
```

### Calculate driver earnings
```sql
SELECT 
  d.id,
  u.email,
  dw.balance,
  dw.negativeBalance,
  (dw.balance - dw.negativeBalance) AS net_balance
FROM driver_profiles d
JOIN users u ON d.userId = u.id
JOIN driver_wallets dw ON d.id = dw.driverId;
```

### Get active rides
```sql
SELECT 
  r.id,
  c.user.email AS customer_email,
  r.status,
  r.serviceFare
FROM rides r
JOIN customer_profiles c ON r.customerId = c.id
WHERE r.status NOT IN ('completed', 'cancelled_by_customer', 'cancelled_by_driver');
```

---

For API usage of these tables, see:
- [API Documentation](./API_DOCUMENTATION.md)
- [Setup Guide](./SETUP.md)
