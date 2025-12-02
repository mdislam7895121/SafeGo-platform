import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { prisma } from "../lib/prisma";
import { logAuditEvent, ActionType, EntityType, getClientIp } from "../utils/audit";
import { getAdminCapabilities } from "../utils/permissions";
import { loadAdminProfile, AuthRequest, authenticateToken, JWTPayload } from "../middleware/auth";
import { rateLimitAdminLogin, resetLoginAttempts } from "../middleware/rateLimit";
import { isTwoFactorEnabled, verifyTwoFactorToken, getTwoFactorSecret } from "../services/twoFactorService";

const router = Router();

// Defense in depth: Fail fast if JWT_SECRET missing in production
if (!process.env.JWT_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("FATAL: JWT_SECRET environment variable is not set. Application cannot start without authentication secret.");
}
const JWT_SECRET = process.env.JWT_SECRET || "safego-secret-key-change-in-production";

// Separate secret for refresh tokens (derived from JWT_SECRET for simplicity)
const REFRESH_SECRET = crypto.createHash('sha256').update(JWT_SECRET + '-refresh').digest('hex');

// Token expiry configuration
const ACCESS_TOKEN_EXPIRY = '15m';  // Short-lived access token
const REFRESH_TOKEN_EXPIRY = '30d'; // Long-lived refresh token

// Generate access token (short-lived)
function generateAccessToken(payload: { userId: string; role: string; countryCode: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

// Generate refresh token (long-lived)
function generateRefreshToken(userId: string): string {
  return jwt.sign({ userId, type: 'refresh' }, REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
}

// Set refresh token in HTTP-only cookie
function setRefreshTokenCookie(res: any, token: string): void {
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('safego_refresh_token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    path: '/api/auth'
  });
}

// Clear refresh token cookie
function clearRefreshTokenCookie(res: any): void {
  res.clearCookie('safego_refresh_token', { path: '/api/auth' });
}

// ====================================================
// POST /api/auth/signup
// Create new user with role-specific profile
// BD-only roles (ticket_operator, shop_partner) are assigned as pending_* 
// until admin approval after onboarding completion
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
    const requestedRole = role || "driver";

    // Validate role (accept both final and pending role names for BD roles)
    const validRoles = ["customer", "driver", "restaurant", "admin", "ticket_operator", "shop_partner"];
    if (!validRoles.includes(requestedRole)) {
      return res.status(400).json({ error: "Invalid role. Must be: customer, driver, restaurant, admin, ticket_operator, or shop_partner" });
    }

    // BD-only role validation
    const bdOnlyRoles = ["ticket_operator", "shop_partner"];
    if (bdOnlyRoles.includes(requestedRole) && countryCode !== "BD") {
      return res.status(400).json({ error: `${requestedRole} role is only available in Bangladesh` });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: "User with this email already exists" });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // For BD-only roles, assign pending_* role instead of final role
    // This ensures users must complete onboarding and get admin approval
    let userRole = requestedRole;
    if (requestedRole === "ticket_operator") {
      userRole = "pending_ticket_operator";
    } else if (requestedRole === "shop_partner") {
      userRole = "pending_shop_partner";
    }

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
    if (requestedRole === "driver") {
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
    } else if (requestedRole === "customer") {
      await prisma.customerProfile.create({
        data: {
          userId: user.id,
          verificationStatus: "pending",
          isVerified: false,
        },
      });
    } else if (requestedRole === "restaurant") {
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
    } else if (requestedRole === "admin") {
      await prisma.adminProfile.create({
        data: {
          userId: user.id,
        },
      });
    }
    // Note: For pending_ticket_operator and pending_shop_partner, we don't create profiles
    // during signup. Profiles are created during onboarding form submission.

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
    // Also include BD role profiles for verification status routing
    const user = await prisma.user.findUnique({
      where: { email },
      include: { 
        adminProfile: true,
        ticketOperator: true,
        shopPartner: true,
      },
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

      return res.status(403).json({ error: "Your account has been blocked. Please contact support." });
    }

    // Check for temporary lockout from too many failed attempts (15-minute window)
    const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
    const MAX_FAILED_ATTEMPTS = 5;

    if (user.temporaryLockUntil && new Date(user.temporaryLockUntil) > new Date()) {
      const minutesRemaining = Math.ceil((new Date(user.temporaryLockUntil).getTime() - Date.now()) / 60000);
      
      await logAuditEvent({
        actorId: user.id,
        actorEmail: user.email,
        actorRole: user.role,
        ipAddress: getClientIp(req),
        actionType: ActionType.LOGIN_FAILED,
        entityType: EntityType.AUTH,
        entityId: user.id,
        description: `Login attempt for temporarily locked account ${user.email}`,
        success: false,
      });

      return res.status(429).json({ 
        error: `Too many failed attempts. Please try again in ${minutesRemaining} minute${minutesRemaining > 1 ? 's' : ''} or lock your account from profile and contact support if this wasn't you.`,
        code: "TEMPORARY_LOCKOUT",
        retryAfter: minutesRemaining * 60
      });
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
      // Track failed login attempts for rate limiting
      const now = new Date();
      const fifteenMinutesAgo = new Date(now.getTime() - LOCKOUT_DURATION_MS);
      
      // Reset counter if last failure was more than 15 minutes ago
      const currentAttempts = user.lastFailedLoginAt && user.lastFailedLoginAt > fifteenMinutesAgo
        ? (user.failedLoginAttempts || 0) + 1
        : 1;

      // Update failed attempt counter
      const updateData: any = {
        failedLoginAttempts: currentAttempts,
        lastFailedLoginAt: now,
      };

      // Apply temporary lockout if max attempts exceeded
      if (currentAttempts >= MAX_FAILED_ATTEMPTS) {
        updateData.temporaryLockUntil = new Date(now.getTime() + LOCKOUT_DURATION_MS);
      }

      await prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });

      // Log failed login attempt - invalid password (audit)
      await logAuditEvent({
        actorId: user.id,
        actorEmail: user.email,
        actorRole: user.role,
        ipAddress: getClientIp(req),
        actionType: ActionType.LOGIN_FAILED,
        entityType: EntityType.AUTH,
        entityId: user.id,
        description: `Failed login attempt for ${user.email} - invalid password (attempt ${currentAttempts}/${MAX_FAILED_ATTEMPTS})`,
        success: false,
      });

      // Show lockout message if this attempt triggered the lockout
      if (currentAttempts >= MAX_FAILED_ATTEMPTS) {
        return res.status(429).json({ 
          error: "Too many failed attempts. Please try again in 15 minutes or lock your account from profile and contact support if this wasn't you.",
          code: "TEMPORARY_LOCKOUT",
          retryAfter: 15 * 60
        });
      }

      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Successful password verification - reset failed attempt counter
    if (user.failedLoginAttempts > 0 || user.temporaryLockUntil) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lastFailedLoginAt: null,
          temporaryLockUntil: null,
        },
      });
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
      }
    }

    // Generate tokens - short-lived access token + long-lived refresh token
    const accessToken = generateAccessToken({
      userId: user.id,
      role: user.role,
      countryCode: user.countryCode,
    });
    const refreshToken = generateRefreshToken(user.id);

    // Set refresh token in HTTP-only cookie
    setRefreshTokenCookie(res, refreshToken);

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

    // Build response with admin capabilities if admin user
    const response: any = {
      token: accessToken,
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

    // Add BD role profile information for routing
    // Handle both final roles and pending roles for consistent profile data
    if ((user.role === 'ticket_operator' || user.role === 'pending_ticket_operator') && user.ticketOperator) {
      response.user.profile = {
        verificationStatus: user.ticketOperator.verificationStatus,
        isActive: user.ticketOperator.isActive,
      };
    }

    if ((user.role === 'shop_partner' || user.role === 'pending_shop_partner') && user.shopPartner) {
      response.user.profile = {
        verificationStatus: user.shopPartner.verificationStatus,
        isActive: user.shopPartner.isActive,
      };
    }

    res.json(response);
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Failed to login" });
  }
});

