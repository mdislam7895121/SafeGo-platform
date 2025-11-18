# SafeGo Backend Testing Guide

This document provides curl commands to test all backend endpoints.

## Setup: Create Test Users

### 1. Create Admin
```bash
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@safego.com",
    "password": "admin123",
    "role": "admin",
    "countryCode": "BD"
  }'
```

### 2. Create Driver (Bangladesh)
```bash
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "driver@safego.com",
    "password": "driver123",
    "role": "driver",
    "countryCode": "BD",
    "profile": {
      "dateOfBirth": "1990-01-01",
      "fatherName": "Test Father",
      "presentAddress": "123 Main St, Dhaka",
      "permanentAddress": "456 Home St, Dhaka",
      "nidNumber": "1234567890",
      "emergencyContactName": "Emergency Contact",
      "emergencyContactPhone": "+8801234567890"
    }
  }'
```

### 3. Create Customer (US)
```bash
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "customer@safego.com",
    "password": "customer123",
    "role": "customer",
    "countryCode": "US",
    "profile": {
      "dateOfBirth": "1995-05-15",
      "homeAddress": "789 Oak Ave, New York, NY",
      "governmentIdType": "passport",
      "governmentIdLast4": "1234",
      "emergencyContactName": "Emergency Contact",
      "emergencyContactPhone": "+1234567890"
    }
  }'
```

### 4. Create Restaurant (BD)
```bash
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "restaurant@safego.com",
    "password": "restaurant123",
    "role": "restaurant",
    "countryCode": "BD",
    "profile": {
      "restaurantName": "Tasty Bites",
      "address": "123 Food Street, Dhaka"
    }
  }'
```

## Login and Get Tokens

### Admin Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@safego.com",
    "password": "admin123"
  }'
# Save the token as ADMIN_TOKEN
```

### Driver Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "driver@safego.com",
    "password": "driver123"
  }'
# Save the token as DRIVER_TOKEN
```

### Customer Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "customer@safego.com",
    "password": "customer123"
  }'
# Save the token as CUSTOMER_TOKEN
```

### Restaurant Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "restaurant@safego.com",
    "password": "restaurant123"
  }'
# Save the token as RESTAURANT_TOKEN
```

## Admin: Approve KYC

### Get Pending KYC
```bash
curl -X GET http://localhost:5000/api/admin/pending-kyc \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Approve Driver KYC
```bash
curl -X PATCH http://localhost:5000/api/admin/kyc/{userId} \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "verificationStatus": "approved"
  }'
```

### Approve Customer KYC
```bash
curl -X PATCH http://localhost:5000/api/admin/kyc/{userId} \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "verificationStatus": "approved"
  }'
```

### Approve Restaurant KYC
```bash
curl -X PATCH http://localhost:5000/api/admin/kyc/{userId} \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "verificationStatus": "approved"
  }'
```

## Driver: Register Vehicle

```bash
curl -X POST http://localhost:5000/api/driver/vehicle \
  -H "Authorization: Bearer $DRIVER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "vehicleType": "sedan",
    "vehicleModel": "Toyota Corolla 2020",
    "vehiclePlate": "DHK-1234"
  }'
```

## Driver: Go Online

```bash
curl -X PATCH http://localhost:5000/api/driver/status \
  -H "Authorization: Bearer $DRIVER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "isOnline": true
  }'
```

## Test Ride Flow

### 1. Customer: Request Ride
```bash
curl -X POST http://localhost:5000/api/rides \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "pickupAddress": "Location A",
    "pickupLat": 23.8103,
    "pickupLng": 90.4125,
    "dropoffAddress": "Location B",
    "dropoffLat": 23.7507,
    "dropoffLng": 90.3767,
    "serviceFare": 250,
    "paymentMethod": "cash"
  }'
# Save ride ID
```

### 2. Driver: Accept Ride
```bash
curl -X PATCH http://localhost:5000/api/rides/{rideId}/accept \
  -H "Authorization: Bearer $DRIVER_TOKEN"
```

### 3. Driver: Update Status to In Progress
```bash
curl -X PATCH http://localhost:5000/api/rides/{rideId}/status \
  -H "Authorization: Bearer $DRIVER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "in_progress"
  }'
```

### 4. Customer: Rate Driver (Complete from customer side)
```bash
curl -X POST http://localhost:5000/api/rides/{rideId}/complete \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rating": 5,
    "feedback": "Great driver!"
  }'
```

### 5. Driver: Rate Customer (Complete from driver side - triggers commission)
```bash
curl -X POST http://localhost:5000/api/rides/{rideId}/complete \
  -H "Authorization: Bearer $DRIVER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rating": 5,
    "feedback": "Nice passenger!"
  }'
