# SafeGo API Documentation

Complete reference for all API endpoints in the SafeGo platform.

---

## Table of Contents

1. [Authentication](#authentication)
2. [Customer Endpoints](#customer-endpoints)
3. [Driver Endpoints](#driver-endpoints)
4. [Restaurant Endpoints](#restaurant-endpoints)
5. [Admin Endpoints](#admin-endpoints)
6. [Ride Service](#ride-service)
7. [Food Order Service](#food-order-service)
8. [Delivery Service](#delivery-service)
9. [Error Responses](#error-responses)

---

## Base URL

```
Development: http://localhost:5000/api
Production: https://your-domain.com/api
```

## Authentication

All endpoints (except signup/login) require a JWT token in the Authorization header:

```http
Authorization: Bearer <your_jwt_token>
```

---

## Authentication Endpoints

### POST /api/auth/signup

Create a new user account with role-specific profile.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "role": "customer",
  "countryCode": "US"
}
```

**Fields:**
- `email` (string, required): User email address
- `password` (string, required): Plain text password (will be hashed)
- `role` (string, required): One of: `customer`, `driver`, `restaurant`, `admin`
- `countryCode` (string, required): One of: `BD` (Bangladesh), `US` (United States)

**Response (201):**
```json
{
  "message": "User created successfully",
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "user@example.com",
    "role": "customer",
    "countryCode": "US"
  }
}
```

---

### POST /api/auth/login

Authenticate user and receive JWT token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response (200):**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "user@example.com",
    "role": "customer",
    "countryCode": "US"
  }
}
```

**Token Expiration:** 7 days

---

## Customer Endpoints

### PATCH /api/customer/profile

Update customer KYC profile information.

**Auth Required:** Yes (Customer role)

**Request Body (Bangladesh):**
```json
{
  "dateOfBirth": "1990-01-15",
  "fatherName": "John Doe Sr.",
  "presentAddress": "123 Main St, Dhaka",
  "permanentAddress": "456 Village Rd, Chittagong",
  "nidNumber": "1234567890123",
  "nidFrontImageUrl": "https://example.com/nid-front.jpg",
  "nidBackImageUrl": "https://example.com/nid-back.jpg",
  "emergencyContactName": "Jane Doe",
  "emergencyContactPhone": "+8801712345678"
}
```

**Request Body (USA):**
```json
{
  "dateOfBirth": "1990-01-15",
  "homeAddress": "123 Main St, New York, NY 10001",
  "governmentIdType": "drivers_license",
  "governmentIdLast4": "1234",
  "emergencyContactName": "Jane Doe",
  "emergencyContactPhone": "+1-555-123-4567"
}
```

**Response (200):**
```json
{
  "message": "Profile updated successfully",
  "profile": { /* updated profile object */ }
}
```

---

### GET /api/customer/home

Get customer dashboard data.

**Auth Required:** Yes (Customer role)

**Response (200):**
```json
{
  "profile": {
    "id": "profile-id",
    "email": "customer@example.com",
    "countryCode": "US",
    "verificationStatus": "approved",
    "isVerified": true
  }
}
```

---

## Driver Endpoints

### GET /api/driver/home

Get driver dashboard data including vehicle, stats, and wallet.

**Auth Required:** Yes (Driver role)

**Response (200):**
```json
{
  "profile": {
    "id": "driver-profile-id",
    "email": "driver@example.com",
    "countryCode": "BD",
    "verificationStatus": "approved",
    "isVerified": true
  },
  "vehicle": {
    "id": "vehicle-id",
    "vehicleType": "motorcycle",
    "vehicleModel": "Honda CBR",
    "vehiclePlate": "DHK-1234",
    "isOnline": false,
    "totalEarnings": 5000.00
  },
  "stats": {
    "rating": 4.8,
    "totalTrips": 150
  },
  "wallet": {
    "balance": 2500.50,
    "negativeBalance": 0.00
  }
}
```

---

### POST /api/driver/vehicle

Register a new vehicle for the driver.

**Auth Required:** Yes (Driver role)

**Request Body:**
```json
{
  "vehicleType": "motorcycle",
  "vehicleModel": "Honda CBR 150",
  "vehiclePlate": "DHK-1234",
  "vehicleColor": "Red"
}
```

**Fields:**
- `vehicleType`: `motorcycle`, `car`, `van`, `truck`
- `vehicleModel`: String (e.g., "Honda CBR 150")
- `vehiclePlate`: License plate number
- `vehicleColor`: Vehicle color

**Response (201):**
```json
{
  "message": "Vehicle registered successfully",
  "vehicle": { /* vehicle object */ }
}
```

---

### PATCH /api/driver/vehicle

Update existing vehicle information.

**Auth Required:** Yes (Driver role)

**Request Body:**
```json
{
  "vehicleType": "car",
  "vehicleModel": "Toyota Corolla",
  "vehiclePlate": "DHK-5678"
}
```

---

### PATCH /api/driver/profile

Update driver KYC profile.

**Auth Required:** Yes (Driver role)

**Request Body (Bangladesh):**
```json
{
  "dateOfBirth": "1985-03-20",
  "fatherName": "Ahmed Khan",
  "presentAddress": "789 Road, Dhaka",
  "permanentAddress": "321 Village, Sylhet",
  "nidNumber": "9876543210987",
  "drivingLicenseNumber": "DL-123456",
  "emergencyContactName": "Fatima Khan",
  "emergencyContactPhone": "+8801812345678"
}
```

**Request Body (USA):**
```json
{
  "dateOfBirth": "1985-03-20",
  "homeAddress": "456 Elm St, Los Angeles, CA",
  "driversLicenseNumber": "D1234567",
  "driversLicenseState": "CA",
  "ssnLast4": "5678",
  "emergencyContactName": "John Smith",
  "emergencyContactPhone": "+1-555-987-6543"
}
```

---

### PATCH /api/driver/status

Toggle driver online/offline status.

**Auth Required:** Yes (Driver role)

**Request Body:**
```json
{
  "isOnline": true
}
```

**Response (200):**
```json
{
  "message": "Status updated successfully",
  "isOnline": true
}
```

---

## Restaurant Endpoints

### GET /api/restaurant/home

Get restaurant dashboard data.

**Auth Required:** Yes (Restaurant role)

**Response (200):**
```json
{
  "profile": {
    "id": "restaurant-profile-id",
    "email": "restaurant@example.com",
    "restaurantName": "Tasty Bites",
    "address": "123 Food Street, Dhaka",
    "countryCode": "BD",
    "verificationStatus": "approved",
    "isVerified": true
  },
  "wallet": {
    "balance": -500.00,
    "negativeBalance": 500.00
  }
}
```

**Note:** Negative balance indicates commission owed to SafeGo.

---

### PATCH /api/restaurant/profile

Update restaurant information.

**Auth Required:** Yes (Restaurant role)

**Request Body:**
```json
{
  "restaurantName": "Updated Restaurant Name",
  "address": "New address with full details"
}
```

---

## Admin Endpoints

### GET /api/admin/pending-kyc

Get list of users with pending KYC verification.

**Auth Required:** Yes (Admin role)

**Query Parameters:**
- `role` (optional): Filter by role (`driver`, `customer`, `restaurant`)

**Response (200):**
```json
{
  "pending": {
    "drivers": [
      {
        "userId": "user-id",
        "profileId": "profile-id",
        "email": "driver@example.com",
        "role": "driver",
        "countryCode": "BD",
        "verificationStatus": "pending",
        "createdAt": "2024-01-15T10:30:00Z"
      }
    ],
    "customers": [ /* similar structure */ ],
    "restaurants": [ /* similar structure */ ]
  }
}
```

---

### PATCH /api/admin/kyc/:userId

Approve or reject user KYC verification.

**Auth Required:** Yes (Admin role)

**Request Body:**
```json
{
  "action": "approve",
  "rejectionReason": null
}
```

**Fields:**
- `action`: `approve` or `reject`
- `rejectionReason`: Required if action is `reject`

**Response (200):**
```json
{
  "message": "KYC approved successfully"
}
```

---

### PATCH /api/admin/block/:userId

Block or unblock a user account.

**Auth Required:** Yes (Admin role)

**Request Body:**
```json
{
  "isBlocked": true,
  "blockReason": "Violation of terms of service"
}
```

---

### GET /api/admin/users

Get list of all users with filtering.

**Auth Required:** Yes (Admin role)

**Query Parameters:**
- `role` (optional): Filter by role
- `countryCode` (optional): Filter by country
- `isBlocked` (optional): Filter blocked users

**Response (200):**
```json
{
  "users": [
    {
      "id": "user-id",
      "email": "user@example.com",
      "role": "customer",
      "countryCode": "US",
      "isBlocked": false,
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

---

### POST /api/admin/settle-wallet

Settle driver or restaurant wallet (reset to zero).

**Auth Required:** Yes (Admin role)

**Request Body:**
```json
{
  "walletType": "driver",
  "walletId": "wallet-id"
}
```

**Fields:**
- `walletType`: `driver` or `restaurant`
- `walletId`: ID of the wallet to settle

---

## Ride Service

### POST /api/rides

Create a new ride request.

**Auth Required:** Yes (Customer role)

**Request Body:**
```json
{
  "pickupAddress": "123 Main St, Dhaka",
  "pickupLat": 23.8103,
  "pickupLng": 90.4125,
  "dropoffAddress": "456 Park Ave, Dhaka",
  "dropoffLat": 23.7900,
  "dropoffLng": 90.4000,
  "serviceFare": 250.00,
  "paymentMethod": "cash"
}
```

**Fields:**
- `paymentMethod`: `cash` or `online`
- Coordinates must be valid floats

**Response (201):**
```json
{
  "message": "Ride requested successfully",
  "ride": {
    "id": "ride-id",
    "status": "requested",
    "serviceFare": 250.00,
    "safegoCommission": 50.00,
    "driverPayout": 200.00
  }
}
```

---

### GET /api/rides/:id

Get ride details by ID.

**Auth Required:** Yes

**Response (200):**
```json
{
  "ride": {
    "id": "ride-id",
    "status": "completed",
    "pickupAddress": "123 Main St",
    "dropoffAddress": "456 Park Ave",
    "serviceFare": 250.00,
    "paymentMethod": "cash",
    "driver": {
      "id": "driver-id",
      "name": "Driver Name"
    }
  }
}
```

---

### PATCH /api/rides/:id/accept

Driver accepts a ride request.

**Auth Required:** Yes (Driver role)

**Response (200):**
```json
{
  "message": "Ride accepted successfully",
  "ride": { /* updated ride */ }
}
```

---

### PATCH /api/rides/:id/status

Update ride status.

**Auth Required:** Yes (Driver role)

**Request Body:**
```json
{
  "status": "in_progress"
}
```

**Valid Status Flow:**
`requested` → `accepted` → `in_progress` → `completed`

---

### POST /api/rides/:id/complete

Mark ride as completed and update wallets.

**Auth Required:** Yes (Driver role)

**Response (200):**
```json
{
  "message": "Ride completed successfully",
  "ride": {
    "status": "completed",
    "completedAt": "2024-01-15T15:30:00Z"
  }
}
```

---

## Food Order Service

### POST /api/food-orders

Create a new food order.

**Auth Required:** Yes (Customer role)

**Request Body:**
```json
{
  "restaurantId": "restaurant-profile-id",
  "deliveryAddress": "123 Main St, Dhaka",
  "deliveryLat": 23.8103,
  "deliveryLng": 90.4125,
  "items": [
    {
      "name": "Burger",
      "quantity": 2,
      "price": 150.00
    },
    {
      "name": "Fries",
      "quantity": 1,
      "price": 50.00
    }
  ],
  "serviceFare": 100.00,
  "paymentMethod": "cash"
}
```

**Commission Structure:**
- Total: 100.00
- Restaurant gets: 75.00 (75%)
- Driver delivery fee: 5.00 (5%)
- SafeGo commission: 20.00 (20%)

---

### GET /api/food-orders/:id

Get food order details.

**Auth Required:** Yes

---

### PATCH /api/food-orders/:id/accept

Restaurant accepts food order.

**Auth Required:** Yes (Restaurant role)

---

### PATCH /api/food-orders/:id/assign-driver

Assign driver to deliver food order.

**Auth Required:** Yes (Restaurant or Admin role)

**Request Body:**
```json
{
  "driverId": "driver-profile-id"
}
```

---

### PATCH /api/food-orders/:id/status

Update food order status.

**Auth Required:** Yes (Restaurant or Driver role)

**Request Body:**
```json
{
  "status": "preparing"
}
```

**Valid Status Flow:**
`pending` → `accepted` → `preparing` → `ready` → `delivering` → `delivered`

---

### POST /api/food-orders/:id/complete

Complete food order and update wallets.

**Auth Required:** Yes (Driver role)

---

## Delivery Service

### POST /api/deliveries

Create parcel delivery request.

**Auth Required:** Yes (Customer role)

**Request Body:**
```json
{
  "pickupAddress": "123 Main St",
  "pickupLat": 23.8103,
  "pickupLng": 90.4125,
  "dropoffAddress": "456 Park Ave",
  "dropoffLat": 23.7900,
  "dropoffLng": 90.4000,
  "parcelDescription": "Documents in envelope",
  "serviceFare": 150.00,
  "paymentMethod": "cash"
}
```

---

### GET /api/deliveries/:id

Get delivery details.

---

### PATCH /api/deliveries/:id/accept

Driver accepts delivery request.

---

### PATCH /api/deliveries/:id/status

Update delivery status.

**Valid Status Flow:**
`requested` → `accepted` → `picked_up` → `in_transit` → `delivered`

---

### POST /api/deliveries/:id/complete

Complete delivery and update wallets.

---

## Error Responses

### Standard Error Format

```json
{
  "error": "Error message description"
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created successfully |
| 400 | Bad request (validation error) |
| 401 | Unauthorized (invalid/missing token) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Resource not found |
| 500 | Internal server error |

### Common Error Messages

```json
// Authentication errors
{ "error": "Token required" }
{ "error": "Invalid token" }
{ "error": "Access denied: insufficient permissions" }

// Validation errors
{ "error": "All fields are required" }
{ "error": "Invalid email or password" }
{ "error": "User with this email already exists" }

// Authorization errors
{ "error": "Only customers can request rides" }
{ "error": "Only admins can access this endpoint" }

// Resource errors
{ "error": "User not found" }
{ "error": "Ride not found" }
{ "error": "Customer must be verified to request rides" }
```

---

## Rate Limiting

Currently no rate limiting is implemented. For production deployment, consider:

- 100 requests per 15 minutes per IP
- 1000 requests per hour per authenticated user
- Stricter limits for signup/login endpoints

---

## Notes

- All timestamps are in ISO 8601 format (UTC)
- All monetary values are in local currency (BDT for BD, USD for US)
- Coordinates use standard latitude/longitude format
- JWT tokens expire after 7 days
- All routes (except /auth) require authentication

---

For implementation details, see:
- [Database Schema](./DATABASE_SCHEMA.md)
- [Setup Guide](./SETUP.md)
- [Demo Accounts](./DEMO_ACCOUNTS.md)
