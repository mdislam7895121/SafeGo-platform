/**
 * SafeGo Memory Monitor
 * Tracks memory usage and logs warnings when thresholds are exceeded
 */

interface MemoryStats {
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
  rss: number;
  heapUsedMB: number;
  heapTotalMB: number;
  rssMB: number;
  percentUsed: number;
}

interface MemoryThresholds {
  warningPercent: number;
  criticalPercent: number;
  maxHeapMB: number;
}

const DEFAULT_THRESHOLDS: MemoryThresholds = {
  warningPercent: 70,
  criticalPercent: 85,
  maxHeapMB: 512,
};

let monitorInterval: NodeJS.Timeout | null = null;
let lastLogTime = 0;
const LOG_THROTTLE_MS = 60000;

function getMemoryStats(): MemoryStats {
  const mem = process.memoryUsage();
  const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(mem.heapTotal / 1024 / 1024);
  const rssMB = Math.round(mem.rss / 1024 / 1024);
  const percentUsed = Math.round((mem.heapUsed / mem.heapTotal) * 100);

  return {
    heapUsed: mem.heapUsed,
    heapTotal: mem.heapTotal,
    external: mem.external,
    arrayBuffers: mem.arrayBuffers,
    rss: mem.rss,
    heapUsedMB,
    heapTotalMB,
    rssMB,
    percentUsed,
  };
}

function logMemoryStatus(stats: MemoryStats, thresholds: MemoryThresholds, force = false): void {
  const now = Date.now();
  const shouldLog = force || (now - lastLogTime) >= LOG_THROTTLE_MS;

  if (!shouldLog) return;
  lastLogTime = now;

  const status = stats.percentUsed >= thresholds.criticalPercent
    ? 'CRITICAL'
    : stats.percentUsed >= thresholds.warningPercent
    ? 'WARNING'
    : 'OK';

  const logLevel = status === 'CRITICAL' ? 'error' : status === 'WARNING' ? 'warn' : 'info';
  const logFn = console[logLevel].bind(console);

  logFn(`[Memory Monitor] ${status} | Heap: ${stats.heapUsedMB}/${stats.heapTotalMB}MB (${stats.percentUsed}%) | RSS: ${stats.rssMB}MB`);

  if (status === 'CRITICAL') {
    logFn('[Memory Monitor] CRITICAL: Memory usage exceeds 85% threshold. Consider investigating memory leaks.');
  }
}

export function startMemoryMonitor(
  intervalMs = 30000,
  thresholds: Partial<MemoryThresholds> = {}
): void {
  if (monitorInterval) {
    console.log('[Memory Monitor] Already running, skipping duplicate start');
    return;
  }

  const finalThresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  console.log(`[Memory Monitor] Starting with ${intervalMs}ms interval, thresholds: warning=${finalThresholds.warningPercent}%, critical=${finalThresholds.criticalPercent}%`);

  const stats = getMemoryStats();
  logMemoryStatus(stats, finalThresholds, true);

  monitorInterval = setInterval(() => {
    const stats = getMemoryStats();
    logMemoryStatus(stats, finalThresholds);
  }, intervalMs);

  monitorInterval.unref();
}

export function stopMemoryMonitor(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    console.log('[Memory Monitor] Stopped');
  }
}

export function getMemoryReport(): MemoryStats {
  return getMemoryStats();
}

export function forceGarbageCollection(): boolean {
  if (global.gc) {
    global.gc();
    console.log('[Memory Monitor] Manual garbage collection triggered');
    return true;
  }
  console.warn('[Memory Monitor] GC not exposed. Run node with --expose-gc to enable manual GC.');
  return false;
}

export { MemoryStats, MemoryThresholds };