```

### 6. Check Driver Wallet (should have negative balance for cash payment)
```bash
curl -X GET http://localhost:5000/api/driver/home \
  -H "Authorization: Bearer $DRIVER_TOKEN"
```

## Test Food Order Flow

### 1. Customer: Create Food Order
```bash
curl -X POST http://localhost:5000/api/food-orders \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "restaurantId": "{restaurantProfileId}",
    "deliveryAddress": "123 Home St",
    "deliveryLat": 23.8103,
    "deliveryLng": 90.4125,
    "items": [
      {"name": "Burger", "quantity": 2, "price": 150},
      {"name": "Fries", "quantity": 1, "price": 50}
    ],
    "serviceFare": 200,
    "paymentMethod": "online"
  }'
# Save order ID
```

### 2. Restaurant: Accept Order
```bash
curl -X PATCH http://localhost:5000/api/food-orders/{orderId}/accept \
  -H "Authorization: Bearer $RESTAURANT_TOKEN"
```

### 3. Restaurant: Update Status to Ready for Pickup
```bash
curl -X PATCH http://localhost:5000/api/food-orders/{orderId}/status \
  -H "Authorization: Bearer $RESTAURANT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "ready_for_pickup"
  }'
```

### 4. Driver: Accept Delivery Assignment
```bash
curl -X PATCH http://localhost:5000/api/food-orders/{orderId}/assign-driver \
  -H "Authorization: Bearer $DRIVER_TOKEN"
```

### 5. Driver: Update Status to Delivered
```bash
curl -X PATCH http://localhost:5000/api/food-orders/{orderId}/status \
  -H "Authorization: Bearer $DRIVER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "delivered"
  }'
```

### 6. Customer: Rate Restaurant
```bash
curl -X POST http://localhost:5000/api/food-orders/{orderId}/complete \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rating": 5,
    "feedback": "Delicious food!"
  }'
```

### 7. Restaurant: Rate Customer (triggers commission)
```bash
curl -X POST http://localhost:5000/api/food-orders/{orderId}/complete \
  -H "Authorization: Bearer $RESTAURANT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rating": 5,
    "feedback": "Good customer!"
  }'
```

### 8. Check Restaurant Wallet (should have positive balance for online payment)
```bash
curl -X GET http://localhost:5000/api/restaurant/home \
  -H "Authorization: Bearer $RESTAURANT_TOKEN"
```

## Test Parcel Delivery Flow

### 1. Customer: Request Delivery
```bash
curl -X POST http://localhost:5000/api/deliveries \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "pickupAddress": "Location A",
    "pickupLat": 23.8103,
    "pickupLng": 90.4125,
    "dropoffAddress": "Location B",
    "dropoffLat": 23.7507,
    "dropoffLng": 90.3767,
    "parcelDescription": "Electronics package",
    "serviceFare": 150,
    "paymentMethod": "online"
  }'
```

### 2. Driver: Accept Delivery
```bash
curl -X PATCH http://localhost:5000/api/deliveries/{deliveryId}/accept \
  -H "Authorization: Bearer $DRIVER_TOKEN"
```

### 3. Driver: Update Status to Delivered
```bash
curl -X PATCH http://localhost:5000/api/deliveries/{deliveryId}/status \
  -H "Authorization: Bearer $DRIVER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "delivered"
  }'
```

### 4. Complete Delivery (both rate)
```bash
curl -X POST http://localhost:5000/api/deliveries/{deliveryId}/complete \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rating": 5,
    "feedback": "Fast delivery!"
  }'

curl -X POST http://localhost:5000/api/deliveries/{deliveryId}/complete \
  -H "Authorization: Bearer $DRIVER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rating": 5,
    "feedback": "Good customer!"
  }'
```

## Admin: Settle Negative Balance

```bash
curl -X POST http://localhost:5000/api/admin/settle-wallet \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "walletType": "driver",
    "walletId": "{driverWalletId}",
    "settlementAmount": 50
  }'
```

## Expected Commission Calculations

### Ride (Cash - $250)
- SafeGo Commission: $50 (20%)
- Driver Payout: $200
- **Driver gets full $250 cash, negative balance increases by $50**

### Food Order (Online - $200)
- SafeGo Commission: $40 (20% = 15% restaurant + 5% delivery)
- Restaurant Payout: $170 (85%)
- Delivery Payout: $10 (5%)
- **Restaurant balance increases by $170, driver by $10**

### Parcel (Online - $150)
- SafeGo Commission: $30 (20%)
- Driver Payout: $120
- **Driver balance increases by $120**
