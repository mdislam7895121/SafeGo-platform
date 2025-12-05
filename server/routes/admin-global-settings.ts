import { Router, Request, Response } from "express";
import { z } from "zod";
import { Permission, canPerform, AdminRole } from "../utils/permissions";
import { 
  GlobalAdminSettingsService, 
  AdminSettingKey,
  SETTING_DEFINITIONS,
} from "../services/globalAdminSettingsService";
import { getClientIp } from "../utils/ip";

const router = Router();

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    adminProfile?: {
      adminRole: AdminRole;
      isActive: boolean;
    } | null;
  };
}

function checkPermission(req: AuthenticatedRequest, permission: Permission): boolean {
  return canPerform(req.user, permission);
}

router.get("/", async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!checkPermission(req, Permission.VIEW_GLOBAL_SETTINGS)) {
      return res.status(403).json({ error: "Insufficient permissions to view global settings" });
    }

    const category = req.query.category as string | undefined;
    const countryScope = req.query.countryScope as string | undefined;

    const settings = await GlobalAdminSettingsService.getAllSettings({
      category: category as any,
      countryScope: countryScope as any,
    });

    const formattedSettings = settings.map(s => ({
      key: s.key,
      value: s.value,
      description: s.description,
      isSensitive: s.isSensitive,
      countryScope: s.countryScope,
      category: s.category,
      updatedAt: s.updatedAt,
      updatedByAdminId: s.updatedByAdminId,
      displayLabel: s.definition.displayLabel,
      unit: s.definition.unit,
      defaultValue: s.definition.defaultValue,
    }));

    return res.json({
      settings: formattedSettings,
      categories: ["PLATFORM_ECONOMICS", "SECURITY_ABUSE", "CONTACTS_SUPPORT", "OPERATIONAL"],
      countryScopes: ["GLOBAL", "BD_ONLY", "US_ONLY"],
    });
  } catch (error: any) {
    console.error("[GlobalSettings] Error fetching settings:", error);
    return res.status(500).json({ error: "Failed to fetch global settings" });
  }
});

router.get("/:key", async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!checkPermission(req, Permission.VIEW_GLOBAL_SETTINGS)) {
      return res.status(403).json({ error: "Insufficient permissions to view global settings" });
    }

    const { key } = req.params;

    if (!GlobalAdminSettingsService.isValidSettingKey(key)) {
      return res.status(400).json({ error: `Invalid setting key: ${key}` });
    }

    const value = await GlobalAdminSettingsService.getSetting(key as AdminSettingKey);
    const definition = GlobalAdminSettingsService.getSettingDefinition(key as AdminSettingKey);

    return res.json({
      key,
      value,
      description: definition.description,
      isSensitive: definition.isSensitive,
      countryScope: definition.countryScope,
      category: definition.category,
      displayLabel: definition.displayLabel,
      unit: definition.unit,
      defaultValue: definition.defaultValue,
    });
  } catch (error: any) {
    console.error("[GlobalSettings] Error fetching setting:", error);
    return res.status(500).json({ error: "Failed to fetch setting" });
  }
});

router.get("/:key/history", async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!checkPermission(req, Permission.VIEW_SETTING_HISTORY)) {
      return res.status(403).json({ error: "Insufficient permissions to view setting history" });
    }

    const { key } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;

    if (!GlobalAdminSettingsService.isValidSettingKey(key)) {
      return res.status(400).json({ error: `Invalid setting key: ${key}` });
    }

    const history = await GlobalAdminSettingsService.getSettingHistory(key as AdminSettingKey, limit);

    return res.json({
      key,
      history,
    });
  } catch (error: any) {
    console.error("[GlobalSettings] Error fetching setting history:", error);
    return res.status(500).json({ error: "Failed to fetch setting history" });
  }
});

const updateSettingSchema = z.object({
  value: z.union([z.string(), z.number(), z.boolean()]),
  confirmationKey: z.string().optional(),
  reason: z.string().min(1).max(500).optional(),
});

