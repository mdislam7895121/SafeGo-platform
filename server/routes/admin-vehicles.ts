import { Router, Response } from "express";
import { z } from "zod";
import { AuthRequest, loadAdminProfile, checkPermission } from "../middleware/auth";
import { authenticateToken, requireAdmin } from "../middleware/authz";
import { Permission } from "../utils/permissions";
import { logAuditEvent, ActionType, EntityType, getClientIp } from "../utils/audit";
import { 
  getAllVehiclesForCountry, 
  getVehicleKeysByCountry,
  isValidVehicleKeyForCountry,
  SupportedCountry 
} from "../../shared/vehicleCountryConfig";
import { BD_VEHICLE_TYPES, BDVehicleKey } from "../../shared/vehicleTypesBD";
import { USA_VEHICLE_TYPES, USAVehicleKey } from "../../shared/vehicleTypesUSA";

const router = Router();

router.use(authenticateToken);
router.use(requireAdmin());
router.use(loadAdminProfile);

const listQuerySchema = z.object({
  countryCode: z.enum(["BD", "US"]).optional().default("BD"),
  serviceType: z.enum(["ride", "food", "parcel"]).optional(),
});

const toggleSchema = z.object({
  is_enabled: z.boolean(),
});

const pricingSchema = z.object({
  base_fare: z.number().min(0),
  per_km: z.number().min(0),
  per_minute: z.number().min(0),
  minimum_fare: z.number().min(0),
  waiting_charge_per_min: z.number().min(0).optional(),
});

router.get("/", checkPermission(Permission.EDIT_SETTINGS), async (req: AuthRequest, res: Response) => {
  try {
    const query = listQuerySchema.parse(req.query);
    const countryCode = query.countryCode as SupportedCountry;
    
    const allVehicles = getAllVehiclesForCountry(countryCode);
    
    let filteredVehicles = allVehicles;
    if (query.serviceType) {
      filteredVehicles = allVehicles.filter(v => v.service_type === query.serviceType);
    }
    
    const vehiclesWithConfig = filteredVehicles.map(v => {
      let fullConfig: any = null;
      if (countryCode === "BD" && v.vehicle_key in BD_VEHICLE_TYPES) {
        fullConfig = BD_VEHICLE_TYPES[v.vehicle_key as BDVehicleKey];
      } else if (countryCode === "US" && v.vehicle_key in USA_VEHICLE_TYPES) {
        fullConfig = USA_VEHICLE_TYPES[v.vehicle_key as USAVehicleKey];
      }
      
      return {
        ...v,
        is_enabled: fullConfig?.is_enabled ?? true,
        is_time_based: fullConfig?.is_time_based ?? false,
        is_scheduled: fullConfig?.is_scheduled ?? false,
        fare_config: countryCode === "BD" ? fullConfig?.fare_config : null,
        fare_multipliers: countryCode === "US" ? fullConfig?.fare_multipliers : null,
        requirements: fullConfig?.requirements ?? null,
      };
    });
    
    res.json({
      success: true,
      country: countryCode,
      service_type: query.serviceType || "all",
      total: vehiclesWithConfig.length,
      vehicles: vehiclesWithConfig,
    });
  } catch (error: any) {
    console.error("[AdminVehicles] List error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid query parameters", details: error.errors });
    }
    res.status(500).json({ error: "Failed to fetch vehicles" });
  }
});

router.get("/:vehicleKey", checkPermission(Permission.EDIT_SETTINGS), async (req: AuthRequest, res: Response) => {
  try {
    const { vehicleKey } = req.params;
    const countryCode = (req.query.countryCode as SupportedCountry) || "BD";
    
    if (!isValidVehicleKeyForCountry(vehicleKey, countryCode)) {
      return res.status(404).json({ error: "Vehicle type not found for this country" });
    }
    
    let fullConfig: any = null;
    if (countryCode === "BD" && vehicleKey in BD_VEHICLE_TYPES) {
      fullConfig = BD_VEHICLE_TYPES[vehicleKey as BDVehicleKey];
    } else if (countryCode === "US" && vehicleKey in USA_VEHICLE_TYPES) {
      fullConfig = USA_VEHICLE_TYPES[vehicleKey as USAVehicleKey];
    }
    
    if (!fullConfig) {
      return res.status(404).json({ error: "Vehicle configuration not found" });
    }
    
    res.json({
      success: true,
      vehicle: fullConfig,
    });
  } catch (error: any) {
    console.error("[AdminVehicles] Get vehicle error:", error);
    res.status(500).json({ error: "Failed to fetch vehicle" });
  }
});

