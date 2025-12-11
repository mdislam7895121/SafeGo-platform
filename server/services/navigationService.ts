import { prisma } from '../db';
import type { NavigationSession, NavigationWaypoint, RoutingConfig } from '@prisma/client';

interface RoutePoint {
  lat: number;
  lng: number;
}

interface RouteStep {
  instruction: string;
  maneuver?: string;
  distanceMeters: number;
  durationSeconds: number;
  startLocation: RoutePoint;
  endLocation: RoutePoint;
  roadName?: string;
}

interface RouteResult {
  polyline: string;
  distanceMeters: number;
  durationSeconds: number;
  steps: RouteStep[];
  provider: string;
}

interface NavigationUpdate {
  currentLat: number;
  currentLng: number;
  heading?: number;
  speed?: number;
}

type NavigationProviderType = 'openrouteservice' | 'mapbox' | 'google_maps' | 'internal';

const PROVIDER_CONFIG = {
  openrouteservice: {
    baseUrl: 'https://api.openrouteservice.org/v2/directions/driving-car',
    apiKeyEnv: 'OPENROUTESERVICE_API_KEY',
  },
  mapbox: {
    baseUrl: 'https://api.mapbox.com/directions/v5/mapbox/driving',
    apiKeyEnv: 'MAPBOX_ACCESS_TOKEN',
  },
  google_maps: {
    baseUrl: 'https://maps.googleapis.com/maps/api/directions/json',
    apiKeyEnv: 'GOOGLE_MAPS_API_KEY',
  },
};

class NavigationService {
  private defaultProvider: NavigationProviderType = 'internal';
  
  async getRoutingConfig(countryCode: string, cityCode?: string): Promise<RoutingConfig | null> {
    const config = await prisma.routingConfig.findFirst({
      where: {
        countryCode,
        cityCode: cityCode || null,
        isActive: true,
      },
    });
    
    if (!config && cityCode) {
      return prisma.routingConfig.findFirst({
        where: {
          countryCode,
          cityCode: null,
          isActive: true,
        },
      });
    }
    
    return config;
  }
  
  async fetchRoute(
    fromLat: number,
    fromLng: number,
    toLat: number,
    toLng: number,
    provider?: NavigationProviderType
  ): Promise<RouteResult> {
    const selectedProvider = provider || this.defaultProvider;
    
    try {
      switch (selectedProvider) {
        case 'google_maps':
          return await this.fetchGoogleMapsRoute(fromLat, fromLng, toLat, toLng);
        case 'mapbox':
          return await this.fetchMapboxRoute(fromLat, fromLng, toLat, toLng);
        case 'openrouteservice':
          return await this.fetchOpenRouteServiceRoute(fromLat, fromLng, toLat, toLng);
        default:
          return this.calculateInternalRoute(fromLat, fromLng, toLat, toLng);
      }
    } catch (error) {
      console.error(`[NavigationService] ${selectedProvider} failed, falling back to internal:`, error);
      return this.calculateInternalRoute(fromLat, fromLng, toLat, toLng);
    }
  }
  
  private async fetchGoogleMapsRoute(
    fromLat: number,
    fromLng: number,
    toLat: number,
    toLng: number
  ): Promise<RouteResult> {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      throw new Error('Google Maps API key not configured');
    }
    
    const url = new URL(PROVIDER_CONFIG.google_maps.baseUrl);
    url.searchParams.set('origin', `${fromLat},${fromLng}`);
    url.searchParams.set('destination', `${toLat},${toLng}`);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('mode', 'driving');
    
    const response = await fetch(url.toString());
    const data = await response.json();
    
    if (data.status !== 'OK' || !data.routes?.length) {
      throw new Error(`Google Maps API error: ${data.status}`);
    }
    
    const route = data.routes[0];
    const leg = route.legs[0];
    
    const steps: RouteStep[] = leg.steps.map((step: any) => ({
      instruction: step.html_instructions?.replace(/<[^>]*>/g, '') || '',
      maneuver: step.maneuver,
      distanceMeters: step.distance.value,
      durationSeconds: step.duration.value,
      startLocation: { lat: step.start_location.lat, lng: step.start_location.lng },
      endLocation: { lat: step.end_location.lat, lng: step.end_location.lng },
      roadName: step.html_instructions?.match(/on ([^<]+)/)?.[1],
    }));
    