router.patch("/:key", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { key } = req.params;

    if (!GlobalAdminSettingsService.isValidSettingKey(key)) {
      return res.status(400).json({ error: `Invalid setting key: ${key}` });
    }

    if (!req.user?.id || !req.user?.email) {
      return res.status(401).json({ error: "Valid authenticated user with email is required" });
    }

    const definition = GlobalAdminSettingsService.getSettingDefinition(key as AdminSettingKey);

    if (definition.isSensitive) {
      if (!checkPermission(req, Permission.MANAGE_SENSITIVE_SETTINGS)) {
        return res.status(403).json({ 
          error: "Insufficient permissions to modify sensitive settings. Only Super Admins can change this setting.",
          isSensitive: true,
        });
      }
    } else {
      if (!checkPermission(req, Permission.MANAGE_GLOBAL_SETTINGS)) {
        return res.status(403).json({ error: "Insufficient permissions to modify global settings" });
      }
    }

    const bodyResult = updateSettingSchema.safeParse(req.body);
    if (!bodyResult.success) {
      return res.status(400).json({ 
        error: "Invalid request body. Value must be a string, number, or boolean.",
        details: bodyResult.error.errors,
      });
    }

    const { value: rawValue, confirmationKey, reason } = bodyResult.data;

    if (rawValue === undefined || rawValue === null) {
      return res.status(400).json({ error: "Value is required" });
    }

    if (definition.isSensitive && confirmationKey !== key) {
      return res.status(400).json({ 
        error: "Confirmation required for sensitive settings. Please type the setting key to confirm.",
        requiresConfirmation: true,
        settingKey: key,
      });
    }

    let coercedValue: string | number | boolean = rawValue;
    if (typeof definition.defaultValue === "number" && typeof rawValue === "string") {
      const parsed = parseFloat(rawValue);
      if (!isNaN(parsed)) {
        coercedValue = parsed;
      }
    } else if (typeof definition.defaultValue === "boolean" && typeof rawValue === "string") {
      coercedValue = rawValue.toLowerCase() === "true";
    }

    const validation = GlobalAdminSettingsService.validateSettingValue(key as AdminSettingKey, coercedValue);
    if (!validation.valid) {
      return res.status(400).json({ 
        error: `Invalid value for ${key}`,
        details: validation.error,
      });
    }

    const result = await GlobalAdminSettingsService.updateSetting(
      key as AdminSettingKey,
      coercedValue,
      req.user.id,
      req.user.email,
      getClientIp(req) || undefined,
      req.headers["user-agent"] || undefined,
      reason
    );

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.json({
      success: true,
      message: `Setting ${key} updated successfully`,
      key,
      newValue: coercedValue,
    });
  } catch (error: any) {
    console.error("[GlobalSettings] Error updating setting:", error);
    return res.status(500).json({ error: "Failed to update setting" });
  }
});

router.get("/definitions/all", async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!checkPermission(req, Permission.VIEW_GLOBAL_SETTINGS)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    const definitions = Object.values(SETTING_DEFINITIONS).map(def => ({
      key: def.key,
      displayLabel: def.displayLabel,
      description: def.description,
      isSensitive: def.isSensitive,
      countryScope: def.countryScope,
      category: def.category,
      defaultValue: def.defaultValue,
      unit: def.unit,
    }));

    return res.json({ definitions });
  } catch (error: any) {
    console.error("[GlobalSettings] Error fetching definitions:", error);
    return res.status(500).json({ error: "Failed to fetch definitions" });
  }
});

router.post("/initialize", async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!checkPermission(req, Permission.MANAGE_SENSITIVE_SETTINGS)) {
      return res.status(403).json({ error: "Only Super Admins can initialize settings" });
    }

    await GlobalAdminSettingsService.initializeDefaultSettings();

    return res.json({ 
      success: true,
      message: "Default settings initialized successfully",
    });
  } catch (error: any) {
    console.error("[GlobalSettings] Error initializing settings:", error);
    return res.status(500).json({ error: "Failed to initialize settings" });
  }
});

export default router;
