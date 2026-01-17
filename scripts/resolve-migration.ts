#!/usr/bin/env node

/**
 * Emergency Migration Resolution Script
 * 
 * This script safely resolves the failed add_primary_vehicle_constraint migration
 * by marking it as rolled-back and running the corrected fix_primary_vehicle_constraint.
 * 
 * USAGE: npx tsx scripts/resolve-migration.ts
 */

import { execSync } from 'child_process';

const FAILED_MIGRATION = 'add_primary_vehicle_constraint';
const FIXED_MIGRATION = 'fix_primary_vehicle_constraint';

async function main() {
  try {
    console.log('\n=== Prisma Migration Resolution ===\n');
    
    console.log(`1. Checking current migration status...`);
    try {
      const status = execSync('npx prisma migrate status', { encoding: 'utf8' });
      console.log(status);
    } catch (e) {
      console.warn('Status check failed, continuing...');
    }
    
    console.log(`\n2. Resolving failed migration '${FAILED_MIGRATION}' as ROLLED_BACK...`);
    console.log('   This marks the migration as rolled back without modifying the database.');
    console.log('   The corrected version will be applied next.\n');
    
    try {
      const resolve = execSync(
        `npx prisma migrate resolve --rolled-back "${FAILED_MIGRATION}"`,
        { encoding: 'utf8', stdio: 'inherit' }
      );
      console.log('✓ Migration marked as rolled back\n');
    } catch (e) {
      console.error('✗ Failed to resolve migration');
      console.error((e as any).message);
      process.exit(1);
    }
    
    console.log(`3. Deploying corrected migrations...`);
    try {
      const deploy = execSync('npx prisma migrate deploy', { encoding: 'utf8', stdio: 'inherit' });
      console.log('✓ Migrations deployed successfully\n');
    } catch (e) {
      console.error('✗ Migration deployment failed');
      console.error((e as any).message);
      process.exit(1);
    }
    
    console.log(`4. Verifying migration status...`);
    try {
      const status = execSync('npx prisma migrate status', { encoding: 'utf8' });
      console.log(status);
      if (status.includes('You are up to date') || status.includes('All migrations have been applied')) {
        console.log('\n✓ SUCCESS: All migrations are now applied!\n');
      } else {
        console.log('\n⚠ WARNING: There may be pending migrations. Check the output above.\n');
      }
    } catch (e) {
      console.warn('Status check failed after migration');
    }
    
  } catch (error) {
    console.error('\n✗ Fatal error during migration resolution:', error);
    process.exit(1);
  }
}

main();
