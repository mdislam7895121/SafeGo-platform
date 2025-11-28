/**
 * SafeGo AI Marketplace Balancer - Admin API Routes
 * 
 * REST API endpoints for:
 * - Marketplace status monitoring
 * - Real-time metrics and heatmaps
 * - Manual controls and overrides
 * - Configuration management
 * - Decision history
 */

import { Router, Request, Response } from "express";
import {
  marketplaceBalancer,
  marketplaceState,
  telemetryCollector,
  safetyGuards,
  surgeController,
  commissionController,
  incentiveController,
} from "../services/marketplaceBalancer";

const router = Router();

// ========================================
// STATUS & METRICS
// ========================================

router.get("/status", async (_req: Request, res: Response) => {
  try {
    const status = marketplaceBalancer.getStatus();
    res.json(status);
  } catch (error) {
    console.error("[MarketplaceBalancer API] Error getting status:", error);
    res.status(500).json({ message: "Failed to get marketplace status" });
  }
});

router.get("/metrics", async (_req: Request, res: Response) => {
  try {
    const metrics = marketplaceBalancer.getMetricsSummary();
    res.json(metrics);
  } catch (error) {
    console.error("[MarketplaceBalancer API] Error getting metrics:", error);
    res.status(500).json({ message: "Failed to get marketplace metrics" });
  }
});

router.get("/zones", async (_req: Request, res: Response) => {
  try {
    const zones = marketplaceState.getAllZones().map(zone => ({
      id: zone.zone.id,
      name: zone.zone.name,
      center: zone.zone.center,
      status: zone.metrics.status,
      activeSurge: zone.activeSurge,
      activeCommission: zone.activeCommission,
      activeIncentives: zone.activeIncentives.length,
      supplyDemandRatio: zone.metrics.supplyDemandRatio,
      balanceScore: zone.metrics.balanceScore,
      demandPerMinute: zone.metrics.demand.rideRequestsPerMinute,
      idleDrivers: zone.metrics.supply.idleDrivers,
      lastUpdated: zone.lastUpdated,
    }));
    res.json(zones);
  } catch (error) {
    console.error("[MarketplaceBalancer API] Error getting zones:", error);
    res.status(500).json({ message: "Failed to get zone data" });
  }
});

router.get("/zones/:zoneId", async (req: Request, res: Response) => {
  try {
    const { zoneId } = req.params;
    const zone = marketplaceState.getZone(zoneId);
    
    if (!zone) {
      res.status(404).json({ message: "Zone not found" });
      return;
    }

    res.json({
      zone: zone.zone,
      metrics: zone.metrics,
      activeSurge: zone.activeSurge,
      activeCommission: zone.activeCommission,
      activeIncentives: zone.activeIncentives,
      demandHistory: marketplaceState.getDemandHistory(zoneId, 10),
      supplyHistory: marketplaceState.getSupplyHistory(zoneId, 10),
      surgeHistory: marketplaceState.getSurgeHistory(zoneId, 10),
      lastUpdated: zone.lastUpdated,
    });
  } catch (error) {
    console.error("[MarketplaceBalancer API] Error getting zone:", error);
    res.status(500).json({ message: "Failed to get zone data" });
  }
});

// ========================================
// HEATMAPS
// ========================================

router.get("/heatmaps", async (_req: Request, res: Response) => {
  try {
    const heatmaps = marketplaceBalancer.getHeatmaps();
    
    if (!heatmaps) {
      res.status(404).json({ message: "No heatmap data available" });
      return;
    }

    res.json(heatmaps);
  } catch (error) {
    console.error("[MarketplaceBalancer API] Error getting heatmaps:", error);
    res.status(500).json({ message: "Failed to get heatmaps" });
  }
});

