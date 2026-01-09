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
import { customerAbuseAutomation } from './CustomerAbuseAutomation';
import { partnerFraudAutomation } from './PartnerFraudAutomation';
import { customerPaymentScoringAutomation } from './CustomerPaymentScoringAutomation';
import { partnerRiskMonitoringAutomation } from './PartnerRiskMonitoringAutomation';
import { orderSuccessPredictionAutomation } from './OrderSuccessPredictionAutomation';
import { driverFatigueAutomation } from './DriverFatigueAutomation';
import { demandSensingAutomation } from './DemandSensingAutomation';
import { trafficETACorrectionAutomation } from './TrafficETACorrectionAutomation';
import { inventoryForecastingAutomation } from './InventoryForecastingAutomation';
import { RepeatPurchaseTriggerAutomation, repeatPurchaseTriggerAutomation } from './RepeatPurchaseTriggerAutomation';
import { NegativeReviewRecoveryAutomation, negativeReviewRecoveryAutomation } from './NegativeReviewRecoveryAutomation';
import { SeasonalIntelligenceAutomation, seasonalIntelligenceAutomation } from './SeasonalIntelligenceAutomation';
import { ServerScalingAutomation, serverScalingAutomation } from './ServerScalingAutomation';
import { DevOpsDeploymentAutomation, devOpsDeploymentAutomation } from './DevOpsDeploymentAutomation';
import { EmployeeProductivityAutomation, employeeProductivityAutomation } from './EmployeeProductivityAutomation';
import { RefundOptimizationAutomation, refundOptimizationAutomation } from './RefundOptimizationAutomation';
import { MarketingBudgetAutomation, marketingBudgetAutomation } from './MarketingBudgetAutomation';

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
  customerAbuseAutomation,
  partnerFraudAutomation,
  customerPaymentScoringAutomation,
  partnerRiskMonitoringAutomation,
  orderSuccessPredictionAutomation,
  driverFatigueAutomation,
  demandSensingAutomation,
  trafficETACorrectionAutomation,
  inventoryForecastingAutomation,
  RepeatPurchaseTriggerAutomation, repeatPurchaseTriggerAutomation,
  NegativeReviewRecoveryAutomation, negativeReviewRecoveryAutomation,
  SeasonalIntelligenceAutomation, seasonalIntelligenceAutomation,
  ServerScalingAutomation, serverScalingAutomation,
  DevOpsDeploymentAutomation, devOpsDeploymentAutomation,
  EmployeeProductivityAutomation, employeeProductivityAutomation,
  RefundOptimizationAutomation, refundOptimizationAutomation,
  MarketingBudgetAutomation, marketingBudgetAutomation,
};

export interface AutomationSystemStatus {
  name: string;
  isActive: boolean;
  lastRunAt?: Date;
  nextRunAt?: Date;
  config: Record<string, any>;
}

export async function initializeAutomationSystems(): Promise<void> {
  // PRODUCTION SAFETY: Do not start automation systems when observability is disabled
  // This prevents memory-intensive background processes from running
  if (process.env.DISABLE_OBSERVABILITY === "true") {
    console.log('[Automation] DISABLED via DISABLE_OBSERVABILITY=true - skipping all automation systems');
    return;
  }

  console.log('[Automation] Initializing automation systems...');

  surgePricingAutomation.start();
  autoSettlementService.start();
  performanceScoringService.start();
  autoPayoutService.start();
  fraudDetectionAutomation.start();
  loginSecurityAutomation.start();
  autoNegativeBalanceControl.start();
  inventoryMenuErrorAutomation.start();
  systemMonitoringAutomation.start();
  aiCustomerSupportAutomation.start();
  highRiskActivityAutomation.start();
  customerAbuseAutomation.start();
  partnerFraudAutomation.start();
  customerPaymentScoringAutomation.start();
  partnerRiskMonitoringAutomation.start();
  orderSuccessPredictionAutomation.start();
  driverFatigueAutomation.start();
  demandSensingAutomation.start();
  trafficETACorrectionAutomation.start();
  inventoryForecastingAutomation.start();
  repeatPurchaseTriggerAutomation.start();
  negativeReviewRecoveryAutomation.start();
  seasonalIntelligenceAutomation.start();
  serverScalingAutomation.start();
  devOpsDeploymentAutomation.start();
  employeeProductivityAutomation.start();
  refundOptimizationAutomation.start();
  marketingBudgetAutomation.start();

  console.log('[Automation] All automation systems initialized');
}

