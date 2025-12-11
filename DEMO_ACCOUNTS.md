# SafeGo Demo Accounts

Pre-configured test accounts for exploring all features of the SafeGo platform.

---

## Demo Credentials

All demo accounts use the password: **`demo123`**

### Customer Accounts

| Email | Country | Password | Purpose |
|-------|---------|----------|---------|
| customer.bd@demo.com | Bangladesh | demo123 | Test BD KYC flow |
| customer.us@demo.com | USA | demo123 | Test US KYC flow |

### Driver Accounts

| Email | Country | Password | Purpose |
|-------|---------|----------|---------|
| driver.bd@demo.com | Bangladesh | demo123 | Test BD driver features |
| driver.us@demo.com | USA | demo123 | Test US driver features |

### Restaurant Accounts

| Email | Country | Password | Purpose |
|-------|---------|----------|---------|
| restaurant.bd@demo.com | Bangladesh | demo123 | Test restaurant panel |
| restaurant.us@demo.com | USA | demo123 | Test US restaurant |

### Admin Account

| Email | Country | Password | Purpose |
|-------|---------|----------|---------|
| admin@demo.com | USA | demo123 | Test admin features |

---

## Quick Start

### 1. Seed Demo Data

If you haven't already, run the seed script:

```bash
npm run seed
```

This creates all demo accounts with proper profiles.

### 2. Access the Application

Navigate to:
```
http://localhost:5000
```

### 3. Login

Click "Login" and use any demo account credentials.

---

## Test Flows

### Customer Flow

**Test Account:** `customer.us@demo.com` / `demo123`

1. **Login**
   - Go to `/login`
   - Enter credentials
   - Verify redirect to `/customer`

2. **Request a Ride**
   - Click "Request Ride" card
   - Fill in pickup/dropoff addresses
   - Enter coordinates (e.g., 23.8103, 90.4125)
   - Set fare amount (e.g., 250)
   - Select payment method (Cash)
   - Submit request

3. **Order Food**
   - Click "Order Food" card
   - Select a restaurant
   - Enter delivery address and coordinates
   - Add items to cart
   - Submit order

4. **Send Parcel**
   - Click "Send Parcel" card
   - Enter pickup/dropoff locations
   - Describe parcel contents
   - Set delivery fee
   - Submit request

5. **View Activity**
   - Navigate to "My Activity"
   - See all past rides, food orders, deliveries
   - Check status of pending requests

---

### Driver Flow

**Test Account:** `driver.us@demo.com` / `demo123`

1. **Login**
   - Go to `/login`
   - Enter credentials
   - Verify redirect to `/driver`

2. **Register Vehicle** (First Time Only)
   - Click "Register Vehicle"
   - Select vehicle type (motorcycle, car, van)
   - Enter vehicle model (e.g., "Honda CBR 150")
   - Enter license plate
   - Submit

3. **Go Online**
   - Toggle "Online Status" switch
   - Verify status changes to "Online"
   - Vehicle is now available for rides

4. **Accept Jobs** (Manual Testing)
   - View pending ride requests
   - Click "Accept" on a ride
   - Update status through ride flow:
     - Accepted → In Progress → Completed

5. **View Earnings**
   - Check wallet balance
   - See total earnings
   - View negative balance (if cash payments)

6. **Complete KYC** (if pending)
   - Navigate to "Profile"
   - Fill Bangladesh or US KYC fields
   - Submit for admin approval

---

### Restaurant Flow

**Test Account:** `restaurant.bd@demo.com` / `demo123`

1. **Login**
   - Go to `/login`
   - Enter credentials
   - Verify redirect to `/restaurant`

2. **View Dashboard**
   - See verification status badge
   - Check wallet balance (may be negative due to commission)
   - View pending food orders

3. **Update Profile**
   - Click "Edit Profile"
   - Update restaurant name
   - Update address
   - Save changes

4. **Manage Orders** (Manual Testing)
   - View incoming food orders
   - Click "Accept" on an order
   - Update order status:
     - Pending → Accepted → Preparing → Ready → (driver picks up)
   - Mark as complete when delivered

5. **Check Commission**
   - View wallet balance
   - Negative balance = commission owed to SafeGo
   - Example: $100 order = -$20 negative balance

---

### Admin Flow

**Test Account:** `admin@demo.com` / `demo123`

1. **Login**
   - Go to `/login`
   - Enter credentials
   - Verify redirect to `/admin`

2. **KYC Approval**
   - Navigate to "KYC Verification"
   - Switch between tabs (Drivers, Customers, Restaurants)
   - View pending verification requests
   - Click "Approve" or "Reject" on profiles
   - Add rejection reason if rejecting

