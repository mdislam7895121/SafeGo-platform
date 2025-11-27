export enum NavigationProvider {
  SAFEGO = "safego",
  GOOGLE_MAPS = "google",
  APPLE_MAPS = "apple",
  WAZE = "waze",
}

export interface NavigationProviderInfo {
  id: NavigationProvider;
  name: string;
  description: string;
  icon: "map-pin" | "external-link";
  isExternal: boolean;
}

export const NAVIGATION_PROVIDERS: NavigationProviderInfo[] = [
  {
    id: NavigationProvider.SAFEGO,
    name: "SafeGo Map",
    description: "Use in-app navigation (recommended)",
    icon: "map-pin",
    isExternal: false,
  },
  {
    id: NavigationProvider.GOOGLE_MAPS,
    name: "Google Maps",
    description: "Open in Google Maps",
    icon: "external-link",
    isExternal: true,
  },
  {
    id: NavigationProvider.APPLE_MAPS,
    name: "Apple Maps",
    description: "Open in Apple Maps (iOS/macOS)",
    icon: "external-link",
    isExternal: true,
  },
  {
    id: NavigationProvider.WAZE,
    name: "Waze",
    description: "Open in Waze",
    icon: "external-link",
    isExternal: true,
  },
];

export interface NavigationCoordinates {
  pickupLat?: number | null;
  pickupLng?: number | null;
  dropoffLat?: number | null;
  dropoffLng?: number | null;
  currentLat?: number | null;
  currentLng?: number | null;
}

export interface NavigationUrlParams {
  provider: NavigationProvider;
  destinationLat: number;
  destinationLng: number;
  originLat?: number;
  originLng?: number;
  tripId?: string;
}

export function buildNavigationUrl({
  provider,
  destinationLat,
  destinationLng,
  originLat,
  originLng,
}: NavigationUrlParams): string | null {
  const destination = `${destinationLat},${destinationLng}`;
  const origin = originLat && originLng ? `${originLat},${originLng}` : undefined;

  switch (provider) {
    case NavigationProvider.GOOGLE_MAPS:
      if (origin) {
        return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
      }
      return `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;

    case NavigationProvider.APPLE_MAPS:
      if (origin) {
        return `maps://?saddr=${origin}&daddr=${destination}&dirflg=d`;
      }
      return `maps://?daddr=${destination}&dirflg=d`;

    case NavigationProvider.WAZE:
      return `https://waze.com/ul?ll=${destination}&navigate=yes`;

    case NavigationProvider.SAFEGO:
    default:
      return null;
  }
}

export function buildTripNavigationUrl(
  provider: NavigationProvider,
  coordinates: NavigationCoordinates,
  isHeadingToPickup: boolean,
  tripId?: string
): string | null {
  const targetLat = isHeadingToPickup ? coordinates.pickupLat : coordinates.dropoffLat;
  const targetLng = isHeadingToPickup ? coordinates.pickupLng : coordinates.dropoffLng;

  if (!targetLat || !targetLng) {
    return null;
  }

  return buildNavigationUrl({
    provider,
    destinationLat: targetLat,
    destinationLng: targetLng,
    originLat: coordinates.currentLat ?? undefined,
    originLng: coordinates.currentLng ?? undefined,
    tripId,
  });
}

export function getProviderById(providerId: string): NavigationProviderInfo | undefined {
  return NAVIGATION_PROVIDERS.find((p) => p.id === providerId);
}

export function isExternalProvider(providerId: string): boolean {
  const provider = getProviderById(providerId);
  return provider?.isExternal ?? false;
}

export function getDefaultProvider(): NavigationProvider {
  return NavigationProvider.SAFEGO;
}

export interface NavigationPreferences {
  primaryProvider: NavigationProvider;
  showTrafficByDefault: boolean;
  autoRouteRecalculation: boolean;
}

export const DEFAULT_NAVIGATION_PREFERENCES: NavigationPreferences = {
  primaryProvider: NavigationProvider.SAFEGO,
  showTrafficByDefault: false,
  autoRouteRecalculation: true,
};

const NAVIGATION_PREFS_KEY = "safego_driver_navigation_prefs";

export function loadNavigationPreferences(): NavigationPreferences {
  try {
    const stored = localStorage.getItem(NAVIGATION_PREFS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        ...DEFAULT_NAVIGATION_PREFERENCES,
        ...parsed,
      };
    }
  } catch (e) {
    console.warn("Failed to load navigation preferences:", e);
  }
  return DEFAULT_NAVIGATION_PREFERENCES;
}

export function saveNavigationPreferences(prefs: Partial<NavigationPreferences>): void {
  try {
    const current = loadNavigationPreferences();
    const updated = { ...current, ...prefs };
    localStorage.setItem(NAVIGATION_PREFS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn("Failed to save navigation preferences:", e);
  }
}