router.get("/heatmaps/:type", async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const heatmaps = marketplaceBalancer.getHeatmaps();
    
    if (!heatmaps) {
      res.status(404).json({ message: "No heatmap data available" });
      return;
    }

    const heatmapMap: Record<string, any> = {
      demand: heatmaps.demandLive,
      supply: heatmaps.supplyLive,
      demand30m: heatmaps.demand30m,
      demand60m: heatmaps.demand60m,
      surge: heatmaps.surgeZones,
      incentives: heatmaps.incentiveZones,
    };

    const heatmap = heatmapMap[type];
    if (!heatmap) {
      res.status(400).json({ 
        message: "Invalid heatmap type",
        validTypes: Object.keys(heatmapMap)
      });
      return;
    }

    res.json(heatmap);
  } catch (error) {
    console.error("[MarketplaceBalancer API] Error getting heatmap:", error);
    res.status(500).json({ message: "Failed to get heatmap" });
  }
});

// ========================================
// DECISIONS
// ========================================

router.get("/decisions/latest", async (_req: Request, res: Response) => {
  try {
    const decision = marketplaceBalancer.getLatestDecision();
    
    if (!decision) {
      res.status(404).json({ message: "No decisions available" });
      return;
    }

    res.json(decision);
  } catch (error) {
    console.error("[MarketplaceBalancer API] Error getting latest decision:", error);
    res.status(500).json({ message: "Failed to get latest decision" });
  }
});

router.get("/decisions/history", async (req: Request, res: Response) => {
  try {
    const count = parseInt(req.query.count as string) || 10;
    const decisions = marketplaceBalancer.getDecisionHistory(Math.min(count, 60));
    res.json(decisions);
  } catch (error) {
    console.error("[MarketplaceBalancer API] Error getting decision history:", error);
    res.status(500).json({ message: "Failed to get decision history" });
  }
});

router.get("/violations", async (req: Request, res: Response) => {
  try {
    const count = parseInt(req.query.count as string) || 20;
    const violations = safetyGuards.getRecentViolations(Math.min(count, 100));
    res.json({
      totalViolations: safetyGuards.getViolationCount(),
      recentViolations: violations,
    });
  } catch (error) {
    console.error("[MarketplaceBalancer API] Error getting violations:", error);
    res.status(500).json({ message: "Failed to get violations" });
  }
});

// ========================================
// CONTROLS
// ========================================

router.post("/start", async (_req: Request, res: Response) => {
  try {
    marketplaceBalancer.start();
    res.json({ 
      message: "Marketplace balancer started",
      status: marketplaceBalancer.getStatus()
    });
  } catch (error) {
    console.error("[MarketplaceBalancer API] Error starting:", error);
    res.status(500).json({ message: "Failed to start marketplace balancer" });
  }
});

router.post("/stop", async (_req: Request, res: Response) => {
  try {
    marketplaceBalancer.stop();
    res.json({ 
      message: "Marketplace balancer stopped",
      status: marketplaceBalancer.getStatus()
    });
  } catch (error) {
    console.error("[MarketplaceBalancer API] Error stopping:", error);
    res.status(500).json({ message: "Failed to stop marketplace balancer" });
  }
});

router.post("/rebalance", async (_req: Request, res: Response) => {
  try {
    const decision = await marketplaceBalancer.forceRebalance();
    res.json({ 
      message: "Rebalance cycle completed",
      decision
    });
  } catch (error) {
    console.error("[MarketplaceBalancer API] Error during rebalance:", error);
    res.status(500).json({ message: "Failed to force rebalance" });
  }
});

router.post("/reset", async (_req: Request, res: Response) => {
  try {
    marketplaceBalancer.resetState();
    res.json({ message: "Marketplace state reset complete" });
  } catch (error) {
    console.error("[MarketplaceBalancer API] Error during reset:", error);
    res.status(500).json({ message: "Failed to reset state" });
  }
});

// ========================================
// MANUAL OVERRIDES
// ========================================

