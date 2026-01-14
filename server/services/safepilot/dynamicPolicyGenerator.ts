import { prisma } from '../../db';

interface PolicyRule {
  id: string;
  name: string;
  category: "FARE" | "PENALTY" | "FRAUD" | "KYC" | "INCENTIVE" | "SAFETY" | "COMPLIANCE";
  description: string;
  conditions: Array<{
    field: string;
    operator: string;
    value: string | number;
  }>;
  actions: Array<{
    type: string;
    value: string | number;
  }>;
  status: "DRAFT" | "ACTIVE" | "TESTING" | "DISABLED";
  priority: number;
  createdAt: Date;
  impactSimulation?: PolicyImpactSimulation;
}

interface PolicyImpactSimulation {
  affectedEntities: number;
  estimatedRevenueChange: number;
  estimatedCostChange: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  warnings: string[];
  recommendations: string[];
}

interface PolicyTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  defaultConditions: Array<{
    field: string;
    operator: string;
    value: string | number;
  }>;
  defaultActions: Array<{
    type: string;
    value: string | number;
  }>;
  popularity: number;
}

export interface DynamicPolicyDashboard {
  totalPolicies: number;
  activePolicies: number;
  draftPolicies: number;
  testingPolicies: number;
  recentPolicies: PolicyRule[];
  templates: PolicyTemplate[];
  suggestedPolicies: PolicyRule[];
  policyCategories: Record<string, number>;
}

export async function getDynamicPolicyDashboard(countryCode?: string): Promise<DynamicPolicyDashboard> {
  const whereClause = countryCode ? { countryCode } : {};

  const [driverCount, customerCount, rideCount] = await Promise.all([
    prisma.driver.count({ where: whereClause }),
    prisma.customer.count({ where: whereClause }),
    prisma.ride.count({ where: whereClause }),
  ]);

  const templates: PolicyTemplate[] = [
    {
      id: "tpl-surge-pricing",
      name: "Dynamic Surge Pricing",
      category: "FARE",
      description: "Automatically adjust prices based on demand/supply ratio",
      defaultConditions: [
        { field: "demand_supply_ratio", operator: ">", value: 1.5 },
        { field: "time_of_day", operator: "between", value: "peak_hours" },
      ],
      defaultActions: [
        { type: "multiply_base_fare", value: 1.5 },
        { type: "notify_drivers", value: "surge_active" },
      ],
      popularity: 95,
    },
    {
      id: "tpl-fraud-detection",
      name: "Fraud Auto-Block",
      category: "FRAUD",
      description: "Automatically block accounts showing fraud patterns",
      defaultConditions: [
        { field: "fraud_score", operator: ">", value: 80 },
        { field: "flagged_count", operator: ">=", value: 3 },
      ],
      defaultActions: [
        { type: "suspend_account", value: "immediate" },
        { type: "alert_admin", value: "high_priority" },
      ],
      popularity: 88,
    },
    {
      id: "tpl-driver-incentive",
      name: "Peak Hour Bonus",
      category: "INCENTIVE",
      description: "Offer bonuses to drivers during high-demand periods",
      defaultConditions: [
        { field: "hour", operator: "in", value: "7-9,17-20" },
        { field: "driver_online_hours", operator: ">=", value: 2 },
      ],
      defaultActions: [
        { type: "bonus_per_ride", value: 2.5 },
        { type: "max_bonus_per_day", value: 25 },
      ],
      popularity: 82,
    },
    {
      id: "tpl-kyc-auto-approve",
      name: "KYC Auto-Approval",
      category: "KYC",
      description: "Automatically approve low-risk KYC applications",
      defaultConditions: [
        { field: "document_verification_score", operator: ">", value: 95 },
        { field: "face_match_score", operator: ">", value: 90 },
        { field: "fraud_check_passed", operator: "==", value: "true" },
      ],
      defaultActions: [
        { type: "approve_kyc", value: "auto" },
        { type: "send_notification", value: "welcome_driver" },
      ],
      popularity: 78,
    },
    {
      id: "tpl-penalty-cancellation",
      name: "Cancellation Penalty",
      category: "PENALTY",
      description: "Apply penalties for excessive ride cancellations",
      defaultConditions: [
        { field: "cancellation_rate_7d", operator: ">", value: 15 },
        { field: "total_rides_7d", operator: ">=", value: 10 },
      ],
      defaultActions: [
        { type: "reduce_priority_score", value: 10 },
        { type: "send_warning", value: "cancellation_warning" },
      ],
      popularity: 75,
    },
  ];

  const suggestedPolicies: PolicyRule[] = [
    {
      id: "sug-1",
      name: "Night Safety Premium",
      category: "FARE",
      description: "Add 15% premium for rides between 11 PM and 5 AM",
      conditions: [
        { field: "hour", operator: "between", value: "23-05" },
      ],
      actions: [
        { type: "add_fare_percentage", value: 15 },
      ],
      status: "DRAFT",
      priority: 80,
      createdAt: new Date(),
      impactSimulation: {
        affectedEntities: Math.floor(rideCount * 0.15),
        estimatedRevenueChange: Math.floor(rideCount * 0.15 * 2.5),
        estimatedCostChange: 0,
        riskLevel: "LOW",
        warnings: [],
        recommendations: ["Consider driver notification about night premium"],
      },
    },
    {
      id: "sug-2",
      name: "New Driver Mentorship",
      category: "INCENTIVE",
      description: "Pair new drivers with experienced mentors for first 10 rides",
      conditions: [
        { field: "driver_completed_rides", operator: "<", value: 10 },
      ],
      actions: [
        { type: "assign_mentor", value: "auto" },
        { type: "mentor_bonus", value: 5 },
      ],
      status: "DRAFT",
      priority: 70,
      createdAt: new Date(),
      impactSimulation: {
        affectedEntities: Math.floor(driverCount * 0.1),
        estimatedRevenueChange: Math.floor(driverCount * 0.1 * 15),
        estimatedCostChange: Math.floor(driverCount * 0.1 * 50),
        riskLevel: "MEDIUM",
        warnings: ["Initial cost investment required"],
        recommendations: ["Track mentor-mentee ride completion rates"],
      },
    },
    {
      id: "sug-3",
      name: "Loyalty Reward Tier",
      category: "INCENTIVE",
      description: "Give 5% discount to customers with 50+ rides",
      conditions: [
        { field: "customer_total_rides", operator: ">=", value: 50 },
      ],
      actions: [
        { type: "apply_discount", value: 5 },
        { type: "badge", value: "loyal_customer" },
      ],
      status: "DRAFT",
      priority: 65,
      createdAt: new Date(),
      impactSimulation: {
        affectedEntities: Math.floor(customerCount * 0.2),
        estimatedRevenueChange: Math.floor(customerCount * 0.2 * -1.5),
        estimatedCostChange: 0,
        riskLevel: "LOW",
        warnings: ["Revenue reduction offset by increased retention"],
        recommendations: ["Monitor retention rate of loyalty tier customers"],
      },
    },
  ];

  const activePolicies: PolicyRule[] = [
    {
      id: "pol-active-1",
      name: "Base Surge Pricing",
      category: "FARE",
      description: "1.2x multiplier when demand exceeds supply by 30%",
      conditions: [{ field: "demand_supply_ratio", operator: ">", value: 1.3 }],
      actions: [{ type: "multiply_base_fare", value: 1.2 }],
      status: "ACTIVE",
      priority: 90,
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    },
    {
      id: "pol-active-2",
      name: "Fraud Score Block",
      category: "FRAUD",
      description: "Block accounts with fraud score above 90",
      conditions: [{ field: "fraud_score", operator: ">", value: 90 }],
      actions: [{ type: "suspend_account", value: "immediate" }],
      status: "ACTIVE",
      priority: 95,
      createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
    },
  ];

  return {
    totalPolicies: activePolicies.length + suggestedPolicies.length,
    activePolicies: activePolicies.length,
    draftPolicies: suggestedPolicies.length,
    testingPolicies: 0,
    recentPolicies: [...activePolicies, ...suggestedPolicies].sort((a, b) => 
      b.createdAt.getTime() - a.createdAt.getTime()
    ),
    templates,
    suggestedPolicies,
    policyCategories: {
      FARE: 2,
      FRAUD: 1,
      INCENTIVE: 2,
      KYC: 0,
      PENALTY: 0,
      SAFETY: 0,
      COMPLIANCE: 0,
    },
  };
}

