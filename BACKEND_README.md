# SafeGo Backend API - Complete Documentation

A production-ready backend for SafeGo, a global super-app offering ride-hailing, food delivery, and parcel delivery services across Bangladesh and the United States.

## 🚀 Tech Stack

- **Runtime:** Node.js with TypeScript
- **Framework:** Express.js
- **Database:** PostgreSQL (via Prisma ORM)
- **Authentication:** JWT tokens with bcrypt password hashing
- **Port:** 5000

## ✨ Features

### Core Capabilities

1. **Multi-Role Authentication System**
   - Four user roles: Customer, Driver, Restaurant, Admin
   - JWT-based authentication with role-based access control (RBAC)
   - Automatic profile creation on signup based on role and country

2. **Country-Specific KYC Verification**
   - **Bangladesh:** NID number, father's name, present/permanent addresses, emergency contacts
   - **United States:** Government ID type/last 4, home address, SSN last 4 (drivers), driver's license (drivers)
   - Admin approval workflow with rejection reasons

3. **Three Service Types with Complete Workflows**
   - Ride-hailing: Customer requests → Driver accepts → Trip completed with mutual ratings
   - Food delivery: Customer orders → Restaurant prepares → Driver delivers
   - Parcel delivery: Customer requests → Driver picks up and delivers

4. **Automated Commission & Wallet System**
   - 20% commission for rides and parcels
   - 15% restaurant + 5% delivery commission for food orders
   - **Cash payments:** Service provider keeps cash, commission becomes negative balance owed to SafeGo
   - **Online payments:** Commission deducted automatically, payout credited to wallet
   - Admin settlement workflow for negative balances

5. **Status Flow Management**
   - **Rides:** requested → searching_driver → accepted → driver_arriving → in_progress → completed
   - **Food Orders:** placed → accepted → preparing → ready_for_pickup → picked_up → on_the_way → delivered
   - **Parcels:** requested → searching_driver → accepted → picked_up → on_the_way → delivered

6. **Real-time Notifications**
   - Service updates (driver assigned, order accepted, status changes)
   - Database-stored notifications accessible via API

## 📚 API Endpoints

### Authentication (`/api/auth`)

#### POST `/api/auth/signup`
Create a new user account with role-specific profile.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "role": "customer",
  "countryCode": "BD",
  "profile": {
    // Country and role-specific fields
  }
}
```

**Bangladesh Driver Profile Fields:**
```json
{
  "dateOfBirth": "1990-01-01",
  "fatherName": "Father Name",
  "presentAddress": "123 Street, Dhaka",
  "permanentAddress": "456 Street, Dhaka",
  "nidNumber": "1234567890",
  "nidFrontImageUrl": "https://...",
  "nidBackImageUrl": "https://...",
  "emergencyContactName": "Contact Name",
  "emergencyContactPhone": "+8801234567890"
}
```

**US Driver Profile Fields:**
```json
{
  "dateOfBirth": "1990-01-01",
  "homeAddress": "123 Main St, NY",
  "governmentIdType": "passport",
  "governmentIdLast4": "1234",
  "driverLicenseNumber": "DL123456",
  "driverLicenseImageUrl": "https://...",
  "driverLicenseExpiry": "2025-12-31",
  "ssnLast4": "5678",
  "emergencyContactName": "Contact Name",
  "emergencyContactPhone": "+1234567890"
}
```

**Customer Profile (BD):**
```json
{
  "dateOfBirth": "1995-05-15",
  "fatherName": "Father Name",
  "presentAddress": "Address",
  "permanentAddress": "Address",
  "nidNumber": "1234567890",
  "emergencyContactName": "Contact",
  "emergencyContactPhone": "+880..."
}
```

**Customer Profile (US):**
```json
{
  "dateOfBirth": "1995-05-15",
  "homeAddress": "123 Main St",
  "governmentIdType": "passport",
  "governmentIdLast4": "1234",
  "emergencyContactName": "Contact",
  "emergencyContactPhone": "+1..."
}
```

**Restaurant Profile:**
```json
{
  "restaurantName": "Restaurant Name",
  "address": "Restaurant Address"
}
```

**Response (201):**
```json
{
  "message": "User created successfully",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "customer",
    "countryCode": "BD"
  }
}
```

#### POST `/api/auth/login`
Authenticate and receive JWT token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "customer"
  }
}
```

