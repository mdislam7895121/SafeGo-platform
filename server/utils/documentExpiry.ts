import { PrismaClient } from "@prisma/client";
import { notifyDocumentExpiring, notifyDocumentExpired } from "./notifications";

const prisma = new PrismaClient();

const DAYS_BEFORE_EXPIRY_WARNING = 30;

/**
 * Calculate days until a date
 */
function daysUntil(date: Date): number {
  const now = new Date();
  const target = new Date(date);
  const diff = target.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Check if a document is expiring soon (within 30 days) or expired
 */
function getDocumentStatus(expiryDate: Date | null): {
  isExpiring: boolean;
  isExpired: boolean;
  daysUntil: number;
} {
  if (!expiryDate) {
    return { isExpiring: false, isExpired: false, daysUntil: 0 };
  }

  const days = daysUntil(expiryDate);
  
  return {
    isExpiring: days >= 0 && days <= DAYS_BEFORE_EXPIRY_WARNING,
    isExpired: days < 0,
    daysUntil: days,
  };
}

/**
 * Check driver documents for expiry
 */
async function checkDriverDocuments() {
  try {
    // Get all drivers with their associated user and vehicle data
    const drivers = await prisma.driverProfile.findMany({
      include: {
        user: true,
        vehicle: true,
      },
    });

    for (const driver of drivers) {
      const { user } = driver;
      const countryCode = user.countryCode;
      const email = user.email;

      // Bangladesh: Check NID expiry (if present in schema and has expiry date)
      // Note: Current schema doesn't have NID expiry, but we check for future compatibility
      
      // USA: Check DMV License Expiry
      if (countryCode === "US" && driver.dmvLicenseExpiry) {
        const status = getDocumentStatus(new Date(driver.dmvLicenseExpiry));
        
        if (status.isExpired) {
          await notifyDocumentExpired({
            entityType: "driver",
            entityId: driver.id,
            countryCode,
            email,
            documentType: "DMV License",
            expiryDate: new Date(driver.dmvLicenseExpiry),
          });
        } else if (status.isExpiring) {
          await notifyDocumentExpiring({
            entityType: "driver",
            entityId: driver.id,
            countryCode,
            email,
            documentType: "DMV License",
            expiryDate: new Date(driver.dmvLicenseExpiry),
            daysUntilExpiry: status.daysUntil,
          });
        }
      }

      // USA: Check TLC License Expiry (for NY drivers)
      if (countryCode === "US" && driver.tlcLicenseExpiry) {
        const status = getDocumentStatus(new Date(driver.tlcLicenseExpiry));
        
        if (status.isExpired) {
          await notifyDocumentExpired({
            entityType: "driver",
            entityId: driver.id,
            countryCode,
            email,
            documentType: "TLC License",
            expiryDate: new Date(driver.tlcLicenseExpiry),
          });
        } else if (status.isExpiring) {
          await notifyDocumentExpiring({
            entityType: "driver",
            entityId: driver.id,
            countryCode,
            email,
            documentType: "TLC License",
            expiryDate: new Date(driver.tlcLicenseExpiry),
            daysUntilExpiry: status.daysUntil,
          });
        }
      }

      // Check vehicle documents (if driver has a vehicle)
      if (driver.vehicle) {
        const vehicle = driver.vehicle;

        // Check Vehicle Registration Expiry
        if (vehicle.registrationExpiry) {
          const status = getDocumentStatus(new Date(vehicle.registrationExpiry));
          
          if (status.isExpired) {
            await notifyDocumentExpired({
              entityType: "driver",
              entityId: driver.id,
              countryCode,
              email,
              documentType: "Vehicle Registration",
              expiryDate: new Date(vehicle.registrationExpiry),
            });
          } else if (status.isExpiring) {
            await notifyDocumentExpiring({
              entityType: "driver",
              entityId: driver.id,
              countryCode,
              email,
              documentType: "Vehicle Registration",
              expiryDate: new Date(vehicle.registrationExpiry),
              daysUntilExpiry: status.daysUntil,
            });
          }
        }

        // Check Vehicle Insurance Expiry
        if (vehicle.insuranceExpiry) {
          const status = getDocumentStatus(new Date(vehicle.insuranceExpiry));
          
          if (status.isExpired) {
            await notifyDocumentExpired({
              entityType: "driver",
              entityId: driver.id,
              countryCode,
              email,
              documentType: "Vehicle Insurance",
              expiryDate: new Date(vehicle.insuranceExpiry),
            });
          } else if (status.isExpiring) {
            await notifyDocumentExpiring({
              entityType: "driver",
              entityId: driver.id,
              countryCode,
              email,
              documentType: "Vehicle Insurance",
              expiryDate: new Date(vehicle.insuranceExpiry),
              daysUntilExpiry: status.daysUntil,
            });
          }
        }

        // Check DMV Inspection Expiry
        if (vehicle.dmvInspectionExpiry) {
          const status = getDocumentStatus(new Date(vehicle.dmvInspectionExpiry));
          
          if (status.isExpired) {
            await notifyDocumentExpired({
              entityType: "driver",
              entityId: driver.id,
              countryCode,
              email,
              documentType: "DMV Inspection",
              expiryDate: new Date(vehicle.dmvInspectionExpiry),
            });
          } else if (status.isExpiring) {
            await notifyDocumentExpiring({
              entityType: "driver",
              entityId: driver.id,
              countryCode,
              email,
              documentType: "DMV Inspection",
              expiryDate: new Date(vehicle.dmvInspectionExpiry),
              daysUntilExpiry: status.daysUntil,
            });
          }
        }
      }
    }
  } catch (error) {
    console.error("Error checking driver documents:", error);
  }
}

/**
 * Check restaurant documents for expiry
 */
async function checkRestaurantDocuments() {
  try {
    // Get all restaurants with their user data
    const restaurants = await prisma.restaurantProfile.findMany({
      include: {
        user: true,
      },
    });

    for (const restaurant of restaurants) {
      const { user } = restaurant;
      const countryCode = user.countryCode;
      const email = user.email;

      // Check restaurant license expiry (if present in schema)
      if (restaurant.licenseExpiry) {
        const status = getDocumentStatus(new Date(restaurant.licenseExpiry));
        
        if (status.isExpired) {
          await notifyDocumentExpired({
            entityType: "restaurant",
            entityId: restaurant.id,
            countryCode,
            email,
            documentType: "Restaurant License",
            expiryDate: new Date(restaurant.licenseExpiry),
          });
        } else if (status.isExpiring) {
          await notifyDocumentExpiring({
            entityType: "restaurant",
            entityId: restaurant.id,
            countryCode,
            email,
            documentType: "Restaurant License",
            expiryDate: new Date(restaurant.licenseExpiry),
            daysUntilExpiry: status.daysUntil,
          });
        }
      }
    }
  } catch (error) {
    console.error("Error checking restaurant documents:", error);
  }
}

/**
 * Main function to check all document expiry across the system
 * This should be called periodically (e.g., daily) or on-demand
 */
export async function checkAllDocumentExpiry(): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    console.log("Starting document expiry check...");
    
    await checkDriverDocuments();
    await checkRestaurantDocuments();
    
    console.log("Document expiry check completed successfully.");
    
    return {
      success: true,
      message: "Document expiry check completed successfully",
    };
  } catch (error) {
    console.error("Error in document expiry check:", error);
    return {
      success: false,
      message: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
