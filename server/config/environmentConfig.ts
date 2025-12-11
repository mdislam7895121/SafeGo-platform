/**
 * Environment Configuration Service
 * Provides centralized environment-aware configuration for dev/staging/production
 * Implements feature gates, environment indicators, and separation controls
 */

export type EnvironmentType = 'development' | 'staging' | 'production' | 'test';

export interface EnvironmentConfig {
  name: EnvironmentType;
  displayName: string;
  isProduction: boolean;
  isDevelopment: boolean;
  isStaging: boolean;
  isTest: boolean;
  features: FeatureGates;
  limits: EnvironmentLimits;
  logging: LoggingConfig;
  security: SecurityConfig;
}

export interface FeatureGates {
  enableDebugMode: boolean;
  enableMockPayments: boolean;
  enableTestUsers: boolean;
  enableDetailedErrors: boolean;
  enableApiPlayground: boolean;
  enableAdminImpersonation: boolean;
  enableBulkOperations: boolean;
  enableExperimentalFeatures: boolean;
  enableRateLimitBypass: boolean;
  enableAuditLogExport: boolean;
  enableDatabaseExport: boolean;
  enableRealTimeNotifications: boolean;
  enableAdvancedAnalytics: boolean;
}

export interface EnvironmentLimits {
  maxUploadSizeMB: number;
  maxBatchSize: number;
  apiRateLimitPerMinute: number;
  sessionTimeoutMinutes: number;
  maxLoginAttempts: number;
  passwordMinLength: number;
  auditRetentionDays: number;
}

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  enableRequestLogging: boolean;
  enableSqlLogging: boolean;
  enablePerformanceLogging: boolean;
  sanitizeSensitiveData: boolean;
}

export interface SecurityConfig {
  requireMfa: boolean;
  requireHttps: boolean;
  enableCors: boolean;
  corsOrigins: string[];
  enableIpWhitelist: boolean;
  ipWhitelist: string[];
  sessionCookieSecure: boolean;
  csrfProtection: boolean;
}

function getEnvironmentType(): EnvironmentType {
  const env = process.env.NODE_ENV?.toLowerCase() || 'development';
  
  if (env === 'production' || env === 'prod') return 'production';
  if (env === 'staging' || env === 'stage') return 'staging';
  if (env === 'test' || env === 'testing') return 'test';
  return 'development';
}

function getDevelopmentConfig(): EnvironmentConfig {
  return {
    name: 'development',
    displayName: 'Development',
    isProduction: false,
    isDevelopment: true,
    isStaging: false,
    isTest: false,
    features: {
      enableDebugMode: true,
      enableMockPayments: true,
      enableTestUsers: true,
      enableDetailedErrors: true,
      enableApiPlayground: true,
      enableAdminImpersonation: true,
      enableBulkOperations: true,
      enableExperimentalFeatures: true,
      enableRateLimitBypass: true,
      enableAuditLogExport: true,
      enableDatabaseExport: true,
      enableRealTimeNotifications: true,
      enableAdvancedAnalytics: true,
    },
    limits: {
      maxUploadSizeMB: 50,
      maxBatchSize: 1000,
      apiRateLimitPerMinute: 1000,
      sessionTimeoutMinutes: 480,
      maxLoginAttempts: 100,
      passwordMinLength: 6,
      auditRetentionDays: 30,
    },
    logging: {
      level: 'debug',
      enableRequestLogging: true,
      enableSqlLogging: true,
      enablePerformanceLogging: true,
      sanitizeSensitiveData: true,
    },
    security: {
      requireMfa: false,
      requireHttps: false,
      enableCors: true,
      corsOrigins: ['*'],
      enableIpWhitelist: false,
      ipWhitelist: [],
      sessionCookieSecure: false,
      csrfProtection: false,
    },
  };
}

function getStagingConfig(): EnvironmentConfig {
  return {
    name: 'staging',
    displayName: 'Staging',
    isProduction: false,
    isDevelopment: false,
    isStaging: true,
    isTest: false,
    features: {
      enableDebugMode: true,
      enableMockPayments: true,
      enableTestUsers: true,
      enableDetailedErrors: true,
      enableApiPlayground: true,
      enableAdminImpersonation: true,
      enableBulkOperations: true,
      enableExperimentalFeatures: true,
      enableRateLimitBypass: false,
      enableAuditLogExport: true,
      enableDatabaseExport: true,
      enableRealTimeNotifications: true,
      enableAdvancedAnalytics: true,
    },
    limits: {
      maxUploadSizeMB: 25,
      maxBatchSize: 500,
      apiRateLimitPerMinute: 300,
      sessionTimeoutMinutes: 120,
      maxLoginAttempts: 10,
      passwordMinLength: 8,
      auditRetentionDays: 60,
    },
    logging: {
      level: 'info',
      enableRequestLogging: true,
      enableSqlLogging: false,
      enablePerformanceLogging: true,
      sanitizeSensitiveData: true,
    },
    security: {
      requireMfa: false,
      requireHttps: true,
      enableCors: true,
      corsOrigins: [process.env.ALLOWED_ORIGINS || '*'],
      enableIpWhitelist: false,
      ipWhitelist: [],
      sessionCookieSecure: true,
      csrfProtection: true,
    },
  };
}

