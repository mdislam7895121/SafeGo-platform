const STORAGE_KEYS = {
  OFFLINE_ACTIONS_QUEUE: 'safego_offline_actions_queue',
  CACHED_ROUTE: 'safego_cached_route',
  CACHED_PICKUP: 'safego_cached_pickup',
  CACHED_DROPOFF: 'safego_cached_dropoff',
  RECENT_SEARCHES: 'safego_recent_searches',
  LAST_KNOWN_LOCATION: 'safego_last_known_location',
  DRIVER_ACTIVE_ROUTE: 'safego_driver_active_route',
  DRIVER_GPS_QUEUE: 'safego_driver_gps_queue',
  DRIVER_STATUS_QUEUE: 'safego_driver_status_queue',
};

export interface OfflineAction {
  id: string;
  type: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  payload?: unknown;
  timestamp: number;
  retryCount: number;
}

export interface CachedLocation {
  lat: number;
  lng: number;
  address: string;
  timestamp: number;
}

export interface CachedRoute {
  pickup: CachedLocation;
  dropoff: CachedLocation;
  polyline: [number, number][];
  distance: number;
  duration: number;
  timestamp: number;
}

export interface RecentSearch {
  query: string;
  location: CachedLocation;
  timestamp: number;
}

export interface DriverGPSPoint {
  lat: number;
  lng: number;
  timestamp: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
}

export interface DriverStatusUpdate {
  rideId: string;
  status: string;
  timestamp: number;
  location?: { lat: number; lng: number };
}

