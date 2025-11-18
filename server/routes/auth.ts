import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "safego-secret-key-change-in-production";

// ====================================================
// POST /api/auth/signup
// Create new user with role-specific profile
// ====================================================
router.post("/signup", async (req, res) => {
  try {
    const { email, password, role, countryCode } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    if (!countryCode || !["BD", "US"].includes(countryCode)) {
      return res.status(400).json({ error: "Valid countryCode (BD or US) is required" });
    }

    // Default role to "driver" if not provided
    const userRole = role || "driver";

    // Validate role
    const validRoles = ["customer", "driver", "restaurant", "admin"];
    if (!validRoles.includes(userRole)) {
      return res.status(400).json({ error: "Invalid role. Must be: customer, driver, restaurant, or admin" });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: "User with this email already exists" });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user with appropriate profile
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: userRole,
        countryCode,
      },
    });

    // Create role-specific profile
    if (userRole === "driver") {
      await prisma.driverProfile.create({
        data: {
          userId: user.id,
          verificationStatus: "pending",
          isVerified: false,
        },
      });

      await prisma.driverStats.create({
        data: {
          driverId: (await prisma.driverProfile.findUnique({ where: { userId: user.id } }))!.id,
        },
      });

      await prisma.driverWallet.create({
        data: {
          driverId: (await prisma.driverProfile.findUnique({ where: { userId: user.id } }))!.id,
        },
      });
    } else if (userRole === "customer") {
      await prisma.customerProfile.create({
        data: {
          userId: user.id,
          verificationStatus: "pending",
          isVerified: false,
        },
      });
    } else if (userRole === "restaurant") {
      await prisma.restaurantProfile.create({
        data: {
          userId: user.id,
          restaurantName: email.split("@")[0], // Default name, can be updated later
          address: "", // To be filled during onboarding
          verificationStatus: "pending",
          isVerified: false,
        },
      });

      await prisma.restaurantWallet.create({
        data: {
          restaurantId: (await prisma.restaurantProfile.findUnique({ where: { userId: user.id } }))!.id,
        },
      });
    } else if (userRole === "admin") {
      await prisma.adminProfile.create({
        data: {
          userId: user.id,
        },
      });
    }

    res.status(201).json({
      message: "User created successfully",
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        countryCode: user.countryCode,
      },
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ error: "Failed to create user" });
  }
});

// ====================================================
// POST /api/auth/login
// Authenticate user and return JWT
// ====================================================
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Find user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Check if user is blocked
    if (user.isBlocked) {
      return res.status(403).json({ error: "Your account has been blocked. Please contact support." });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Generate JWT
    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role,
        countryCode: user.countryCode,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        countryCode: user.countryCode,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Failed to login" });
  }
});

export default router;