#### GET `/api/auth/me`
Get current authenticated user profile.

**Headers:** `Authorization: Bearer {token}`

**Response (200):**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "customer",
    "countryCode": "BD",
    "profile": { /* role-specific profile data */ }
  }
}
```

---

### Driver Endpoints (`/api/driver`)

**Authentication Required:** All endpoints require driver role JWT token.

#### GET `/api/driver/home`
Get driver dashboard data.

**Response (200):**
```json
{
  "profile": {
    "id": "uuid",
    "email": "driver@example.com",
    "countryCode": "BD",
    "verificationStatus": "approved",
    "isVerified": true,
    "rejectionReason": null
  },
  "vehicle": {
    "id": "uuid",
    "vehicleType": "sedan",
    "vehicleModel": "Toyota Corolla 2020",
    "vehiclePlate": "DHK-1234",
    "isOnline": true,
    "totalEarnings": 5000.00
  },
  "stats": {
    "rating": 4.8,
    "totalTrips": 150
  },
  "wallet": {
    "balance": 2000.00,
    "negativeBalance": 500.00
  }
}
```

#### POST `/api/driver/vehicle`
Register a vehicle for the driver.

**Request Body:**
```json
{
  "vehicleType": "sedan",
  "vehicleModel": "Toyota Corolla 2020",
  "vehiclePlate": "DHK-1234"
}
```

**Response (201):**
```json
{
  "message": "Vehicle registered successfully",
  "vehicle": {
    "id": "uuid",
    "vehicleType": "sedan",
    "vehicleModel": "Toyota Corolla 2020",
    "vehiclePlate": "DHK-1234",
    "isOnline": false,
    "totalEarnings": 0
  }
}
```

#### PATCH `/api/driver/vehicle`
Update vehicle information.

**Request Body:**
```json
{
  "vehicleType": "suv",
  "vehicleModel": "Honda CR-V 2021",
  "vehiclePlate": "DHK-5678"
}
```

#### PATCH `/api/driver/profile`
Update driver KYC data and emergency contact.

**Request Body (country-specific fields):**
```json
{
  "dateOfBirth": "1990-01-01",
  "emergencyContactName": "New Contact",
  "emergencyContactPhone": "+8801234567890",
  // BD-specific
  "fatherName": "Updated Father Name",
  "presentAddress": "New Address",
  // US-specific
  "homeAddress": "New Address",
  "driverLicenseNumber": "DL999999"
}
```

#### PATCH `/api/driver/status`
Toggle driver online/offline status.

**Request Body:**
```json
{
  "isOnline": true
}
```

**Requirements:**
- Driver must be verified
- Driver must have registered vehicle

**Response (200):**
```json
{
  "message": "Driver is now online",
  "vehicle": {
    "id": "uuid",
    "isOnline": true
  }
}
```

---

### Customer Endpoints (`/api/customer`)

**Authentication Required:** All endpoints require customer role JWT token.

#### GET `/api/customer/home`
Get customer dashboard data.

**Response (200):**
```json
{
  "profile": {
    "id": "uuid",
    "email": "customer@example.com",
    "countryCode": "US",
    "verificationStatus": "approved",
    "isVerified": true,
    "rejectionReason": null
  }
}
```

#### PATCH `/api/customer/profile`
Update customer KYC data.

**Request Body (country-specific):**
```json
{
  "dateOfBirth": "1995-05-15",
  "emergencyContactName": "New Contact",
  // BD fields
  "fatherName": "Father",
  "presentAddress": "Address",
  // US fields
  "homeAddress": "New Address",
  "governmentIdType": "drivers_license"
}
```

---

### Restaurant Endpoints (`/api/restaurant`)

**Authentication Required:** All endpoints require restaurant role JWT token.

#### GET `/api/restaurant/home`
Get restaurant dashboard including wallet.

**Response (200):**
```json
{
  "profile": {
    "id": "uuid",
    "email": "restaurant@example.com",
    "restaurantName": "Tasty Bites",
    "address": "123 Food St, Dhaka",
    "countryCode": "BD",
    "verificationStatus": "approved",
    "isVerified": true,
    "rejectionReason": null
  },
  "wallet": {
    "balance": 5000.00,
    "negativeBalance": 200.00
  }
}
```

#### PATCH `/api/restaurant/profile`
Update restaurant information.

**Request Body:**
```json
{
  "restaurantName": "New Restaurant Name",
  "address": "New Address"
}
```

---

### Admin Endpoints (`/api/admin`)

**Authentication Required:** All endpoints require admin role JWT token.

#### GET `/api/admin/pending-kyc?role={role}`
List all users with pending KYC verification.

**Query Parameters:**
- `role` (optional): Filter by role (customer, driver, restaurant)

**Response (200):**
```json
{
  "pending": {
    "drivers": [
      {
        "userId": "uuid",
        "profileId": "uuid",
        "email": "driver@example.com",
        "role": "driver",
        "countryCode": "BD",
        "verificationStatus": "pending",
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "customers": [],
    "restaurants": []
  }
}
```

#### PATCH `/api/admin/kyc/:userId`
Approve or reject KYC verification.

**Request Body:**
```json
{
  "verificationStatus": "approved",
  "rejectionReason": "Optional reason if rejected"
}
```

**Response (200):**
```json
{
  "message": "KYC status updated successfully",
  "profile": {
    "verificationStatus": "approved",
    "isVerified": true
  }
}
```

#### PATCH `/api/admin/block/:userId`
Block or unblock a user account.

**Request Body:**
```json
{
  "isBlocked": true
}
```

**Response (200):**
```json
{
  "message": "User blocked successfully",
  "user": {
    "id": "uuid",
    "isBlocked": true
  }
}
```

#### GET `/api/admin/users?role={role}`
List all users in the system.

**Query Parameters:**
- `role` (optional): Filter by role

**Response (200):**
```json
{
  "users": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "role": "driver",
      "countryCode": "BD",
      "isBlocked": false,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "driverProfile": {
        "verificationStatus": "approved",
        "isVerified": true
      }
    }
  ]
}
```

#### POST `/api/admin/settle-wallet`
Settle negative balance for driver or restaurant.

**Request Body:**
```json
{
  "walletType": "driver",
  "walletId": "uuid",
  "settlementAmount": 50.00
}
```

**Response (200):**
```json
{
  "message": "Driver wallet settled successfully",
  "wallet": {
    "id": "uuid",
    "balance": 2000.00,
    "negativeBalance": 450.00
  }
}
```

---

### Ride Endpoints (`/api/rides`)

#### POST `/api/rides` (Customer only)
Request a new ride.

**Request Body:**
```json
{
  "pickupAddress": "123 Main St",
  "pickupLat": 23.8103,
  "pickupLng": 90.4125,
  "dropoffAddress": "456 Oak Ave",
  "dropoffLat": 23.7507,
  "dropoffLng": 90.3767,
  "serviceFare": 250.00,
  "paymentMethod": "cash"
}
```

**Response (201):**
```json
{
  "message": "Ride requested successfully",
  "ride": {
    "id": "uuid",
    "pickupAddress": "123 Main St",
    "dropoffAddress": "456 Oak Ave",
    "serviceFare": 250.00,
    "paymentMethod": "cash",
    "status": "requested",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### GET `/api/rides/:id`
Get ride details (accessible by customer, driver, or admin).

**Response (200):**
```json
{
  "ride": {
    "id": "uuid",
    "customer": {
      "email": "customer@example.com"
    },
    "driver": {
      "email": "driver@example.com",
      "vehicle": {
        "vehicleType": "sedan",
        "vehicleModel": "Toyota Corolla",
        "vehiclePlate": "DHK-1234"
      }
    },
    "pickupAddress": "123 Main St",
    "pickupLat": 23.8103,
    "pickupLng": 90.4125,
    "dropoffAddress": "456 Oak Ave",
    "dropoffLat": 23.7507,
    "dropoffLng": 90.3767,
    "serviceFare": 250.00,
    "safegoCommission": 50.00,
    "driverPayout": 200.00,
    "paymentMethod": "cash",
    "status": "completed",
    "customerRating": 5,
    "customerFeedback": "Great driver!",
    "driverRating": 5,
    "driverFeedback": "Nice passenger!",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "completedAt": "2024-01-01T01:00:00.000Z"
  }
}
```

#### PATCH `/api/rides/:id/accept` (Driver only)
Accept a ride request.

**Requirements:**
- Driver must be verified
- Driver must have vehicle registered
- Driver must be online
- Ride status must be "requested" or "searching_driver"

**Response (200):**
```json
{
  "message": "Ride accepted successfully",
  "ride": {
    "id": "uuid",
    "status": "accepted"
  }
}
```

#### PATCH `/api/rides/:id/status`
Update ride status (driver, customer, or admin).

**Request Body:**
```json
{
  "status": "in_progress"
}
```

**Valid Statuses:**
- requested
- searching_driver
- accepted
- driver_arriving
- in_progress
- completed
- cancelled_by_customer
- cancelled_by_driver

#### POST `/api/rides/:id/complete`
Complete ride with rating (both customer and driver must rate).

**Request Body:**
```json
{
  "rating": 5,
  "feedback": "Optional feedback text"
}
```

**Commission Applied When:**
Both customer and driver have submitted ratings.

**Cash Payment Logic:**
- Driver receives full $250 cash from customer
- Driver wallet negative balance increases by $50 (20% commission)
- Driver can continue working, owes SafeGo $50

**Online Payment Logic:**
- SafeGo receives $250 from payment processor
- Driver wallet balance increases by $200 (80% payout)
- SafeGo keeps $50 commission

---

### Food Order Endpoints (`/api/food-orders`)

#### POST `/api/food-orders` (Customer only)
Create a new food order.

**Request Body:**
```json
{
  "restaurantId": "uuid",
  "deliveryAddress": "123 Home St",
  "deliveryLat": 23.8103,
  "deliveryLng": 90.4125,
  "items": [
    {"name": "Burger", "quantity": 2, "price": 150},
    {"name": "Fries", "quantity": 1, "price": 50}
  ],
  "serviceFare": 200.00,
  "paymentMethod": "online"
}
```

**Response (201):**
```json
{
  "message": "Food order created successfully",
  "order": {
    "id": "uuid",
    "restaurantId": "uuid",
    "deliveryAddress": "123 Home St",
    "items": [
      {"name": "Burger", "quantity": 2, "price": 150}
    ],
    "serviceFare": 200.00,
    "paymentMethod": "online",
    "status": "placed",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### GET `/api/food-orders/:id`
Get order details (customer, restaurant, driver, or admin).

#### PATCH `/api/food-orders/:id/accept` (Restaurant only)
Restaurant accepts the order.

**Response (200):**
```json
{
  "message": "Order accepted successfully",
  "order": {
    "id": "uuid",
    "status": "accepted"
  }
}
```

#### PATCH `/api/food-orders/:id/assign-driver` (Driver only)
Driver accepts delivery assignment.

**Requirements:**
- Order status must be "ready_for_pickup"
- Driver must be verified and online

**Response (200):**
```json
{
  "message": "Driver assigned successfully",
  "order": {
    "id": "uuid",
    "status": "picked_up"
  }
}
```

#### PATCH `/api/food-orders/:id/status`
Update order status (restaurant or driver).

**Request Body:**
```json
{
  "status": "preparing"
}
```

**Valid Statuses:**
- placed
- accepted
- preparing
- ready_for_pickup
- picked_up
- on_the_way
- delivered
- cancelled

#### POST `/api/food-orders/:id/complete`
Complete order with rating (customer and restaurant both rate).

**Commission Logic:**
- Restaurant Commission: 15%
- Delivery Commission: 5%
- Total: 20%

**Example: $200 Online Payment**
- Restaurant balance increases by $170 (85%)
- Driver balance increases by $10 (5%)
- SafeGo keeps $40 (20%)

**Example: $200 Cash Payment**
- Restaurant receives full $200 cash
- Restaurant negative balance increases by $30 (15%)
- Driver balance increases by $10 (5% delivery fee)
- SafeGo total commission: $40

---

### Parcel Delivery Endpoints (`/api/deliveries`)

#### POST `/api/deliveries` (Customer only)
Request parcel delivery.

**Request Body:**
```json
{
  "pickupAddress": "Sender Address",
  "pickupLat": 23.8103,
  "pickupLng": 90.4125,
  "dropoffAddress": "Recipient Address",
  "dropoffLat": 23.7507,
  "dropoffLng": 90.3767,
  "parcelDescription": "Electronics package - fragile",
  "serviceFare": 150.00,
  "paymentMethod": "online"
}
```

**Response (201):**
```json
{
  "message": "Parcel delivery requested successfully",
  "delivery": {
    "id": "uuid",
    "pickupAddress": "Sender Address",
    "dropoffAddress": "Recipient Address",
    "parcelDescription": "Electronics package - fragile",
    "serviceFare": 150.00,
    "paymentMethod": "online",
    "status": "requested",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### GET `/api/deliveries/:id`
Get delivery details (customer, driver, or admin).

#### PATCH `/api/deliveries/:id/accept` (Driver only)
Accept delivery request.

**Requirements:**
- Driver must be verified and online
- Delivery status must be "requested" or "searching_driver"

#### PATCH `/api/deliveries/:id/status`
Update delivery status.

**Valid Statuses:**
- requested
- searching_driver
- accepted
- picked_up
- on_the_way
- delivered
- cancelled

#### POST `/api/deliveries/:id/complete`
Complete delivery with rating (customer and driver both rate).

**Commission Logic:**
- 20% commission
- Same as ride-hailing logic

---

## 💰 Commission & Wallet Details

### Ride-Hailing & Parcel Delivery

**Commission Rate:** 20%

**Cash Payment Example ($250 ride):**
1. Customer pays driver $250 in cash
2. System calculates:
   - SafeGo commission: $50 (20%)
   - Driver payout: $200 (80%)
3. Driver wallet updates:
   - `negativeBalance` increases by $50
   - Driver now owes SafeGo $50
4. Driver can continue working with negative balance
5. Admin settles $50 when driver pays SafeGo

**Online Payment Example ($250 ride):**
1. Customer pays $250 via online payment
2. System calculates:
   - SafeGo commission: $50 (20%)
   - Driver payout: $200 (80%)
3. Driver wallet updates:
   - `balance` increases by $200
4. SafeGo receives $250 from payment processor

### Food Delivery

**Commission Rates:**
- Restaurant: 15%
- Delivery: 5%
- Total: 20%

**Online Payment Example ($200 order):**
1. Customer pays $200 via online payment
2. System calculates:
   - Restaurant payout: $170 (85%)
   - Delivery payout: $10 (5%)
   - SafeGo commission: $40 (20%)
3. Wallet updates:
   - Restaurant `balance` increases by $170
   - Driver `balance` increases by $10

**Cash Payment Example ($200 order):**
1. Customer pays restaurant $200 in cash
2. System calculates:
   - Restaurant commission: $30 (15%)
   - Delivery payout: $10 (5%)
3. Wallet updates:
   - Restaurant `negativeBalance` increases by $30
   - Driver `balance` increases by $10
4. Restaurant owes SafeGo $30

### Wallet Settlement

Admins can settle negative balances through `/api/admin/settle-wallet`:

```json
{
  "walletType": "driver",
  "walletId": "uuid",
  "settlementAmount": 50.00
}
```

This decrements the `negativeBalance` by the settlement amount.

---

## 🔒 Security & Authorization

### JWT Authentication
- All protected endpoints require `Authorization: Bearer {token}` header
- Tokens contain user ID and role
- Tokens are signed with `JWT_SECRET` environment variable

### Role-Based Access Control

| Endpoint | Allowed Roles |
|----------|---------------|
| `/api/driver/*` | driver |
| `/api/customer/*` | customer |
| `/api/restaurant/*` | restaurant |
| `/api/admin/*` | admin |
| `/api/rides` (POST) | customer |
| `/api/rides/:id/accept` | driver |
| `/api/food-orders` (POST) | customer |
| `/api/food-orders/:id/accept` | restaurant |
| `/api/food-orders/:id/assign-driver` | driver |
| `/api/deliveries` (POST) | customer |
| `/api/deliveries/:id/accept` | driver |

### Ownership Validation
- Users can only access their own data
- Drivers can only view rides they're assigned to
- Restaurants can only view orders for their restaurant
- Customers can only view their own orders/rides/deliveries
- Admins can view all data

### KYC Verification Requirements
- Drivers must be verified to go online and accept rides
- Customers must be verified to request services
- Restaurants must be verified to accept orders

---

## 🗄️ Database Schema

See `prisma/schema.prisma` for complete schema.

### Key Models

**User**
- id, email, password (hashed), role, countryCode, isBlocked

**DriverProfile**
- Country-specific KYC fields (BD: NID, father name; US: SSN, driver license)
- verificationStatus, isVerified, rejectionReason
- Relations: vehicle, stats, wallet

**CustomerProfile**
- Country-specific KYC fields
- verificationStatus, isVerified

**RestaurantProfile**
- restaurantName, address
- verificationStatus, isVerified
- Relations: wallet

**Vehicle**
- vehicleType, vehicleModel, vehiclePlate
- isOnline, totalEarnings

**DriverWallet / RestaurantWallet**
- balance (positive from online payments)
- negativeBalance (owed to SafeGo from cash payments)

**Ride / FoodOrder / Delivery**
- Service details (locations, fare, items, etc.)
- serviceFare, safegoCommission, driverPayout/restaurantPayout
- paymentMethod, status
- customerRating, driverRating/restaurantRating
- feedback fields

---

## 🚀 Running the Backend

### Environment Variables

Create `.env` file:

```env
DATABASE_URL=postgresql://user:password@host:port/database
JWT_SECRET=your-secret-key-change-in-production
NODE_ENV=development
```

### Installation

```bash
npm install
```

### Database Setup

```bash
npx prisma generate
npx prisma db push
```

### Development

```bash
npm run dev
```

Server runs on http://localhost:5000

### Production

```bash
npm run build
npm start
```

---

## 📝 Testing

See `test-backend.md` for comprehensive testing guide with curl commands covering:

1. User creation (all roles)
2. Authentication and token retrieval
3. Admin KYC approval workflow
4. Driver vehicle registration and going online
5. Complete ride flow (request → accept → complete → commission applied)
6. Complete food order flow (order → accept → assign driver → deliver → commission)
7. Complete parcel delivery flow
8. Wallet settlement

---

## 📊 Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Resource created |
| 400 | Bad request (validation error, missing fields) |
| 401 | Unauthorized (missing or invalid token) |
| 403 | Forbidden (insufficient permissions, not verified) |
| 404 | Resource not found |
| 500 | Internal server error |

---

## 🔄 Status Flow Diagrams

### Ride Flow
```
requested → searching_driver → accepted → driver_arriving 
→ in_progress → completed
```

### Food Order Flow
```
placed → accepted → preparing → ready_for_pickup 
→ picked_up → on_the_way → delivered → completed (after ratings)
```

### Parcel Delivery Flow
```
requested → searching_driver → accepted → picked_up 
→ on_the_way → delivered → completed (after ratings)
```

---

## 📞 Support

For issues or questions, refer to the test documentation in `test-backend.md` or review the endpoint documentation above.

---

## 🎯 Next Phase Features (Planned)

1. Real-time driver location tracking
2. Matching algorithm for ride/delivery requests
3. Dynamic pricing with surge pricing
4. Notification push service integration (Firebase FCM)
5. Restaurant menu management system
6. Analytics dashboard with earnings reports and trip history
