/**
 * SafeGo Automation Services Index
 * Central export for all profit-focused automation systems
 */

import { AutoAssignmentEngine, autoAssignmentEngine } from './AutoAssignmentEngine';
import { SurgePricingAutomation, surgePricingAutomation } from './SurgePricingAutomation';
import { AutoSettlementService, autoSettlementService } from './AutoSettlementService';
import { RecommendationEngine, recommendationEngine } from './RecommendationEngine';
import { DynamicPricingService, dynamicPricingService } from './DynamicPricingService';
import { PerformanceScoringService, performanceScoringService } from './PerformanceScoringService';
import { AutoCancellationService, autoCancellationService } from './AutoCancellationService';
import { AutoPayoutService, autoPayoutService } from './AutoPayoutService';
import { fraudDetectionAutomation } from './FraudDetectionAutomation';
import { loginSecurityAutomation } from './LoginSecurityAutomation';
import { autoNegativeBalanceControl } from './AutoNegativeBalanceControl';
import { inventoryMenuErrorAutomation } from './InventoryMenuErrorAutomation';
import { systemMonitoringAutomation } from './SystemMonitoringAutomation';
import { aiCustomerSupportAutomation } from './AICustomerSupportAutomation';
import { highRiskActivityAutomation } from './HighRiskActivityAutomation';

export {
  AutoAssignmentEngine, autoAssignmentEngine,
  SurgePricingAutomation, surgePricingAutomation,
  AutoSettlementService, autoSettlementService,
  RecommendationEngine, recommendationEngine,
  DynamicPricingService, dynamicPricingService,
  PerformanceScoringService, performanceScoringService,
  AutoCancellationService, autoCancellationService,
  AutoPayoutService, autoPayoutService,
  fraudDetectionAutomation,
  loginSecurityAutomation,
  autoNegativeBalanceControl,
  inventoryMenuErrorAutomation,
  systemMonitoringAutomation,
  aiCustomerSupportAutomation,
  highRiskActivityAutomation,
};

export interface AutomationSystemStatus {
  name: string;
  isActive: boolean;
  lastRunAt?: Date;
  nextRunAt?: Date;
  config: Record<string, any>;
}

export async function initializeAutomationSystems(): Promise<void> {
  console.log('[Automation] Initializing automation systems...');

  surgePricingAutomation.start();
  autoSettlementService.start();
  performanceScoringService.start();
  autoPayoutService.start();

  console.log('[Automation] All automation systems initialized');
}

export async function shutdownAutomationSystems(): Promise<void> {
  console.log('[Automation] Shutting down automation systems...');

  surgePricingAutomation.stop();
  autoSettlementService.stop();
  performanceScoringService.stop();
  autoPayoutService.stop();

  console.log('[Automation] All automation systems stopped');
}

export function getAutomationSystemsStatus(): AutomationSystemStatus[] {
  return [
    {
      name: 'Auto Assignment Engine',
      isActive: true,
      config: autoAssignmentEngine.getWeights(),
    },
    {
      name: 'Surge Pricing Automation',
      isActive: surgePricingAutomation.isActive(),
      config: surgePricingAutomation.getConfig(),
    },
    {
      name: 'Auto Settlement Service',
      isActive: true,
      config: autoSettlementService.getConfig(),
    },
    {
      name: 'Recommendation Engine',
      isActive: true,
      config: {},
    },
    {
      name: 'Dynamic Pricing Service',
      isActive: true,
      config: {
        timeSlots: dynamicPricingService.getTimeSlots(),
        festivals: dynamicPricingService.getFestivals(),
      },
    },
    {
      name: 'Performance Scoring Service',
      isActive: true,
      config: performanceScoringService.getWeights(),
    },
    {
      name: 'Auto Cancellation Service',
      isActive: true,
      config: autoCancellationService.getConfig(),
    },
    {
      name: 'Auto Payout Service',
      isActive: true,
      config: autoPayoutService.getConfig(),
    },
  ];
}