function getProductionConfig(): EnvironmentConfig {
  return {
    name: 'production',
    displayName: 'Production',
    isProduction: true,
    isDevelopment: false,
    isStaging: false,
    isTest: false,
    features: {
      enableDebugMode: false,
      enableMockPayments: false,
      enableTestUsers: false,
      enableDetailedErrors: false,
      enableApiPlayground: false,
      enableAdminImpersonation: false,
      enableBulkOperations: true,
      enableExperimentalFeatures: false,
      enableRateLimitBypass: false,
      enableAuditLogExport: true,
      enableDatabaseExport: false,
      enableRealTimeNotifications: true,
      enableAdvancedAnalytics: true,
    },
    limits: {
      maxUploadSizeMB: 10,
      maxBatchSize: 100,
      apiRateLimitPerMinute: 100,
      sessionTimeoutMinutes: 60,
      maxLoginAttempts: 5,
      passwordMinLength: 12,
      auditRetentionDays: 365,
    },
    logging: {
      level: 'warn',
      enableRequestLogging: false,
      enableSqlLogging: false,
      enablePerformanceLogging: false,
      sanitizeSensitiveData: true,
    },
    security: {
      requireMfa: true,
      requireHttps: true,
      enableCors: true,
      corsOrigins: (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean),
      enableIpWhitelist: true,
      ipWhitelist: (process.env.ADMIN_IP_WHITELIST || '').split(',').filter(Boolean),
      sessionCookieSecure: true,
      csrfProtection: true,
    },
  };
}

function getTestConfig(): EnvironmentConfig {
  return {
    name: 'test',
    displayName: 'Test',
    isProduction: false,
    isDevelopment: false,
    isStaging: false,
    isTest: true,
    features: {
      enableDebugMode: true,
      enableMockPayments: true,
      enableTestUsers: true,
      enableDetailedErrors: true,
      enableApiPlayground: false,
      enableAdminImpersonation: true,
      enableBulkOperations: true,
      enableExperimentalFeatures: true,
      enableRateLimitBypass: true,
      enableAuditLogExport: true,
      enableDatabaseExport: true,
      enableRealTimeNotifications: false,
      enableAdvancedAnalytics: false,
    },
    limits: {
      maxUploadSizeMB: 50,
      maxBatchSize: 1000,
      apiRateLimitPerMinute: 10000,
      sessionTimeoutMinutes: 999,
      maxLoginAttempts: 1000,
      passwordMinLength: 4,
      auditRetentionDays: 1,
    },
    logging: {
      level: 'error',
      enableRequestLogging: false,
      enableSqlLogging: false,
      enablePerformanceLogging: false,
      sanitizeSensitiveData: false,
    },
    security: {
      requireMfa: false,
      requireHttps: false,
      enableCors: true,
      corsOrigins: ['*'],
      enableIpWhitelist: false,
      ipWhitelist: [],
      sessionCookieSecure: false,
      csrfProtection: false,
    },
  };
}

let cachedConfig: EnvironmentConfig | null = null;

export function getEnvironmentConfig(): EnvironmentConfig {
  if (cachedConfig) return cachedConfig;
  
  const envType = getEnvironmentType();
  
  switch (envType) {
    case 'production':
      cachedConfig = getProductionConfig();
      break;
    case 'staging':
      cachedConfig = getStagingConfig();
      break;
    case 'test':
      cachedConfig = getTestConfig();
      break;
    default:
      cachedConfig = getDevelopmentConfig();
  }
  
  return cachedConfig;
}

export function isFeatureEnabled(featureName: keyof FeatureGates): boolean {
  const config = getEnvironmentConfig();
  return config.features[featureName] ?? false;
}

export function getLimit(limitName: keyof EnvironmentLimits): number {
  const config = getEnvironmentConfig();
  return config.limits[limitName];
}

export function getEnvironmentIndicator(): {
  name: string;
  color: string;
  icon: string;
  showBanner: boolean;
} {
  const config = getEnvironmentConfig();
  
  switch (config.name) {
    case 'production':
      return {
        name: 'Production',
        color: 'green',
        icon: 'shield-check',
        showBanner: false,
      };
    case 'staging':
      return {
        name: 'Staging',
        color: 'yellow',
        icon: 'flask',
        showBanner: true,
      };
    case 'test':
      return {
        name: 'Test',
        color: 'purple',
        icon: 'beaker',
        showBanner: true,
      };
    default:
      return {
        name: 'Development',
        color: 'blue',
        icon: 'code',
        showBanner: true,
      };
  }
}

export function getEnvironmentConfigSummary(): Record<string, any> {
  const config = getEnvironmentConfig();
  return {
    environment: config.name,
    displayName: config.displayName,
    isProduction: config.isProduction,
    featuresEnabled: Object.entries(config.features)
      .filter(([_, enabled]) => enabled)
      .map(([name]) => name),
    featuresDisabled: Object.entries(config.features)
      .filter(([_, enabled]) => !enabled)
      .map(([name]) => name),
    limits: config.limits,
    securityLevel: config.isProduction ? 'HIGH' : config.isStaging ? 'MEDIUM' : 'LOW',
  };
}

export function clearConfigCache(): void {
  cachedConfig = null;
}
