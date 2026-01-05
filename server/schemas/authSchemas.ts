import { z } from "zod";

export const signupSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(1, "Confirm password is required"),
  fullName: z.string().min(1, "Full name is required").optional(),
  countryCode: z.enum(["BD", "US"]).optional(),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
  twoFactorCode: z.string().optional(),
});

export const otpRequestSchema = z.object({
  phone: z.string().optional(),
  phoneNumber: z.string().optional(),
  email: z.string().email("Invalid email format").optional(),
  countryCode: z.string().length(2).optional(),
  deviceId: z.string().optional(),
}).refine((data) => data.phone || data.phoneNumber || data.email, {
  message: "Phone number or email is required",
});

export const otpVerifySchema = z.object({
  phone: z.string().optional(),
  phoneNumber: z.string().optional(),
  email: z.string().email("Invalid email format").optional(),
  otp: z.string().min(4, "OTP is required").max(8),
  deviceId: z.string().optional(),
}).refine((data) => data.phone || data.phoneNumber || data.email, {
  message: "Phone number or email is required",
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
  confirmNewPassword: z.string().min(1, "Confirm new password is required"),
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: "Passwords do not match",
  path: ["confirmNewPassword"],
});
