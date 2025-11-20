import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { PrismaClient, FraudEventType, ActorType } from "@prisma/client";
import { logAuditEvent, ActionType, EntityType, getClientIp } from "../utils/audit";
import { getAdminCapabilities } from "../utils/permissions";
import { loadAdminProfile, AuthRequest } from "../middleware/auth";
import { rateLimitAdminLogin, resetLoginAttempts } from "../middleware/rateLimit";
import { isTwoFactorEnabled, verifyTwoFactorToken, getTwoFactorSecret } from "../services/twoFactorService";
import { logFraudEvent, getDeviceId, getUserAgent, getLocationFromRequest } from "../utils/fraudEvents";

const router = Router();
const prisma = new PrismaClient();

// Defense in depth: Fail fast if JWT_SECRET missing in production
if (!process.env.JWT_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("FATAL: JWT_SECRET environment variable is not set. Application cannot start without authentication secret.");
}
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

    // Log successful signup as fraud event for pattern analysis
    await logFraudEvent({
      eventType: FraudEventType.ACCOUNT_CREATED,
      actorType: userRole === "customer" ? ActorType.customer :
                 userRole === "driver" ? ActorType.driver :
                 userRole === "restaurant" ? ActorType.restaurant :
                 ActorType.admin,
      actorId: user.id,
      ipAddress: getClientIp(req),
      deviceId: getDeviceId(req),
      userAgent: getUserAgent(req),
      location: getLocationFromRequest(req),
      metadata: {
        email: user.email,
        role: user.role,
        countryCode: user.countryCode,
      },
      source: "auth_signup",
    });

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
// Rate-limited for admin users, with 2FA support
// ====================================================
router.post("/login", async (req, res, next) => {
  try {
    const { email, password, twoFactorCode } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Find user first to determine if admin (for rate limiting)
    const user = await prisma.user.findUnique({
      where: { email },
      include: { adminProfile: true },
    });
    
    // Apply rate limiting for admin users BEFORE password check
    if (user && user.role === 'admin') {
      // Use a Promise to wrap the middleware since we can't use next() pattern
      const rateLimited = await new Promise<boolean>((resolve) => {
        rateLimitAdminLogin(req, res, () => resolve(false));
        // If response is sent by middleware, rate limit was exceeded
        setImmediate(() => {
          if (res.headersSent) resolve(true);
        });
      });
      
      if (rateLimited || res.headersSent) {
        return; // Rate limit exceeded, response already sent
      }
    }
    
    if (!user) {
      // Log failed login attempt (audit)
      await logAuditEvent({
        actorEmail: email,
        actorRole: "unknown",
        ipAddress: getClientIp(req),
        actionType: ActionType.LOGIN_FAILED,
        entityType: EntityType.AUTH,
        description: `Failed login attempt for ${email} - user not found`,
        success: false,
      });

      // Log failed login attempt (fraud detection)
      await logFraudEvent({
        eventType: FraudEventType.LOGIN,
        actorType: ActorType.customer, // Default to customer for unknown users
        actorId: "unknown",
        ipAddress: getClientIp(req),
        deviceId: getDeviceId(req),
        userAgent: getUserAgent(req),
        location: getLocationFromRequest(req),
        metadata: {
          email,
          reason: "user_not_found",
          success: false,
        },
        source: "auth_login",
      });

      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Check if user is blocked
    if (user.isBlocked) {
      // Log failed login attempt for blocked user (audit)
      await logAuditEvent({
        actorId: user.id,
        actorEmail: user.email,
        actorRole: user.role,
        ipAddress: getClientIp(req),
        actionType: ActionType.LOGIN_FAILED,
        entityType: EntityType.AUTH,
        entityId: user.id,
        description: `Failed login attempt for blocked user ${user.email}`,
        success: false,
      });

      // Log failed login attempt for blocked user (fraud detection)
      await logFraudEvent({
        eventType: FraudEventType.LOGIN,
        actorType: user.role === "customer" ? ActorType.customer :
                   user.role === "driver" ? ActorType.driver :
                   user.role === "restaurant" ? ActorType.restaurant :
                   ActorType.admin,
        actorId: user.id,
        ipAddress: getClientIp(req),
        deviceId: getDeviceId(req),
        userAgent: getUserAgent(req),
        location: getLocationFromRequest(req),
        metadata: {
          email: user.email,
          reason: "account_blocked",
          success: false,
        },
        source: "auth_login",
      });

      return res.status(403).json({ error: "Your account has been blocked. Please contact support." });
    }

    // For admin users, check if their admin account is active
    if (user.role === 'admin') {
      if (!user.adminProfile) {
        await logAuditEvent({
          actorId: user.id,
          actorEmail: user.email,
          actorRole: user.role,
          ipAddress: getClientIp(req),
          actionType: ActionType.LOGIN_FAILED,
          entityType: EntityType.AUTH,
          entityId: user.id,
          description: `Failed login attempt for ${user.email} - admin profile not found`,
          success: false,
        });
        return res.status(403).json({ error: "Admin profile not found. Please contact support." });
      }

      if (!user.adminProfile.isActive) {
        await logAuditEvent({
          actorId: user.id,
          actorEmail: user.email,
          actorRole: user.role,
          ipAddress: getClientIp(req),
          actionType: ActionType.LOGIN_FAILED,
          entityType: EntityType.AUTH,
          entityId: user.id,
          description: `Failed login attempt for deactivated admin ${user.email}`,
          success: false,
        });
        return res.status(403).json({ error: "Your admin account has been deactivated. Please contact support." });
      }
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      // Log failed login attempt - invalid password (audit)
      await logAuditEvent({
        actorId: user.id,
        actorEmail: user.email,
        actorRole: user.role,
        ipAddress: getClientIp(req),
        actionType: ActionType.LOGIN_FAILED,
        entityType: EntityType.AUTH,
        entityId: user.id,
        description: `Failed login attempt for ${user.email} - invalid password`,
        success: false,
      });

      // Log failed login attempt - invalid password (fraud detection)
      await logFraudEvent({
        eventType: FraudEventType.LOGIN,
        actorType: user.role === "customer" ? ActorType.customer :
                   user.role === "driver" ? ActorType.driver :
                   user.role === "restaurant" ? ActorType.restaurant :
                   ActorType.admin,
        actorId: user.id,
        ipAddress: getClientIp(req),
        deviceId: getDeviceId(req),
        userAgent: getUserAgent(req),
        location: getLocationFromRequest(req),
        metadata: {
          email: user.email,
          reason: "invalid_password",
          success: false,
        },
        source: "auth_login",
      });

      return res.status(401).json({ error: "Invalid credentials" });
    }

    // For admin users, verify 2FA if enabled
    if (user.role === 'admin' && user.adminProfile) {
      const twoFactorRequired = await isTwoFactorEnabled(user.adminProfile.id);
      
      if (twoFactorRequired) {
        if (!twoFactorCode) {
          return res.status(403).json({ 
            error: "Two-factor authentication code required",
            requiresTwoFactor: true 
          });
        }

        const secret = await getTwoFactorSecret(user.adminProfile.id);
        if (!secret) {
          await logAuditEvent({
            actorId: user.id,
            actorEmail: user.email,
            actorRole: user.role,
            ipAddress: getClientIp(req),
            actionType: ActionType.LOGIN_FAILED,
            entityType: EntityType.AUTH,
            entityId: user.id,
            description: `2FA verification failed for ${user.email} - secret not found`,
            success: false,
          });
          return res.status(500).json({ error: "2FA configuration error" });
        }

        const isValid2FA = verifyTwoFactorToken(twoFactorCode, secret);
        if (!isValid2FA) {
          // Log failed 2FA (audit)
          await logAuditEvent({
            actorId: user.id,
            actorEmail: user.email,
            actorRole: user.role,
            ipAddress: getClientIp(req),
            actionType: ActionType.LOGIN_FAILED,
            entityType: EntityType.AUTH,
            entityId: user.id,
            description: `Failed login attempt for ${user.email} - invalid 2FA code`,
            metadata: { twoFactorAttempt: true },
            success: false,
          });

          // Log failed 2FA (fraud detection)
          await logFraudEvent({
            eventType: FraudEventType.LOGIN,
            actorType: ActorType.admin,
            actorId: user.id,
            ipAddress: getClientIp(req),
            deviceId: getDeviceId(req),
            userAgent: getUserAgent(req),
            location: getLocationFromRequest(req),
            metadata: {
              email: user.email,
              reason: "invalid_2fa_code",
              twoFactorAttempt: true,
              success: false,
            },
            source: "auth_login",
          });

          return res.status(401).json({ error: "Invalid two-factor authentication code" });
        }

        // Log successful 2FA verification (audit)
        await logAuditEvent({
          actorId: user.id,
          actorEmail: user.email,
          actorRole: user.role,
          ipAddress: getClientIp(req),
          actionType: ActionType.LOGIN_SUCCESS,
          entityType: EntityType.AUTH,
          entityId: user.id,
          description: `Successful 2FA verification for admin ${user.email}`,
          metadata: { twoFactorVerified: true },
          success: true,
        });

        // Log successful 2FA verification (fraud detection)
        await logFraudEvent({
          eventType: FraudEventType.LOGIN,
          actorType: ActorType.admin,
          actorId: user.id,
          ipAddress: getClientIp(req),
          deviceId: getDeviceId(req),
          userAgent: getUserAgent(req),
          location: getLocationFromRequest(req),
          metadata: {
            email: user.email,
            twoFactorVerified: true,
            success: true,
          },
          source: "auth_login",
        });
      }
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

    // Log successful login (audit - especially important for admin users)
    await logAuditEvent({
      actorId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      ipAddress: getClientIp(req),
      actionType: ActionType.LOGIN_SUCCESS,
      entityType: EntityType.AUTH,
      entityId: user.id,
      description: `Successful login for ${user.role} user ${user.email}`,
      metadata: { role: user.role, countryCode: user.countryCode },
      success: true,
    });

    // Log successful login (fraud detection)
    await logFraudEvent({
      eventType: FraudEventType.LOGIN,
      actorType: user.role === "customer" ? ActorType.customer :
                 user.role === "driver" ? ActorType.driver :
                 user.role === "restaurant" ? ActorType.restaurant :
                 ActorType.admin,
      actorId: user.id,
      ipAddress: getClientIp(req),
      deviceId: getDeviceId(req),
      userAgent: getUserAgent(req),
      location: getLocationFromRequest(req),
      metadata: {
        email: user.email,
        role: user.role,
        countryCode: user.countryCode,
        success: true,
      },
      source: "auth_login",
    });

    // Build response with admin capabilities if admin user
    const response: any = {
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        countryCode: user.countryCode,
      },
    };

    // Add admin-specific information
    if (user.role === 'admin' && user.adminProfile) {
      response.user.adminRole = user.adminProfile.adminRole;
      response.user.isActive = user.adminProfile.isActive;
      response.user.twoFactorEnabled = user.adminProfile.twoFactorEnabled;
      response.capabilities = getAdminCapabilities({
        id: user.id,
        email: user.email,
        role: user.role,
        adminProfile: {
          adminRole: user.adminProfile.adminRole as any,
          isActive: user.adminProfile.isActive
        }
      });
      
      // Reset login attempts on successful admin authentication
      resetLoginAttempts(user.email, getClientIp(req) || 'unknown');
    }

    res.json(response);
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Failed to login" });
  }
});

// ====================================================
// GET /api/auth/me
// Get current authenticated user with capabilities
// ====================================================
router.get("/me", loadAdminProfile, async (req: AuthRequest, res) => {
  try {
    const authReq = req as AuthRequest;

    if (!authReq.adminUser) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const user = authReq.adminUser;
    const capabilities = getAdminCapabilities(user);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        adminRole: user.adminProfile?.adminRole,
        isActive: user.adminProfile?.isActive,
      },
      capabilities,
    });
  } catch (error) {
    console.error("Error fetching user info:", error);
    res.status(500).json({ error: "Failed to fetch user info" });
  }
});

export default router;