class OfflineStorageService {
  private isStorageAvailable(): boolean {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  private getItem<T>(key: string): T | null {
    if (!this.isStorageAvailable()) return null;
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch {
      return null;
    }
  }

  private setItem<T>(key: string, value: T): boolean {
    if (!this.isStorageAvailable()) return false;
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  private removeItem(key: string): void {
    if (!this.isStorageAvailable()) return;
    localStorage.removeItem(key);
  }

  getActionQueue(): OfflineAction[] {
    return this.getItem<OfflineAction[]>(STORAGE_KEYS.OFFLINE_ACTIONS_QUEUE) || [];
  }

  addToActionQueue(action: Omit<OfflineAction, 'id' | 'timestamp' | 'retryCount'>): void {
    const queue = this.getActionQueue();
    const newAction: OfflineAction = {
      ...action,
      id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      retryCount: 0,
    };
    queue.push(newAction);
    this.setItem(STORAGE_KEYS.OFFLINE_ACTIONS_QUEUE, queue);
  }

  removeFromActionQueue(actionId: string): void {
    const queue = this.getActionQueue();
    const filtered = queue.filter(a => a.id !== actionId);
    this.setItem(STORAGE_KEYS.OFFLINE_ACTIONS_QUEUE, filtered);
  }

  incrementRetryCount(actionId: string): void {
    const queue = this.getActionQueue();
    const action = queue.find(a => a.id === actionId);
    if (action) {
      action.retryCount += 1;
      this.setItem(STORAGE_KEYS.OFFLINE_ACTIONS_QUEUE, queue);
    }
  }

  clearActionQueue(): void {
    this.removeItem(STORAGE_KEYS.OFFLINE_ACTIONS_QUEUE);
  }

  getCachedRoute(): CachedRoute | null {
    const route = this.getItem<CachedRoute>(STORAGE_KEYS.CACHED_ROUTE);
    if (route && Date.now() - route.timestamp < 24 * 60 * 60 * 1000) {
      return route;
    }
    return null;
  }

  setCachedRoute(route: Omit<CachedRoute, 'timestamp'>): void {
    this.setItem(STORAGE_KEYS.CACHED_ROUTE, { ...route, timestamp: Date.now() });
  }

  clearCachedRoute(): void {
    this.removeItem(STORAGE_KEYS.CACHED_ROUTE);
  }

  getCachedPickup(): CachedLocation | null {
    return this.getItem<CachedLocation>(STORAGE_KEYS.CACHED_PICKUP);
  }

  setCachedPickup(location: Omit<CachedLocation, 'timestamp'>): void {
    this.setItem(STORAGE_KEYS.CACHED_PICKUP, { ...location, timestamp: Date.now() });
  }

  getCachedDropoff(): CachedLocation | null {
    return this.getItem<CachedLocation>(STORAGE_KEYS.CACHED_DROPOFF);
  }

  setCachedDropoff(location: Omit<CachedLocation, 'timestamp'>): void {
    this.setItem(STORAGE_KEYS.CACHED_DROPOFF, { ...location, timestamp: Date.now() });
  }

  getRecentSearches(): RecentSearch[] {
    const searches = this.getItem<RecentSearch[]>(STORAGE_KEYS.RECENT_SEARCHES) || [];
    return searches.slice(0, 10);
  }

  addRecentSearch(search: Omit<RecentSearch, 'timestamp'>): void {
    const searches = this.getRecentSearches();
    const exists = searches.findIndex(s => s.query.toLowerCase() === search.query.toLowerCase());
    if (exists >= 0) {
      searches.splice(exists, 1);
    }
    searches.unshift({ ...search, timestamp: Date.now() });
    this.setItem(STORAGE_KEYS.RECENT_SEARCHES, searches.slice(0, 10));
  }

  clearRecentSearches(): void {
    this.removeItem(STORAGE_KEYS.RECENT_SEARCHES);
  }

  getLastKnownLocation(): CachedLocation | null {
    return this.getItem<CachedLocation>(STORAGE_KEYS.LAST_KNOWN_LOCATION);
  }

  setLastKnownLocation(location: Omit<CachedLocation, 'timestamp'>): void {
    this.setItem(STORAGE_KEYS.LAST_KNOWN_LOCATION, { ...location, timestamp: Date.now() });
  }

  getDriverActiveRoute(): CachedRoute | null {
    return this.getItem<CachedRoute>(STORAGE_KEYS.DRIVER_ACTIVE_ROUTE);
  }

  setDriverActiveRoute(route: Omit<CachedRoute, 'timestamp'>): void {
    this.setItem(STORAGE_KEYS.DRIVER_ACTIVE_ROUTE, { ...route, timestamp: Date.now() });
  }

  clearDriverActiveRoute(): void {
    this.removeItem(STORAGE_KEYS.DRIVER_ACTIVE_ROUTE);
  }

  getDriverGPSQueue(): DriverGPSPoint[] {
    return this.getItem<DriverGPSPoint[]>(STORAGE_KEYS.DRIVER_GPS_QUEUE) || [];
  }

  addToDriverGPSQueue(point: DriverGPSPoint): void {
    const queue = this.getDriverGPSQueue();
    queue.push(point);
    if (queue.length > 1000) {
      queue.shift();
    }
    this.setItem(STORAGE_KEYS.DRIVER_GPS_QUEUE, queue);
  }

  clearDriverGPSQueue(): void {
    this.removeItem(STORAGE_KEYS.DRIVER_GPS_QUEUE);
  }

  getDriverStatusQueue(): DriverStatusUpdate[] {
    return this.getItem<DriverStatusUpdate[]>(STORAGE_KEYS.DRIVER_STATUS_QUEUE) || [];
  }

  addToDriverStatusQueue(update: DriverStatusUpdate): void {
    const queue = this.getDriverStatusQueue();
    queue.push(update);
    this.setItem(STORAGE_KEYS.DRIVER_STATUS_QUEUE, queue);
  }

  clearDriverStatusQueue(): void {
    this.removeItem(STORAGE_KEYS.DRIVER_STATUS_QUEUE);
  }

  getOfflineDataSummary(): { actionCount: number; hasRoute: boolean; gpsPoints: number; statusUpdates: number } {
    return {
      actionCount: this.getActionQueue().length,
      hasRoute: this.getCachedRoute() !== null || this.getDriverActiveRoute() !== null,
      gpsPoints: this.getDriverGPSQueue().length,
      statusUpdates: this.getDriverStatusQueue().length,
    };
  }
}

export const offlineStorage = new OfflineStorageService();