router.post("/override/enable", async (_req: Request, res: Response) => {
  try {
    marketplaceBalancer.enableManualOverride();
    res.json({ 
      message: "Manual override enabled - AI decisions will not be applied",
      config: marketplaceBalancer.getConfig()
    });
  } catch (error) {
    console.error("[MarketplaceBalancer API] Error enabling override:", error);
    res.status(500).json({ message: "Failed to enable manual override" });
  }
});

router.post("/override/disable", async (_req: Request, res: Response) => {
  try {
    marketplaceBalancer.disableManualOverride();
    res.json({ 
      message: "Manual override disabled - AI decisions will be applied",
      config: marketplaceBalancer.getConfig()
    });
  } catch (error) {
    console.error("[MarketplaceBalancer API] Error disabling override:", error);
    res.status(500).json({ message: "Failed to disable manual override" });
  }
});

router.post("/override/surge", async (req: Request, res: Response) => {
  try {
    const { zoneId, multiplier } = req.body;
    
    if (!zoneId || typeof multiplier !== 'number') {
      res.status(400).json({ message: "zoneId and multiplier are required" });
      return;
    }

    // Validate through safety guards
    const decision = {
      zoneId,
      currentMultiplier: marketplaceState.getActiveSurge(zoneId),
      recommendedMultiplier: multiplier,
      reason: 'Manual override',
      factors: ['Admin override'],
      confidenceScore: 1.0,
    };

    const validated = safetyGuards.validateSurge(decision);
    surgeController.applySurgeDecision(validated.corrected);

    res.json({
      message: "Surge override applied",
      original: multiplier,
      applied: validated.corrected.recommendedMultiplier,
      violation: validated.violation,
    });
  } catch (error) {
    console.error("[MarketplaceBalancer API] Error applying surge override:", error);
    res.status(500).json({ message: "Failed to apply surge override" });
  }
});

router.post("/override/commission", async (req: Request, res: Response) => {
  try {
    const { zoneId, rate } = req.body;
    
    if (!zoneId || typeof rate !== 'number') {
      res.status(400).json({ message: "zoneId and rate are required" });
      return;
    }

    const decision = {
      zoneId,
      currentRate: marketplaceState.getActiveCommission(zoneId),
      recommendedRate: rate,
      reason: 'Manual override',
      demandLevel: 'normal' as const,
      confidenceScore: 1.0,
    };

    const validated = safetyGuards.validateCommission(decision);
    commissionController.applyCommissionDecision(validated.corrected);

    res.json({
      message: "Commission override applied",
      original: rate,
      applied: validated.corrected.recommendedRate,
      violation: validated.violation,
    });
  } catch (error) {
    console.error("[MarketplaceBalancer API] Error applying commission override:", error);
    res.status(500).json({ message: "Failed to apply commission override" });
  }
});

// ========================================
// CONFIGURATION
// ========================================

router.get("/config", async (_req: Request, res: Response) => {
  try {
    const config = marketplaceBalancer.getConfig();
    res.json(config);
  } catch (error) {
    console.error("[MarketplaceBalancer API] Error getting config:", error);
    res.status(500).json({ message: "Failed to get configuration" });
  }
});

router.patch("/config", async (req: Request, res: Response) => {
  try {
    const updates = req.body;
    
    // Validate allowed fields
    const allowedFields = [
      'enabled',
      'cycleDurationMs',
      'surgeAdjustmentEnabled',
      'commissionAdjustmentEnabled',
      'incentiveOptimizationEnabled',
      'dispatchOptimizationEnabled',
      'heatmapGenerationEnabled',
      'debugMode',
    ];

    const filtered: Record<string, any> = {};
    for (const field of allowedFields) {
      if (field in updates) {
        filtered[field] = updates[field];
      }
    }

    marketplaceBalancer.updateConfig(filtered);

    res.json({
      message: "Configuration updated",
      config: marketplaceBalancer.getConfig()
    });
  } catch (error) {
    console.error("[MarketplaceBalancer API] Error updating config:", error);
    res.status(500).json({ message: "Failed to update configuration" });
  }
});