3. **User Management**
   - Go to "All Users"
   - Filter by role (customer, driver, restaurant)
   - Filter by country (BD, US)
   - View user details
   - Block/unblock users

4. **Wallet Settlement**
   - Navigate to "Wallet Management"
   - View drivers with positive balances (SafeGo owes them)
   - View restaurants with negative balances (they owe SafeGo)
   - Click "Settle" to reset wallet to zero
   - Confirm settlement

---

## Testing Scenarios

### Scenario 1: Complete Ride Flow

**Players:** 1 Customer, 1 Driver

1. **Customer** requests ride
   - Login as `customer.us@demo.com`
   - Request ride with pickup/dropoff
   - Note ride ID

2. **Driver** accepts and completes
   - Login as `driver.us@demo.com`
   - View pending rides
   - Accept the ride
   - Update status: In Progress → Completed

3. **Verify Commission**
   - Check driver wallet (should increase by 80% of fare)
   - If cash payment: check negative balance (20% commission)

---

### Scenario 2: Food Order with Commission

**Players:** 1 Customer, 1 Restaurant, 1 Driver

1. **Customer** places food order
   - Login as customer
   - Select restaurant (use restaurant.bd@demo.com's profile ID)
   - Add items totaling $100
   - Submit order

2. **Restaurant** accepts order
   - Login as `restaurant.bd@demo.com`
   - Accept the order
   - Update status: Preparing → Ready

3. **Driver** delivers
   - Login as driver
   - Assign to delivery
   - Pick up from restaurant
   - Deliver to customer

4. **Verify Commissions**
   - Restaurant wallet: -$20 (commission owed)
   - Driver wallet: +$5 (delivery fee)
   - SafeGo: $20 commission collected

---

### Scenario 3: KYC Approval Process

**Players:** 1 Driver, 1 Admin

1. **Driver** submits KYC
   - Login as new driver account
   - Fill KYC form (BD or US fields)
   - Submit for verification

2. **Admin** reviews and approves
   - Login as admin
   - Go to KYC page
   - Find driver in pending list
   - Review submitted information
   - Click "Approve"

3. **Driver** verification confirmed
   - Login as driver again
   - See "Verified" badge
   - Now able to accept rides

---

## Common Test Data

### Sample Addresses (Bangladesh)

```
Pickup: Dhanmondi 32, Dhaka
Coordinates: 23.7465, 90.3765

Dropoff: Gulshan 2, Dhaka
Coordinates: 23.7925, 90.4078
```

### Sample Addresses (USA)

```
Pickup: Times Square, New York, NY
Coordinates: 40.7580, -73.9855

Dropoff: Central Park, New York, NY
Coordinates: 40.7829, -73.9654
```

### Sample Food Items

```json
[
  { "name": "Chicken Burger", "quantity": 2, "price": 8.99 },
  { "name": "French Fries", "quantity": 1, "price": 3.49 },
  { "name": "Coca Cola", "quantity": 2, "price": 1.99 }
]
```

---

## Known Behaviors

### KYC Pending List
- Newly created accounts appear in KYC list only after filling profile
- Empty profiles don't show up (backend behavior)
- Solution: Fill at least basic KYC info to appear in admin list

### Wallet Balance
- Negative balance is normal for restaurants (commission owed)
- Drivers may have negative balance with cash payments
- Admin can settle wallets to zero

### Vehicle Requirement
- Drivers must register a vehicle before going online
- One vehicle per driver
- Can update vehicle info anytime

---

## Reset Demo Data

To reset all demo accounts to fresh state:

```bash
# Reset database (WARNING: Deletes all data)
npx prisma db push --force-reset

# Re-seed demo accounts
npm run seed
```

---

## Creating Your Own Test Accounts

### Via API

```bash
# Customer signup
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpass123",
    "role": "customer",
    "countryCode": "US"
  }'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpass123"
  }'
```

### Via Frontend

1. Go to `/signup`
2. Fill registration form
3. Select role and country
4. Submit

---

## Troubleshooting

### Issue: Cannot login with demo account

**Solution:**
- Verify demo accounts exist: `npm run seed`
- Check password is exactly: `demo123`
- Clear browser localStorage

### Issue: Driver cannot go online

**Solution:**
- Ensure vehicle is registered
- Check verification status (must be approved)

### Issue: Orders not appearing in restaurant panel

**Solution:**
- Verify order was created with correct restaurant ID
- Check restaurant verification status

---

For API details, see:
- [API Documentation](./API_DOCUMENTATION.md)
- [Database Schema](./DATABASE_SCHEMA.md)
