import { runSecurityAudit, getSecurityAuditSummary } from '../server/services/appSecurityAudit';
import { getSystemHealthSummary, getRecentAttacks, getSecurityFindings } from '../server/services/monitoringService';
import { runDeploymentChecks } from '../server/services/productionPrepService';
import { getRateLimitStats } from '../server/middleware/safegoRateLimiter';

async function fullSecurityAudit() {
  console.log('='.repeat(80));
  console.log('SAFEGO FULL SECURITY AUDIT REPORT');
  console.log('Generated:', new Date().toISOString());
  console.log('='.repeat(80));
  
  console.log('\n[1] SECURITY AUDIT SCAN');
  console.log('-'.repeat(40));
  try {
    const auditResult = await runSecurityAudit();
    console.log('Audit completed:', auditResult.timestamp);
    console.log('Total findings:', auditResult.totalFindings);
    console.log('Critical:', auditResult.critical);
    console.log('High:', auditResult.high);
    console.log('Medium:', auditResult.medium);
    console.log('Low:', auditResult.low);
    
    if (auditResult.findings && auditResult.findings.length > 0) {
      console.log('\nFindings:');
      auditResult.findings.forEach((f: any, i: number) => {
        console.log(`  ${i+1}. [${f.severity}] ${f.type}: ${f.description}`);
      });
    }
  } catch (error: any) {
    console.log('Audit error:', error.message);
  }
  
  console.log('\n[2] SYSTEM HEALTH STATUS');
  console.log('-'.repeat(40));
  try {
    const health = await getSystemHealthSummary();
    console.log('Overall Status:', health.status);
    console.log('Database:', health.database);
    console.log('Memory Usage:', health.memoryUsage);
    console.log('Uptime:', health.uptime);
    console.log('Active Connections:', health.activeConnections);
  } catch (error: any) {
    console.log('Health check error:', error.message);
  }
  
  console.log('\n[3] RATE LIMITING STATISTICS');
  console.log('-'.repeat(40));
  try {
    const stats = getRateLimitStats();
    console.log('Total requests tracked:', stats.totalRequests);
    console.log('Blocked requests:', stats.blockedRequests);
    console.log('Active limiters:', stats.activeLimiters);
    if (stats.topBlockedEndpoints && stats.topBlockedEndpoints.length > 0) {
      console.log('Top blocked endpoints:');
      stats.topBlockedEndpoints.forEach((e: any) => {
        console.log(`  - ${e.endpoint}: ${e.count} blocks`);
      });
    }
  } catch (error: any) {
    console.log('Rate limit stats error:', error.message);
  }
  
  console.log('\n[4] RECENT ATTACK LOGS');
  console.log('-'.repeat(40));
  try {
    const attacks = await getRecentAttacks(10);
    if (attacks.length === 0) {
      console.log('No attacks detected in recent logs.');
    } else {
      attacks.forEach((a: any) => {
        console.log(`  [${a.createdAt}] ${a.type}: ${a.description}`);
      });
    }
  } catch (error: any) {
    console.log('Attack logs error:', error.message);
  }
  
  console.log('\n[5] DEPLOYMENT READINESS CHECK');
  console.log('-'.repeat(40));
  try {
    const deployment = await runDeploymentChecks();
    console.log('Ready for deployment:', deployment.ready);
    console.log('Checks passed:', deployment.passed, '/', deployment.total);
    
    if (deployment.checks && deployment.checks.length > 0) {
      deployment.checks.forEach((c: any) => {
        const icon = c.passed ? '✓' : '✗';
        console.log(`  ${icon} ${c.name}: ${c.message}`);
      });
    }
  } catch (error: any) {
    console.log('Deployment check error:', error.message);
  }
  
  console.log('\n[6] SECURITY FINDINGS SUMMARY');
  console.log('-'.repeat(40));
  try {
    const summary = await getSecurityAuditSummary();
    console.log('Total findings:', summary.total);
    console.log('Open:', summary.open);
    console.log('Resolved:', summary.resolved);
    console.log('By severity:');
    Object.entries(summary.bySeverity || {}).forEach(([sev, count]) => {
      console.log(`  ${sev}: ${count}`);
    });
  } catch (error: any) {
    console.log('Summary error:', error.message);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('AUDIT COMPLETE');
  console.log('='.repeat(80));
  
  process.exit(0);
}

fullSecurityAudit().catch(console.error);