router.get("/safety-guards", async (_req: Request, res: Response) => {
  try {
    const guards = safetyGuards.getConfig();
    res.json(guards);
  } catch (error) {
    console.error("[MarketplaceBalancer API] Error getting safety guards:", error);
    res.status(500).json({ message: "Failed to get safety guards" });
  }
});

// ========================================
// TELEMETRY
// ========================================

router.get("/telemetry/snapshot", async (_req: Request, res: Response) => {
  try {
    const snapshot = marketplaceState.getLatestSnapshot();
    res.json(snapshot || { message: "No snapshot available" });
  } catch (error) {
    console.error("[MarketplaceBalancer API] Error getting snapshot:", error);
    res.status(500).json({ message: "Failed to get telemetry snapshot" });
  }
});

router.get("/telemetry/events", async (req: Request, res: Response) => {
  try {
    const count = parseInt(req.query.count as string) || 50;
    const events = marketplaceState.getTelemetryEvents(Math.min(count, 200));
    res.json(events);
  } catch (error) {
    console.error("[MarketplaceBalancer API] Error getting telemetry events:", error);
    res.status(500).json({ message: "Failed to get telemetry events" });
  }
});

router.post("/telemetry/simulation/:enabled", async (req: Request, res: Response) => {
  try {
    const enabled = req.params.enabled === 'true';
    telemetryCollector.setSimulationMode(enabled);
    res.json({ 
      message: `Simulation mode ${enabled ? 'enabled' : 'disabled'}`,
      simulationMode: telemetryCollector.isSimulating()
    });
  } catch (error) {
    console.error("[MarketplaceBalancer API] Error setting simulation mode:", error);
    res.status(500).json({ message: "Failed to set simulation mode" });
  }
});

// ========================================
// ACTUATOR STATUS
// ========================================

router.get("/actuators/surge", async (_req: Request, res: Response) => {
  try {
    const zones = marketplaceState.getAllZones();
    const surgeData = zones.map(zone => ({
      zoneId: zone.zone.id,
      zoneName: zone.zone.name,
      currentSurge: zone.activeSurge,
      estimatedUberSurge: surgeController.getEstimatedUberSurge(zone.zone.id),
      history: marketplaceState.getSurgeHistory(zone.zone.id, 5),
    }));
    res.json(surgeData);
  } catch (error) {
    console.error("[MarketplaceBalancer API] Error getting surge data:", error);
    res.status(500).json({ message: "Failed to get surge actuator data" });
  }
});

router.get("/actuators/commission", async (_req: Request, res: Response) => {
  try {
    const zones = marketplaceState.getAllZones();
    const commissionData = zones.map(zone => ({
      zoneId: zone.zone.id,
      zoneName: zone.zone.name,
      currentCommission: zone.activeCommission,
      adjustmentsRemaining: commissionController.getRemainingAdjustments(zone.zone.id),
    }));
    res.json(commissionData);
  } catch (error) {
    console.error("[MarketplaceBalancer API] Error getting commission data:", error);
    res.status(500).json({ message: "Failed to get commission actuator data" });
  }
});

router.get("/actuators/incentives", async (_req: Request, res: Response) => {
  try {
    const zones = marketplaceState.getAllZones();
    const incentiveData = zones.map(zone => ({
      zoneId: zone.zone.id,
      zoneName: zone.zone.name,
      activeIncentives: zone.activeIncentives,
    }));
    res.json({
      zones: incentiveData,
      remainingBudget: incentiveController.getRemainingBudget(),
      params: incentiveController.getParams(),
    });
  } catch (error) {
    console.error("[MarketplaceBalancer API] Error getting incentive data:", error);
    res.status(500).json({ message: "Failed to get incentive actuator data" });
  }
});

export default router;
