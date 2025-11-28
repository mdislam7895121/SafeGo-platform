/**
 * Fare Calculation Hook
 * Fetches real-time fare calculations from the server
 */

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { 
  AllFaresResponse, 
  RouteInfoRequest, 
  RideTypeCode,
  RouteFareBreakdown 
} from "@/lib/fareTypes";

interface UseFareCalculationParams {
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
  routes: RouteInfoRequest[];
  countryCode?: string;
  cityCode?: string;
  surgeMultiplier?: number;
  enabled?: boolean;
}

interface FareCalculationState {
  fareMatrix: Record<RideTypeCode, Record<string, RouteFareBreakdown>> | null;
  isLoading: boolean;
  error: Error | null;
  getFare: (rideTypeCode: RideTypeCode, routeId: string) => RouteFareBreakdown | null;
  getCheapestFare: (routeId: string) => { rideTypeCode: RideTypeCode; fare: RouteFareBreakdown } | null;
  getRouteFareForRideType: (rideTypeCode: RideTypeCode) => RouteFareBreakdown | null;
  currency: string;
}

export function useFareCalculation({
  pickupLat,
  pickupLng,
  dropoffLat,
  dropoffLng,
  routes,
  countryCode = "US",
  cityCode,
  surgeMultiplier = 1,
  enabled = true,
}: UseFareCalculationParams): FareCalculationState {
  const isReady = 
    pickupLat !== null && 
    pickupLng !== null && 
    dropoffLat !== null && 
    dropoffLng !== null && 
    routes.length > 0;

  const { data, isLoading, error } = useQuery<AllFaresResponse>({
    queryKey: [
      "/api/fares/calculate-all",
      pickupLat,
      pickupLng,
      dropoffLat,
      dropoffLng,
      routes.map(r => r.routeId).join(","),
      surgeMultiplier,
    ],
    queryFn: async () => {
      return await apiRequest("/api/fares/calculate-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickupLat,
          pickupLng,
          dropoffLat,
          dropoffLng,
          routes: routes.map(r => ({
            routeId: r.routeId,
            distanceMiles: r.distanceMiles,
            durationMinutes: r.durationMinutes,
            trafficDurationMinutes: r.trafficDurationMinutes,
            polyline: r.polyline,
            summary: r.summary,
            avoidsHighways: r.avoidsHighways,
            avoidsTolls: r.avoidsTolls,
            tollSegments: r.tollSegments,
          })),
          countryCode,
          cityCode,
          surgeMultiplier,
        }),
      });
    },
    enabled: enabled && isReady,
    staleTime: 30000, // Cache for 30 seconds
    gcTime: 60000, // Keep in cache for 1 minute
    retry: 2,
    retryDelay: 1000,
  });

  // Build fare matrix indexed by [rideTypeCode][routeId]
  const fareMatrix: Record<RideTypeCode, Record<string, RouteFareBreakdown>> | null = 
    data?.success && data?.fareMatrix
      ? Object.entries(data.fareMatrix).reduce((matrix, [code, result]) => {
          matrix[code as RideTypeCode] = result.routeFares.reduce((routeMap, fare) => {
            routeMap[fare.routeId] = fare;
            return routeMap;
          }, {} as Record<string, RouteFareBreakdown>);
          return matrix;
        }, {} as Record<RideTypeCode, Record<string, RouteFareBreakdown>>)
      : null;

  const getFare = (rideTypeCode: RideTypeCode, routeId: string): RouteFareBreakdown | null => {
    if (!fareMatrix) return null;
    return fareMatrix[rideTypeCode]?.[routeId] || null;
  };

  const getCheapestFare = (routeId: string): { rideTypeCode: RideTypeCode; fare: RouteFareBreakdown } | null => {
    if (!fareMatrix) return null;
    
    let cheapest: { rideTypeCode: RideTypeCode; fare: RouteFareBreakdown } | null = null;
    
    for (const [code, routeFares] of Object.entries(fareMatrix)) {
      const fare = routeFares[routeId];
      if (fare && (!cheapest || fare.totalFare < cheapest.fare.totalFare)) {
        cheapest = { rideTypeCode: code as RideTypeCode, fare };
      }
    }
    
    return cheapest;
  };

  // Get the fare for a specific ride type using the first available route
  const getRouteFareForRideType = (rideTypeCode: RideTypeCode): RouteFareBreakdown | null => {
    if (!fareMatrix || routes.length === 0) return null;
    const firstRouteId = routes[0].routeId;
    return fareMatrix[rideTypeCode]?.[firstRouteId] || null;
  };

  return {
    fareMatrix,
    isLoading,
    error: error as Error | null,
    getFare,
    getCheapestFare,
    getRouteFareForRideType,
    currency: data?.currency || "USD",
  };
}
