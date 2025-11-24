import { prisma } from "../db";
import { WalletOwnerType } from "@prisma/client";

export interface BankAccountDetails {
  accountHolderName: string;
  accountNumber: string;
  routingNumber?: string; // For US banks
  swiftCode?: string; // For international transfers
  bankName: string;
  branchName?: string; // For BD banks
  mobileWalletNumber?: string; // For BD mobile wallets (bKash, Nagad, Rocket)
}

export interface VerifyBankAccountParams {
  ownerId: string;
  ownerType: WalletOwnerType;
  countryCode: "BD" | "US";
  payoutType: "mobile_wallet" | "bank_account" | "stripe_connect";
  accountDetails: BankAccountDetails;
}

export interface KYCValidationResult {
  isValid: boolean;
  errors: string[];
  kycLevel: "NONE" | "BASIC" | "FULL";
}

export class BankVerificationService {
  /**
   * Verify KYC requirements for payout accounts
   */
  async validateKYCForPayout(params: VerifyBankAccountParams): Promise<KYCValidationResult> {
    const { ownerId, ownerType, countryCode } = params;

    const errors: string[] = [];
    let kycLevel: "NONE" | "BASIC" | "FULL" = "NONE";

    // Get profile based on owner type
    const profile = await this.getOwnerProfile(ownerId, ownerType);

    if (!profile) {
      return {
        isValid: false,
        errors: ["Profile not found"],
        kycLevel: "NONE",
      };
    }

    // Check if profile is verified
    if (!profile.isVerified || profile.verificationStatus !== "approved") {
      errors.push("Account must be KYC verified before adding payout methods");
    }

    // Country-specific KYC validation
    if (countryCode === "BD") {
      const bdValidation = this.validateBangladeshKYC(profile, params);
      errors.push(...bdValidation.errors);
      kycLevel = bdValidation.kycLevel;
    } else if (countryCode === "US") {
      const usValidation = this.validateUSKYC(profile, params);
      errors.push(...usValidation.errors);
      kycLevel = usValidation.kycLevel;
    } else {
      errors.push("Unsupported country code for payout verification");
    }

    return {
      isValid: errors.length === 0,
      errors,
      kycLevel,
    };
  }

  /**
   * Bangladesh KYC validation
   */
  private validateBangladeshKYC(
    profile: any,
    params: VerifyBankAccountParams
  ): { errors: string[]; kycLevel: "NONE" | "BASIC" | "FULL" } {
    const errors: string[] = [];
    let kycLevel: "NONE" | "BASIC" | "FULL" = "BASIC";

    // Required fields for Bangladesh
    const requiredFields = [
      { field: "nidNumber", name: "National ID Number" },
      { field: "presentAddress", name: "Present Address" },
      { field: "fatherName", name: "Father's Name" },
    ];

    for (const { field, name } of requiredFields) {
      if (!profile[field]) {
        errors.push(`${name} is required for Bangladesh KYC verification`);
      }
    }

    // Validate NID format (10 or 13 digits for Bangladesh)
    if (profile.nidNumber) {
      const nidLength = profile.nidNumber.replace(/\s/g, "").length;
      if (nidLength !== 10 && nidLength !== 13 && nidLength !== 17) {
        errors.push("Invalid NID format. Must be 10, 13, or 17 digits");
      } else {
        kycLevel = "FULL";
      }
    }

    // Validate mobile wallet number for mobile_wallet type
    if (params.payoutType === "mobile_wallet") {
      const { mobileWalletNumber } = params.accountDetails;
      if (!mobileWalletNumber) {
        errors.push("Mobile wallet number is required");
      } else if (!this.isValidBDMobileNumber(mobileWalletNumber)) {
        errors.push("Invalid Bangladesh mobile number format");
      }
    }

    // Validate bank account for bank_account type
    if (params.payoutType === "bank_account") {
      const { accountNumber, bankName } = params.accountDetails;
      if (!accountNumber || !bankName) {
        errors.push("Bank account number and bank name are required");
      }
      if (accountNumber && (accountNumber.length < 10 || accountNumber.length > 20)) {
        errors.push("Invalid bank account number length");
      }
    }

    return { errors, kycLevel };
  }