// ====================================================
// POST /api/auth/refresh
// Refresh access token using refresh token from cookie
// ====================================================
router.post("/refresh", async (req, res) => {
  try {
    const refreshToken = req.cookies?.safego_refresh_token;

    if (!refreshToken) {
      return res.status(401).json({ error: "No refresh token provided" });
    }

    // Verify refresh token
    let decoded: { userId: string; type: string };
    try {
      decoded = jwt.verify(refreshToken, REFRESH_SECRET) as { userId: string; type: string };
    } catch (err) {
      clearRefreshTokenCookie(res);
      return res.status(401).json({ error: "Invalid or expired refresh token" });
    }

    if (decoded.type !== 'refresh') {
      clearRefreshTokenCookie(res);
      return res.status(401).json({ error: "Invalid token type" });
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, role: true, countryCode: true, isBlocked: true },
    });

    if (!user) {
      clearRefreshTokenCookie(res);
      return res.status(401).json({ error: "User not found" });
    }

    if (user.isBlocked) {
      clearRefreshTokenCookie(res);
      return res.status(403).json({ error: "Account is blocked" });
    }

    // Generate new access token
    const newAccessToken = generateAccessToken({
      userId: user.id,
      role: user.role,
      countryCode: user.countryCode,
    });

    // Optionally rotate refresh token for added security
    const newRefreshToken = generateRefreshToken(user.id);
    setRefreshTokenCookie(res, newRefreshToken);

    res.json({ token: newAccessToken });
  } catch (error) {
    console.error("Token refresh error:", error);
    clearRefreshTokenCookie(res);
    res.status(500).json({ error: "Failed to refresh token" });
  }
});

// ====================================================
// POST /api/auth/logout
// Log user logout event for audit trail (Security Phase 3)
// ====================================================
router.post("/logout", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.userId;
    const role = req.user?.role;
    
    // Clear refresh token cookie
    clearRefreshTokenCookie(res);
    
    // Get user details for audit log
    const user = userId ? await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, role: true },
    }) : null;
    
    // Log customer logout event (Security Phase 3 audit requirement)
    await logAuditEvent({
      actorId: userId,
      actorEmail: user?.email || 'unknown',
      actorRole: role || 'unknown',
      ipAddress: getClientIp(req),
      actionType: ActionType.LOGOUT,
      entityType: EntityType.AUTH,
      entityId: userId,
      description: `User ${user?.email || 'unknown'} (${role || 'unknown'}) logged out`,
      metadata: { role, logoutType: 'user_initiated' },
      success: true,
    });
    
    res.json({ message: "Logout recorded successfully" });
  } catch (error) {
    console.error("Logout audit error:", error);
    // Still return success - don't block logout even if audit fails
    clearRefreshTokenCookie(res);
    res.json({ message: "Logout recorded" });
  }
});

// ====================================================
// GET /api/auth/me
// Get current authenticated user with capabilities
// ====================================================
router.get("/me", authenticateToken, loadAdminProfile, async (req: AuthRequest, res) => {
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