router.put("/:vehicleKey/toggle", checkPermission(Permission.EDIT_SETTINGS), async (req: AuthRequest, res: Response) => {
  try {
    const { vehicleKey } = req.params;
    const countryCode = (req.query.countryCode as SupportedCountry) || "BD";
    const body = toggleSchema.parse(req.body);
    
    if (!isValidVehicleKeyForCountry(vehicleKey, countryCode)) {
      return res.status(404).json({ error: "Vehicle type not found for this country" });
    }
    
    if (countryCode === "BD" && vehicleKey in BD_VEHICLE_TYPES) {
      (BD_VEHICLE_TYPES[vehicleKey as BDVehicleKey] as any).is_enabled = body.is_enabled;
    } else if (countryCode === "US" && vehicleKey in USA_VEHICLE_TYPES) {
      (USA_VEHICLE_TYPES[vehicleKey as USAVehicleKey] as any).is_enabled = body.is_enabled;
    }
    
    await logAuditEvent({
      actorId: req.adminUser?.id || null,
      actorEmail: req.adminUser?.email || (req.user as any)?.email || "unknown",
      actorRole: req.adminUser?.role || "admin",
      actionType: ActionType.UPDATE,
      entityType: "vehicle_type",
      entityId: vehicleKey,
      description: `${body.is_enabled ? "Enabled" : "Disabled"} vehicle type ${vehicleKey} for ${countryCode}`,
      metadata: {
        field: "is_enabled",
        oldValue: !body.is_enabled,
        newValue: body.is_enabled,
        countryCode,
      },
      ipAddress: getClientIp(req),
    });
    
    res.json({
      success: true,
      message: `Vehicle ${vehicleKey} ${body.is_enabled ? "enabled" : "disabled"}`,
      vehicle_key: vehicleKey,
      is_enabled: body.is_enabled,
    });
  } catch (error: any) {
    console.error("[AdminVehicles] Toggle error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request body", details: error.errors });
    }
    res.status(500).json({ error: "Failed to toggle vehicle" });
  }
});

router.put("/:vehicleKey/pricing", checkPermission(Permission.EDIT_SETTINGS), async (req: AuthRequest, res: Response) => {
  try {
    const { vehicleKey } = req.params;
    const countryCode = (req.query.countryCode as SupportedCountry) || "BD";
    const pricing = pricingSchema.parse(req.body);
    
    if (!isValidVehicleKeyForCountry(vehicleKey, countryCode)) {
      return res.status(404).json({ error: "Vehicle type not found for this country" });
    }
    
    if (countryCode !== "BD") {
      return res.status(400).json({ 
        error: "Pricing updates are only supported for BD vehicles. US uses dynamic pricing multipliers." 
      });
    }
    
    if (vehicleKey in BD_VEHICLE_TYPES) {
      const vehicle = BD_VEHICLE_TYPES[vehicleKey as BDVehicleKey];
      const oldConfig = vehicle.fare_config ? { ...vehicle.fare_config } : null;
      
      (vehicle as any).fare_config = {
        base_fare_bdt: pricing.base_fare,
        per_km_bdt: pricing.per_km,
        per_minute_bdt: pricing.per_minute,
        minimum_fare_bdt: pricing.minimum_fare,
        waiting_charge_per_min_bdt: pricing.waiting_charge_per_min || 0,
      };
      
      await logAuditEvent({
        actorId: req.adminUser?.id || null,
        actorEmail: req.adminUser?.email || (req.user as any)?.email || "unknown",
        actorRole: req.adminUser?.role || "admin",
        actionType: ActionType.UPDATE,
        entityType: "vehicle_type",
        entityId: vehicleKey,
        description: `Updated pricing for vehicle type ${vehicleKey} in ${countryCode}`,
        metadata: {
          field: "fare_config",
          oldValue: oldConfig,
          newValue: vehicle.fare_config,
          countryCode,
        },
        ipAddress: getClientIp(req),
      });
      
      res.json({
        success: true,
        message: `Pricing updated for ${vehicleKey}`,
        vehicle_key: vehicleKey,
        fare_config: vehicle.fare_config,
      });
    } else {
      return res.status(404).json({ error: "Vehicle configuration not found" });
    }
  } catch (error: any) {
    console.error("[AdminVehicles] Pricing update error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid pricing data", details: error.errors });
    }
    res.status(500).json({ error: "Failed to update pricing" });
  }
});

router.get("/stats/summary", checkPermission(Permission.VIEW_SETTINGS), async (req: AuthRequest, res: Response) => {
  try {
    const bdVehicles = Object.values(BD_VEHICLE_TYPES);
    const usaVehicles = Object.values(USA_VEHICLE_TYPES);
    
    const bdStats = {
      total: bdVehicles.length,
      enabled: bdVehicles.filter(v => v.is_enabled).length,
      disabled: bdVehicles.filter(v => !v.is_enabled).length,
      by_service: {
        ride: bdVehicles.filter(v => v.service_type === "ride").length,
        food: bdVehicles.filter(v => v.service_type === "food" || v.additional_services?.includes("food")).length,
        parcel: bdVehicles.filter(v => v.service_type === "parcel" || v.additional_services?.includes("parcel")).length,
      },
    };
    
    const usaStats = {
      total: usaVehicles.length,
      enabled: usaVehicles.filter(v => v.is_enabled).length,
      disabled: usaVehicles.filter(v => !v.is_enabled).length,
      by_service: {
        ride: usaVehicles.filter(v => v.service_type === "ride").length,
        food: usaVehicles.filter(v => v.service_type === "food" || v.additional_services?.includes("food")).length,
        parcel: usaVehicles.filter(v => v.service_type === "parcel" || v.additional_services?.includes("parcel")).length,
      },
    };
    
    res.json({
      success: true,
      summary: {
        BD: bdStats,
        US: usaStats,
      },
    });
  } catch (error: any) {
    console.error("[AdminVehicles] Stats error:", error);
    res.status(500).json({ error: "Failed to fetch vehicle stats" });
  }
});

export default router;