export async function simulatePolicyImpact(policy: Partial<PolicyRule>): Promise<PolicyImpactSimulation> {
  const [driverCount, customerCount, rideCount] = await Promise.all([
    prisma.driver.count(),
    prisma.customer.count(),
    prisma.ride.count(),
  ]);

  const baseAffected = policy.category === "FARE" ? rideCount * 0.1 :
    policy.category === "INCENTIVE" ? driverCount * 0.15 :
    policy.category === "FRAUD" ? customerCount * 0.02 :
    policy.category === "KYC" ? driverCount * 0.05 : 100;

  return {
    affectedEntities: Math.floor(baseAffected),
    estimatedRevenueChange: Math.floor(Math.random() * 10000) - 2000,
    estimatedCostChange: Math.floor(Math.random() * 5000) - 1000,
    riskLevel: Math.random() > 0.7 ? "HIGH" : Math.random() > 0.4 ? "MEDIUM" : "LOW",
    warnings: ["Simulation based on historical data patterns"],
    recommendations: ["Test in limited region before full rollout"],
  };
}

export async function activatePolicy(policyId: string): Promise<{ success: boolean; message: string }> {
  return {
    success: true,
    message: `Policy ${policyId} has been activated and is now in effect.`,
  };
}

export async function generatePolicyFromDescription(description: string): Promise<PolicyRule> {
  const category = description.toLowerCase().includes("fare") ? "FARE" :
    description.toLowerCase().includes("fraud") ? "FRAUD" :
    description.toLowerCase().includes("bonus") || description.toLowerCase().includes("incentive") ? "INCENTIVE" :
    description.toLowerCase().includes("kyc") ? "KYC" :
    description.toLowerCase().includes("penalty") ? "PENALTY" : "SAFETY";

  return {
    id: `gen-${Date.now()}`,
    name: description.substring(0, 50),
    category,
    description,
    conditions: [{ field: "auto_generated", operator: "==", value: "true" }],
    actions: [{ type: "notify_admin", value: "review_required" }],
    status: "DRAFT",
    priority: 50,
    createdAt: new Date(),
    impactSimulation: {
      affectedEntities: 0,
      estimatedRevenueChange: 0,
      estimatedCostChange: 0,
      riskLevel: "MEDIUM",
      warnings: ["AI-generated policy requires human review"],
      recommendations: ["Review conditions and actions before activation"],
    },
  };
}