    return {
      polyline: route.overview_polyline.points,
      distanceMeters: leg.distance.value,
      durationSeconds: leg.duration.value,
      steps,
      provider: 'google_maps',
    };
  }
  
  private async fetchMapboxRoute(
    fromLat: number,
    fromLng: number,
    toLat: number,
    toLng: number
  ): Promise<RouteResult> {
    const apiKey = process.env.MAPBOX_ACCESS_TOKEN;
    if (!apiKey) {
      throw new Error('Mapbox access token not configured');
    }
    
    const url = `${PROVIDER_CONFIG.mapbox.baseUrl}/${fromLng},${fromLat};${toLng},${toLat}?access_token=${apiKey}&steps=true&geometries=polyline&overview=full`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.code !== 'Ok' || !data.routes?.length) {
      throw new Error(`Mapbox API error: ${data.code}`);
    }
    
    const route = data.routes[0];
    const steps: RouteStep[] = route.legs[0].steps.map((step: any) => ({
      instruction: step.maneuver?.instruction || '',
      maneuver: step.maneuver?.type,
      distanceMeters: Math.round(step.distance),
      durationSeconds: Math.round(step.duration),
      startLocation: { lat: step.maneuver.location[1], lng: step.maneuver.location[0] },
      endLocation: { lat: step.maneuver.location[1], lng: step.maneuver.location[0] },
      roadName: step.name,
    }));
    
    return {
      polyline: route.geometry,
      distanceMeters: Math.round(route.distance),
      durationSeconds: Math.round(route.duration),
      steps,
      provider: 'mapbox',
    };
  }
  
  private async fetchOpenRouteServiceRoute(
    fromLat: number,
    fromLng: number,
    toLat: number,
    toLng: number
  ): Promise<RouteResult> {
    const apiKey = process.env.OPENROUTESERVICE_API_KEY;
    if (!apiKey) {
      throw new Error('OpenRouteService API key not configured');
    }
    
    const response = await fetch(PROVIDER_CONFIG.openrouteservice.baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        coordinates: [[fromLng, fromLat], [toLng, toLat]],
        format: 'json',
      }),
    });
    
    const data = await response.json();
    
    if (!data.routes?.length) {
      throw new Error('OpenRouteService returned no routes');
    }
    
    const route = data.routes[0];
    const steps: RouteStep[] = route.segments[0].steps.map((step: any) => ({
      instruction: step.instruction,
      maneuver: step.type?.toString(),
      distanceMeters: Math.round(step.distance * 1000),
      durationSeconds: Math.round(step.duration),
      startLocation: { lat: fromLat, lng: fromLng },
      endLocation: { lat: toLat, lng: toLng },
      roadName: step.name,
    }));
    
    return {
      polyline: route.geometry,
      distanceMeters: Math.round(route.summary.distance * 1000),
      durationSeconds: Math.round(route.summary.duration),
      steps,
      provider: 'openrouteservice',
    };
  }
  
  private calculateInternalRoute(
    fromLat: number,
    fromLng: number,
    toLat: number,
    toLng: number
  ): RouteResult {
    const R = 6371000;
    const dLat = this.toRad(toLat - fromLat);
    const dLng = this.toRad(toLng - fromLng);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRad(fromLat)) * Math.cos(this.toRad(toLat)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceMeters = Math.round(R * c);
    
    const avgSpeedMps = 8.33;
    const durationSeconds = Math.round(distanceMeters / avgSpeedMps);
    
    const bearing = this.calculateBearing(fromLat, fromLng, toLat, toLng);
    const direction = this.bearingToDirection(bearing);
    
    const steps: RouteStep[] = [
      {
        instruction: `Head ${direction} toward destination`,
        maneuver: 'depart',
        distanceMeters: Math.round(distanceMeters * 0.3),
        durationSeconds: Math.round(durationSeconds * 0.3),
        startLocation: { lat: fromLat, lng: fromLng },
        endLocation: { 
          lat: fromLat + (toLat - fromLat) * 0.3, 
          lng: fromLng + (toLng - fromLng) * 0.3 
        },
      },
      {
        instruction: 'Continue straight',
        maneuver: 'straight',
        distanceMeters: Math.round(distanceMeters * 0.6),
        durationSeconds: Math.round(durationSeconds * 0.6),
        startLocation: { 
          lat: fromLat + (toLat - fromLat) * 0.3, 
          lng: fromLng + (toLng - fromLng) * 0.3 
        },
        endLocation: { 
          lat: fromLat + (toLat - fromLat) * 0.9, 
          lng: fromLng + (toLng - fromLng) * 0.9 
        },
      },
      {
        instruction: 'Arrive at destination',
        maneuver: 'arrive',
        distanceMeters: Math.round(distanceMeters * 0.1),
        durationSeconds: Math.round(durationSeconds * 0.1),
        startLocation: { 
          lat: fromLat + (toLat - fromLat) * 0.9, 
          lng: fromLng + (toLng - fromLng) * 0.9 
        },
        endLocation: { lat: toLat, lng: toLng },
      },
    ];
    
    return {
      polyline: this.encodePolyline([
        { lat: fromLat, lng: fromLng },
        { lat: toLat, lng: toLng },
      ]),
      distanceMeters,
      durationSeconds,
      steps,
      provider: 'internal',
    };
  }
  
  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }
  
  private calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const dLng = this.toRad(lng2 - lng1);
    const y = Math.sin(dLng) * Math.cos(this.toRad(lat2));
    const x = Math.cos(this.toRad(lat1)) * Math.sin(this.toRad(lat2)) -
              Math.sin(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.cos(dLng);
    const bearing = Math.atan2(y, x) * (180 / Math.PI);
    return (bearing + 360) % 360;
  }
  
  private bearingToDirection(bearing: number): string {
    const directions = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
    const index = Math.round(bearing / 45) % 8;
    return directions[index];
  }
  
  private encodePolyline(points: RoutePoint[]): string {
    let encoded = '';
    let prevLat = 0;
    let prevLng = 0;
    
    for (const point of points) {
      const lat = Math.round(point.lat * 1e5);
      const lng = Math.round(point.lng * 1e5);
      
      encoded += this.encodeNumber(lat - prevLat);
      encoded += this.encodeNumber(lng - prevLng);
      
      prevLat = lat;
      prevLng = lng;
    }
    
    return encoded;
  }
  
  private encodeNumber(num: number): string {
    let encoded = '';
    let value = num < 0 ? ~(num << 1) : num << 1;
    
    while (value >= 0x20) {
      encoded += String.fromCharCode((0x20 | (value & 0x1f)) + 63);
      value >>= 5;
    }
    
    encoded += String.fromCharCode(value + 63);
    return encoded;
  }
  
  async startNavigation(
    driverId: string,
    tripType: string,
    tripId: string,
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
    provider?: NavigationProviderType
  ): Promise<NavigationSession> {
    const route = await this.fetchRoute(originLat, originLng, destLat, destLng, provider);
    
    const session = await prisma.navigationSession.create({
      data: {
        driverId,
        tripType,
        tripId,
        status: 'active',
        provider: (route.provider as any) || 'internal',
        originLat,
        originLng,
        destinationLat: destLat,
        destinationLng: destLng,
        currentLat: originLat,
        currentLng: originLng,
        polyline: route.polyline,
        totalDistanceMeters: route.distanceMeters,
        totalDurationSeconds: route.durationSeconds,
        remainingDistanceM: route.distanceMeters,
        remainingDurationSec: route.durationSeconds,
        currentStepIndex: 0,
      },
    });
    
    if (route.steps.length > 0) {
      await prisma.navigationWaypoint.createMany({
        data: route.steps.map((step, index) => ({
          sessionId: session.id,
          stepIndex: index,
          lat: step.startLocation.lat,
          lng: step.startLocation.lng,
          instruction: step.instruction,
          maneuver: step.maneuver,
          distanceMeters: step.distanceMeters,
          durationSeconds: step.durationSeconds,
          roadName: step.roadName,
        })),
      });
    }
    
    return session;
  }
  
  async updateDriverPosition(
    sessionId: string,
    update: NavigationUpdate
  ): Promise<NavigationSession | null> {
    const session = await prisma.navigationSession.findUnique({
      where: { id: sessionId },
      include: { waypoints: { orderBy: { stepIndex: 'asc' } } },
    });
    
    if (!session || session.status !== 'active') {
      return null;
    }
    
    const currentWaypoint = session.waypoints[session.currentStepIndex];
    let newStepIndex = session.currentStepIndex;
    
    if (currentWaypoint) {
      const distToWaypoint = this.calculateDistance(
        update.currentLat,
        update.currentLng,
        Number(currentWaypoint.lat),
        Number(currentWaypoint.lng)
      );
      
      if (distToWaypoint < 30) {
        await prisma.navigationWaypoint.update({
          where: { id: currentWaypoint.id },
          data: { passed: true, passedAt: new Date() },
        });
        
        if (newStepIndex < session.waypoints.length - 1) {
          newStepIndex++;
        }
      }
    }
    
    const distToDestination = this.calculateDistance(
      update.currentLat,
      update.currentLng,
      Number(session.destinationLat),
      Number(session.destinationLng)
    );
    
    const remainingSteps = session.waypoints.slice(newStepIndex);
    const remainingDistance = remainingSteps.reduce(
      (sum, step) => sum + (step.distanceMeters || 0),
      0
    );
    const remainingDuration = remainingSteps.reduce(
      (sum, step) => sum + (step.durationSeconds || 0),
      0
    );
    
    return prisma.navigationSession.update({
      where: { id: sessionId },
      data: {
        currentLat: update.currentLat,
        currentLng: update.currentLng,
        currentHeading: update.heading,
        currentSpeed: update.speed,
        currentStepIndex: newStepIndex,
        remainingDistanceM: Math.max(Math.round(distToDestination), 0),
        remainingDurationSec: Math.max(remainingDuration, 0),
        lastUpdateAt: new Date(),
      },
    });
  }
  
  async reroute(sessionId: string): Promise<NavigationSession | null> {
    const session = await prisma.navigationSession.findUnique({
      where: { id: sessionId },
    });
    
    if (!session || session.status !== 'active') {
      return null;
    }
    
    const currentLat = Number(session.currentLat) || Number(session.originLat);
    const currentLng = Number(session.currentLng) || Number(session.originLng);
    
    const route = await this.fetchRoute(
      currentLat,
      currentLng,
      Number(session.destinationLat),
      Number(session.destinationLng),
      session.provider as NavigationProviderType
    );
    
    await prisma.navigationWaypoint.deleteMany({
      where: { sessionId },
    });
    
    if (route.steps.length > 0) {
      await prisma.navigationWaypoint.createMany({
        data: route.steps.map((step, index) => ({
          sessionId,
          stepIndex: index,
          lat: step.startLocation.lat,
          lng: step.startLocation.lng,
          instruction: step.instruction,
          maneuver: step.maneuver,
          distanceMeters: step.distanceMeters,
          durationSeconds: step.durationSeconds,
          roadName: step.roadName,
        })),
      });
    }
    
    return prisma.navigationSession.update({
      where: { id: sessionId },
      data: {
        polyline: route.polyline,
        totalDistanceMeters: route.distanceMeters,
        totalDurationSeconds: route.durationSeconds,
        remainingDistanceM: route.distanceMeters,
        remainingDurationSec: route.durationSeconds,
        currentStepIndex: 0,
        rerouteCount: { increment: 1 },
        lastRerouteAt: new Date(),
        lastUpdateAt: new Date(),
      },
    });
  }
  
  async completeNavigation(sessionId: string): Promise<NavigationSession | null> {
    return prisma.navigationSession.update({
      where: { id: sessionId },
      data: {
        status: 'completed',
        completedAt: new Date(),
      },
    });
  }
  
  async cancelNavigation(sessionId: string): Promise<NavigationSession | null> {
    return prisma.navigationSession.update({
      where: { id: sessionId },
      data: {
        status: 'cancelled',
        completedAt: new Date(),
      },
    });
  }
  
  async getActiveSession(driverId: string): Promise<NavigationSession | null> {
    return prisma.navigationSession.findFirst({
      where: {
        driverId,
        status: 'active',
      },
      include: {
        waypoints: {
          orderBy: { stepIndex: 'asc' },
        },
      },
    });
  }
  
  async getSessionByTrip(tripType: string, tripId: string): Promise<NavigationSession | null> {
    return prisma.navigationSession.findFirst({
      where: {
        tripType,
        tripId,
        status: 'active',
      },
      include: {
        waypoints: {
          orderBy: { stepIndex: 'asc' },
        },
      },
    });
  }
  
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}

export const navigationService = new NavigationService();
