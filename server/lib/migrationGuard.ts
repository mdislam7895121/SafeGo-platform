/**
 * Migration Guard: Safely attempts Prisma migrations at startup
 * - If migrations succeed, server starts normally
 * - If migrations fail, server starts in limited mode (health endpoints only)
 * - Prevents crash loops on migration failures
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function attemptPrismaMigrations(): Promise<{
  success: boolean;
  message: string;
  error?: string;
}> {
  try {
    console.log('[MigrationGuard] Starting Prisma migration check...');
    
    // Attempt to run pending migrations
    // This includes running `prisma migrate deploy`
    const { stdout, stderr } = await execAsync('npx prisma migrate deploy', {
      timeout: 30000, // 30 second timeout
      env: { ...process.env },
    });
    
    if (stderr && !stderr.includes('Applying migration')) {
      console.warn('[MigrationGuard] Migration stderr:', stderr);
    }
    
    console.log('[MigrationGuard] Migration check completed successfully');
    console.log('[MigrationGuard] Output:', stdout.split('\n').slice(0, 3).join(' | '));
    
    return {
      success: true,
      message: 'Prisma migrations applied successfully',
    };
  } catch (error: any) {
    const errorMessage = error.stderr || error.message || String(error);
    const isFailedMigrationError = errorMessage.includes('failed migrations');
    
    console.error('[MigrationGuard] Migration attempt failed');
    console.error('[MigrationGuard] Error:', errorMessage.split('\n').slice(0, 5).join(' | '));
    
    if (isFailedMigrationError) {
      console.error('[MigrationGuard] BLOCKED BY FAILED MIGRATION - Server starting in limited mode');
      console.error('[MigrationGuard] RESOLUTION NEEDED: Run `prisma migrate resolve` with appropriate action');
      return {
        success: false,
        message: 'Failed migrations detected - server will start with health endpoints only',
        error: 'Migration resolution required before full operation',
      };
    }
    
    return {
      success: false,
      message: 'Migration deployment failed',
      error: errorMessage,
    };
  }
}

export async function checkMigrationStatus(): Promise<{
  hasPendingMigrations: boolean;
  hasFailedMigrations: boolean;
  details: string;
}> {
  try {
    const { stdout } = await execAsync('npx prisma migrate status', {
      timeout: 10000,
      env: { ...process.env },
    });
    
    const output = stdout.toLowerCase();
    const hasPending = output.includes('1 migration');
    const hasFailed = output.includes('failed');
    
    return {
      hasPendingMigrations: hasPending,
      hasFailedMigrations: hasFailed,
      details: stdout.split('\n').slice(0, 3).join(' | '),
    };
  } catch (error: any) {
    console.warn('[MigrationGuard] Could not check migration status:', error.message);
    return {
      hasPendingMigrations: false,
      hasFailedMigrations: false,
      details: 'Status check unavailable',
    };
  }
}
