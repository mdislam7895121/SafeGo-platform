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

    // Required: Present address and father's name
    const commonRequiredFields = [
      { field: "presentAddress", name: "Present Address" },
      { field: "fatherName", name: "Father's Name" },
    ];

    for (const { field, name } of commonRequiredFields) {
      if (!profile[field]) {
        errors.push(`${name} is required for Bangladesh KYC verification`);
      }
    }

    // Required: NID OR Passport (at least one must be provided)
    const hasNID = profile.nidNumber && profile.nidNumber.trim() !== "";
    const hasPassport = profile.passportNumber && profile.passportNumber.trim() !== "";

    if (!hasNID && !hasPassport) {
      errors.push("Either National ID (NID) or Passport number is required for Bangladesh KYC");
    }

    // Track if identity documents are valid
    let hasValidNID = false;
    let hasValidPassport = false;

    // Validate NID format if provided (10, 13, or 17 digits for Bangladesh)
    if (hasNID) {
      const nidLength = profile.nidNumber.replace(/\s/g, "").length;
      if (nidLength !== 10 && nidLength !== 13 && nidLength !== 17) {
        errors.push("Invalid NID format. Must be 10, 13, or 17 digits");
      } else {
        hasValidNID = true;
      }
    }

    // Validate Passport format if provided (typically 8-9 alphanumeric characters)
    if (hasPassport) {
      if (!/^[A-Z0-9]{8,9}$/i.test(profile.passportNumber.trim())) {
        errors.push("Invalid Passport format. Must be 8-9 alphanumeric characters");
      } else {
        hasValidPassport = true;
      }
    }

    // RESTAURANT-SPECIFIC: Business license required for FULL KYC
    if (params.ownerType === "restaurant") {
      const hasBusinessLicense = profile.businessLicenseNumber && profile.businessLicenseNumber.trim() !== "";
      
      if (!hasBusinessLicense) {
        errors.push("Business license number is required for restaurant payout accounts");
      }
      
      // Only grant FULL KYC if restaurant has VALID identity document AND business license
      if ((hasValidNID || hasValidPassport) && hasBusinessLicense) {
        kycLevel = "FULL";
      }
    } else {
      // For drivers/customers: FULL KYC only requires VALID identity document
      if (hasValidNID || hasValidPassport) {
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

    // Track if tax documents are valid
    let hasValidEIN = false;
    let hasValidSSN = false;

    // RESTAURANT-SPECIFIC: EIN required for FULL KYC
    if (params.ownerType === "restaurant") {
      const hasEIN = profile.taxIdNumber && profile.taxIdNumber.trim() !== "";
      
      if (!hasEIN) {
        errors.push("Employer Identification Number (EIN) is required for restaurant payout accounts");
      } else {
        // Validate EIN format (XX-XXXXXXX, 9 digits)
        const einClean = profile.taxIdNumber.replace(/-/g, "");
        if (!/^\d{9}$/.test(einClean)) {
          errors.push("Invalid EIN format. Must be 9 digits (XX-XXXXXXX)");
        } else {
          hasValidEIN = true;
        }
      }

      // Restaurants can optionally provide SSN as fallback if EIN is unavailable
      const hasSSN = profile.ssnLast4 && profile.ssnLast4.trim() !== "";
      if (hasSSN && !/^\d{4}$/.test(profile.ssnLast4)) {
        errors.push("Invalid SSN last 4 digits format. Must be exactly 4 digits");
      } else if (hasSSN) {
        hasValidSSN = true;
      }

      // Grant FULL KYC if either valid EIN OR valid SSN is provided
      if (hasValidEIN || hasValidSSN) {
        kycLevel = "FULL";
      }
    } else {
      // DRIVER/CUSTOMER-SPECIFIC: SSN last 4 required (NOT optional) for FULL KYC
      if (!profile.ssnLast4 || profile.ssnLast4.trim() === "") {
        errors.push("SSN last 4 digits are required for USA payout accounts");
      } else {
        // Validate SSN last 4 format (XXXX, 4 digits)
        if (!/^\d{4}$/.test(profile.ssnLast4)) {
          errors.push("Invalid SSN last 4 digits format. Must be exactly 4 digits");
        } else {
          hasValidSSN = true;
          kycLevel = "FULL";
        }
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
      if (params.ownerType !== "restaurant" && !profile.ssnLast4) {
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