export async function shutdownAutomationSystems(): Promise<void> {
  console.log('[Automation] Shutting down automation systems...');

  surgePricingAutomation.stop();
  autoSettlementService.stop();
  performanceScoringService.stop();
  autoPayoutService.stop();
  fraudDetectionAutomation.stop();
  loginSecurityAutomation.stop();
  autoNegativeBalanceControl.stop();
  inventoryMenuErrorAutomation.stop();
  systemMonitoringAutomation.stop();
  aiCustomerSupportAutomation.stop();
  highRiskActivityAutomation.stop();
  customerAbuseAutomation.stop();
  partnerFraudAutomation.stop();
  customerPaymentScoringAutomation.stop();
  partnerRiskMonitoringAutomation.stop();
  orderSuccessPredictionAutomation.stop();
  driverFatigueAutomation.stop();
  demandSensingAutomation.stop();
  trafficETACorrectionAutomation.stop();
  inventoryForecastingAutomation.stop();
  repeatPurchaseTriggerAutomation.stop();
  negativeReviewRecoveryAutomation.stop();
  seasonalIntelligenceAutomation.stop();
  serverScalingAutomation.stop();
  devOpsDeploymentAutomation.stop();
  employeeProductivityAutomation.stop();
  refundOptimizationAutomation.stop();
  marketingBudgetAutomation.stop();

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
    {
      name: 'Fraud Detection Automation',
      isActive: fraudDetectionAutomation.getStatus().isRunning,
      config: fraudDetectionAutomation.getConfig(),
    },
    {
      name: 'Login Security Automation',
      isActive: loginSecurityAutomation.getStatus().isRunning,
      config: loginSecurityAutomation.getConfig(),
    },
    {
      name: 'Auto Negative Balance Control',
      isActive: autoNegativeBalanceControl.getStatus().isRunning,
      config: autoNegativeBalanceControl.getConfig(),
    },
    {
      name: 'Inventory Menu Error Automation',
      isActive: inventoryMenuErrorAutomation.getStatus().isRunning,
      config: inventoryMenuErrorAutomation.getConfig(),
    },
    {
      name: 'System Monitoring Automation',
      isActive: systemMonitoringAutomation.getStatus().isRunning,
      config: systemMonitoringAutomation.getConfig(),
    },
    {
      name: 'AI Customer Support Automation',
      isActive: aiCustomerSupportAutomation.getStatus().isRunning,
      config: aiCustomerSupportAutomation.getConfig(),
    },
    {
      name: 'High Risk Activity Automation',
      isActive: highRiskActivityAutomation.getStatus().isRunning,
      config: highRiskActivityAutomation.getConfig(),
    },
    {
      name: 'Customer Abuse Automation',
      isActive: customerAbuseAutomation.getStatus().isRunning,
      config: customerAbuseAutomation.getConfig(),
    },
    {
      name: 'Partner Fraud Automation',
      isActive: partnerFraudAutomation.getStatus().isRunning,
      config: partnerFraudAutomation.getConfig(),
    },
    {
      name: 'Customer Payment Scoring Automation',
      isActive: customerPaymentScoringAutomation.getStatus().isRunning,
      config: customerPaymentScoringAutomation.getConfig(),
    },
    {
      name: 'Partner Risk Monitoring Automation',
      isActive: partnerRiskMonitoringAutomation.getStatus().isRunning,
      config: partnerRiskMonitoringAutomation.getConfig(),
    },
    {
      name: 'Order Success Prediction Automation',
      isActive: orderSuccessPredictionAutomation.getStatus().isRunning,
      config: orderSuccessPredictionAutomation.getConfig(),
    },
    {
      name: 'Driver Fatigue Automation',
      isActive: driverFatigueAutomation.getStatus().isRunning,
      config: driverFatigueAutomation.getConfig(),
    },
    {
      name: 'Demand Sensing Automation',
      isActive: demandSensingAutomation.getStatus().isRunning,
      config: demandSensingAutomation.getConfig(),
    },
    {
      name: 'Traffic ETA Correction Automation',
      isActive: trafficETACorrectionAutomation.getStatus().isRunning,
      config: trafficETACorrectionAutomation.getConfig(),
    },
    {
      name: 'Inventory Forecasting Automation',
      isActive: inventoryForecastingAutomation.getStatus().isRunning,
      config: inventoryForecastingAutomation.getConfig(),
    },
    {
      name: 'Repeat Purchase Trigger Automation',
      isActive: repeatPurchaseTriggerAutomation.getStatus().isRunning,
      config: repeatPurchaseTriggerAutomation.getConfig(),
    },
    {
      name: 'Negative Review Recovery Automation',
      isActive: negativeReviewRecoveryAutomation.getStatus().isRunning,
      config: negativeReviewRecoveryAutomation.getConfig(),
    },
    {
      name: 'Seasonal Intelligence Automation',
      isActive: seasonalIntelligenceAutomation.getStatus().isRunning,
      config: seasonalIntelligenceAutomation.getConfig(),
    },
    {
      name: 'Server Scaling Automation',
      isActive: serverScalingAutomation.getStatus().isRunning,
      config: serverScalingAutomation.getConfig(),
    },
    {
      name: 'DevOps Deployment Automation',
      isActive: devOpsDeploymentAutomation.getStatus().isRunning,
      config: devOpsDeploymentAutomation.getConfig(),
    },
    {
      name: 'Employee Productivity Automation',
      isActive: employeeProductivityAutomation.getStatus().isRunning,
      config: employeeProductivityAutomation.getConfig(),
    },
    {
      name: 'Refund Optimization Automation',
      isActive: refundOptimizationAutomation.getStatus().isRunning,
      config: refundOptimizationAutomation.getConfig(),
    },
    {
      name: 'Marketing Budget Automation',
      isActive: marketingBudgetAutomation.getStatus().isRunning,
      config: marketingBudgetAutomation.getConfig(),
    },
  ];
}