  /**
   * USA KYC validation
   */
  private validateUSKYC(
    profile: any,
    params: VerifyBankAccountParams
  ): { errors: string[]; kycLevel: "NONE" | "BASIC" | "FULL" } {
    const errors: string[] = [];
    let kycLevel: "NONE" | "BASIC" | "FULL" = "BASIC";

    // Required fields for USA
    const requiredFields = [
      { field: "governmentIdType", name: "Government ID Type" },
      { field: "governmentIdNumber", name: "Government ID Number" },
      { field: "homeAddress", name: "Home Address" },
      { field: "usaState", name: "State" },
    ];

    for (const { field, name } of requiredFields) {
      if (!profile[field]) {
        errors.push(`${name} is required for USA KYC verification`);
      }
    }

    // Validate SSN format if provided (XXX-XX-XXXX)
    if (profile.ssnLast4) {
      if (!/^\d{4}$/.test(profile.ssnLast4)) {
        errors.push("Invalid SSN last 4 digits format");
      } else {
        kycLevel = "FULL";
      }
    }

    // Validate bank account details
    if (params.payoutType === "bank_account") {
      const { accountNumber, routingNumber, accountHolderName } = params.accountDetails;

      if (!accountNumber || !routingNumber || !accountHolderName) {
        errors.push("Account number, routing number, and account holder name are required");
      }

      // Validate routing number (9 digits for USA)
      if (routingNumber && !/^\d{9}$/.test(routingNumber)) {
        errors.push("Invalid routing number. Must be 9 digits");
      }

      // Validate account number (typically 8-17 digits)
      if (accountNumber && (accountNumber.length < 8 || accountNumber.length > 17)) {
        errors.push("Invalid account number length");
      }
    }

    // Stripe Connect requires full KYC
    if (params.payoutType === "stripe_connect") {
      if (!profile.ssnLast4) {
        errors.push("SSN last 4 digits required for Stripe Connect");
      }
      if (!profile.dateOfBirth) {
        errors.push("Date of birth required for Stripe Connect");
      }
    }

    return { errors, kycLevel };
  }

  /**
   * Get owner profile based on type
   */
  private async getOwnerProfile(ownerId: string, ownerType: WalletOwnerType) {
    switch (ownerType) {
      case "driver":
        return await prisma.driverProfile.findUnique({
          where: { id: ownerId },
          include: { user: true },
        });

      case "restaurant":
        return await prisma.restaurantProfile.findUnique({
          where: { id: ownerId },
          include: { user: true },
        });

      case "customer":
        return await prisma.customerProfile.findUnique({
          where: { id: ownerId },
          include: { user: true },
        });

      default:
        return null;
    }
  }

  /**
   * Validate Bangladesh mobile number format
   */
  private isValidBDMobileNumber(number: string): boolean {
    // BD mobile numbers: 01XXXXXXXXX (11 digits starting with 01)
    const cleaned = number.replace(/[^0-9]/g, "");
    
    // Check if it matches Bangladesh format
    if (/^01[3-9]\d{8}$/.test(cleaned)) {
      return true;
    }
    
    // Check if it includes country code +880
    if (/^8801[3-9]\d{8}$/.test(cleaned)) {
      return true;
    }

    return false;
  }

  /**
   * Create a verified payout account
   */
  async createVerifiedPayoutAccount(params: VerifyBankAccountParams) {
    // Validate KYC first
    const kycValidation = await this.validateKYCForPayout(params);

    if (!kycValidation.isValid) {
      throw new Error(
        `KYC validation failed: ${kycValidation.errors.join(", ")}`
      );
    }

    const { ownerId, ownerType, countryCode, payoutType, accountDetails } = params;

    // Create masked version of sensitive data
    const maskedAccount = this.maskAccountNumber(
      accountDetails.accountNumber || accountDetails.mobileWalletNumber || ""
    );

    // Encrypt sensitive data (simplified - in production, use proper encryption)
    const encryptedDetails = JSON.stringify(accountDetails);

    // Create payout account
    const payoutAccount = await prisma.payoutAccount.create({
      data: {
        ownerType,
        ownerId,
        countryCode,
        payoutType,
        provider: this.getProvider(payoutType, accountDetails),
        displayName: this.getDisplayName(payoutType, accountDetails),
        accountHolderName: accountDetails.accountHolderName,
        maskedAccount,
        encryptedDetails,
        accountNumber_encrypted: accountDetails.accountNumber,
        routingNumber_encrypted: accountDetails.routingNumber,
        status: kycValidation.kycLevel === "FULL" ? "verified" : "pending_verification",
        isDefault: false,
      },
    });

    return payoutAccount;
  }

  /**
   * Mask account number for display
   */
  private maskAccountNumber(number: string): string {
    if (number.length <= 4) {
      return number;
    }
    const last4 = number.slice(-4);
    const masked = "*".repeat(number.length - 4);
    return `${masked}${last4}`;
  }

  /**
   * Get provider name based on payout type
   */
  private getProvider(payoutType: string, details: BankAccountDetails): string {
    if (payoutType === "mobile_wallet") {
      // Detect BD mobile wallet provider
      const number = details.mobileWalletNumber || "";
      if (number.startsWith("01")) {
        // Common BD mobile wallet number patterns
        return "bKash/Nagad/Rocket";
      }
    }
    
    if (payoutType === "bank_account") {
      return details.bankName;
    }

    if (payoutType === "stripe_connect") {
      return "Stripe Connect";
    }

    return "Unknown";
  }

  /**
   * Get display name for payout account
   */
  private getDisplayName(payoutType: string, details: BankAccountDetails): string {
    if (payoutType === "mobile_wallet") {
      return `Mobile Wallet (${this.maskAccountNumber(details.mobileWalletNumber || "")})`;
    }

    if (payoutType === "bank_account") {
      return `${details.bankName} (${this.maskAccountNumber(details.accountNumber)})`;
    }

    if (payoutType === "stripe_connect") {
      return "Stripe Connect Account";
    }

    return "Payment Account";
  }
}

export const bankVerificationService = new BankVerificationService();
