import { createContext, useContext, useReducer, useEffect, ReactNode, useCallback } from "react";

export interface LocationData {
  address: string;
  lat: number;
  lng: number;
  placeId?: string;
  name?: string;
}

export interface RideOption {
  id: string;
  code: string;
  name: string;
  description: string;
  baseFare: number;
  estimatedFare: number;
  currency: string;
  etaMinutes: number;
  capacity: number;
  iconType: "economy" | "comfort" | "xl" | "premium";
  isPopular?: boolean;
  isEco?: boolean;
  surgeMultiplier?: number;
}

export interface PaymentMethod {
  id: string;
  type: "card" | "cash" | "wallet";
  label: string;
  lastFour?: string;
  isDefault?: boolean;
}

export interface FareEstimate {
  baseFare: number;
  distanceFare: number;
  timeFare: number;
  surgeFare: number;
  promoDiscount: number;
  totalFare: number;
  currency: string;
  distanceKm: number;
  durationMinutes: number;
}

export interface RouteData {
  distanceMiles: number;
  durationMinutes: number;
  rawDistanceMeters: number;
  rawDurationSeconds: number;
  routePolyline: string;
  providerSource: string;
}

export interface RouteAlternative {
  id: string;
  name: string;
  description: string;
  distanceMiles: number;
  durationMinutes: number;
  distanceText: string;
  durationText: string;
  polyline: string;
  rawDistanceMeters: number;
  rawDurationSeconds: number;
  trafficDurationSeconds?: number;
  trafficDurationText?: string;
  summary: string;
  warnings: string[];
  isFastest?: boolean;
  isShortest?: boolean;
  avoidsTolls?: boolean;
  avoidsHighways?: boolean;
}

export interface PromoValidation {
  code: string;
  valid: boolean;
  discountAmount: number;
  discountPercent: number;
  finalFare: number;
  displayMessage: string;
  errorCode?: string;
  errorMessage?: string;
  promoCodeId?: string;
  discountType?: "PERCENTAGE" | "FIXED_AMOUNT" | "CAPPED_PERCENTAGE";
  isCapped?: boolean;
}

export interface RideBookingState {
  step: "idle" | "pickup" | "dropoff" | "options" | "confirm" | "requesting" | "active";
  pickup: LocationData | null;
  dropoff: LocationData | null;
  routeData: RouteData | null;
  routeAlternatives: RouteAlternative[];
  selectedRouteId: string | null;
  selectedOption: RideOption | null;
  paymentMethod: PaymentMethod | null;
  promoCode: string | null;
  promoValid: boolean;
  promoValidation: PromoValidation | null;
  fareEstimate: FareEstimate | null;
  activeRideId: string | null;
  error: string | null;
}

type RideBookingAction =
  | { type: "SET_STEP"; step: RideBookingState["step"] }
  | { type: "SET_PICKUP"; pickup: LocationData }
  | { type: "SET_DROPOFF"; dropoff: LocationData }
  | { type: "SET_ROUTE_DATA"; routeData: RouteData | null }
  | { type: "SET_ROUTE_ALTERNATIVES"; alternatives: RouteAlternative[] }
  | { type: "SET_SELECTED_ROUTE"; routeId: string }
  | { type: "SET_OPTION"; option: RideOption }
  | { type: "SET_PAYMENT"; payment: PaymentMethod }
  | { type: "SET_PROMO"; code: string; valid: boolean }
  | { type: "SET_PROMO_VALIDATION"; validation: PromoValidation | null }
  | { type: "CLEAR_PROMO" }
  | { type: "SET_FARE_ESTIMATE"; estimate: FareEstimate }
  | { type: "SET_ACTIVE_RIDE"; rideId: string }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "CLEAR_BOOKING" }
  | { type: "RESTORE_STATE"; state: Partial<RideBookingState> };

const initialState: RideBookingState = {
  step: "idle",
  pickup: null,
  dropoff: null,
  routeData: null,
  routeAlternatives: [],
  selectedRouteId: null,
  selectedOption: null,
  paymentMethod: null,
  promoCode: null,
  promoValid: false,
  promoValidation: null,
  fareEstimate: null,
  activeRideId: null,
  error: null,
};

function rideBookingReducer(state: RideBookingState, action: RideBookingAction): RideBookingState {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, step: action.step, error: null };
    case "SET_PICKUP":
      return { ...state, pickup: action.pickup, error: null };
    case "SET_DROPOFF":
      return { ...state, dropoff: action.dropoff, error: null };
    case "SET_ROUTE_DATA":
      return { ...state, routeData: action.routeData, error: null };
    case "SET_ROUTE_ALTERNATIVES": {
      // Preserve selected route if it still exists in new alternatives
      // Use fuzzy matching as fallback if exact ID not found
      const existingSelection = state.selectedRouteId;
      const previousRoute = state.routeAlternatives.find(r => r.id === existingSelection);
      
      // First try: exact ID match
      let matchedRoute = action.alternatives.find(r => r.id === existingSelection);
      
      // Second try: fuzzy match if previous route exists but ID changed
      if (!matchedRoute && previousRoute && action.alternatives.length > 0) {
        // Match by similar characteristics: same avoidance flags, similar duration (within 10%), similar distance
        matchedRoute = action.alternatives.find(r => {
          const sameAvoidFlags = 
            (r.avoidsHighways || false) === (previousRoute.avoidsHighways || false) &&
            (r.avoidsTolls || false) === (previousRoute.avoidsTolls || false);
          
          if (!sameAvoidFlags) return false;
          
          // Duration within 10%
          const durationDiff = Math.abs(r.rawDurationSeconds - previousRoute.rawDurationSeconds);
          const durationSimilar = durationDiff / Math.max(r.rawDurationSeconds, previousRoute.rawDurationSeconds) <= 0.1;
          
          // Distance within 10%  
          const distanceDiff = Math.abs(r.rawDistanceMeters - previousRoute.rawDistanceMeters);
          const distanceSimilar = distanceDiff / Math.max(r.rawDistanceMeters, previousRoute.rawDistanceMeters) <= 0.1;
          
          return durationSimilar && distanceSimilar;
        });
      }
      
      const newSelectedId = matchedRoute?.id 
        || (action.alternatives.length > 0 ? action.alternatives[0].id : null);
      
      return { 
        ...state, 
        routeAlternatives: action.alternatives,
        selectedRouteId: newSelectedId,
        error: null 
      };
    }
    case "SET_SELECTED_ROUTE":
      return { ...state, selectedRouteId: action.routeId, error: null };
    case "SET_OPTION":
      return { ...state, selectedOption: action.option, error: null };
    case "SET_PAYMENT":
      return { ...state, paymentMethod: action.payment, error: null };
    case "SET_PROMO":
      return { ...state, promoCode: action.code, promoValid: action.valid, error: null };
    case "SET_PROMO_VALIDATION":
      return { 
        ...state, 
        promoValidation: action.validation,
        promoCode: action.validation?.code || null,
        promoValid: action.validation?.valid || false,
        error: null 
      };
    case "CLEAR_PROMO":
      return { 
        ...state, 
        promoCode: null, 
        promoValid: false, 
        promoValidation: null,
        error: null 
      };
    case "SET_FARE_ESTIMATE":
      return { ...state, fareEstimate: action.estimate, error: null };
    case "SET_ACTIVE_RIDE":
      return { ...state, activeRideId: action.rideId, step: "active", error: null };
    case "SET_ERROR":
      return { ...state, error: action.error };
    case "CLEAR_BOOKING":
      return { ...initialState };
    case "RESTORE_STATE":
      return { ...state, ...action.state };
    default:
      return state;
  }
}

interface RideBookingContextType {
  state: RideBookingState;
  setStep: (step: RideBookingState["step"]) => void;
  setPickup: (pickup: LocationData) => void;
  setDropoff: (dropoff: LocationData) => void;
  setRouteData: (routeData: RouteData | null) => void;
  setRouteAlternatives: (alternatives: RouteAlternative[]) => void;
  setSelectedRoute: (routeId: string) => void;
  setSelectedOption: (option: RideOption) => void;
  setPaymentMethod: (payment: PaymentMethod) => void;
  setPromoCode: (code: string, valid: boolean) => void;
  setPromoValidation: (validation: PromoValidation | null) => void;
  clearPromo: () => void;
  setFareEstimate: (estimate: FareEstimate) => void;
  setActiveRide: (rideId: string) => void;
  setError: (error: string | null) => void;
  clearBooking: () => void;
  canProceedToDropoff: boolean;
  canProceedToOptions: boolean;
  canProceedToConfirm: boolean;
  getSelectedRoute: () => RouteAlternative | null;
}

const RideBookingContext = createContext<RideBookingContextType | undefined>(undefined);

const STORAGE_KEY = "safego_ride_booking";

export function RideBookingProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(rideBookingReducer, initialState);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.step !== "active" && parsed.step !== "requesting") {
          dispatch({ type: "RESTORE_STATE", state: parsed });
        }
      }
    } catch (e) {
      console.warn("Failed to restore ride booking state:", e);
    }
  }, []);

  useEffect(() => {
    if (state.step !== "idle") {
      try {
        const toStore = {
          step: state.step,
          pickup: state.pickup,
          dropoff: state.dropoff,
          routeData: state.routeData,
          routeAlternatives: state.routeAlternatives,
          selectedRouteId: state.selectedRouteId,
          selectedOption: state.selectedOption,
          paymentMethod: state.paymentMethod,
          promoCode: state.promoCode,
          promoValid: state.promoValid,
          promoValidation: state.promoValidation,
          fareEstimate: state.fareEstimate,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
      } catch (e) {
        console.warn("Failed to persist ride booking state:", e);
      }
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [state]);

  const setStep = useCallback((step: RideBookingState["step"]) => {
    dispatch({ type: "SET_STEP", step });
  }, []);

  const setPickup = useCallback((pickup: LocationData) => {
    dispatch({ type: "SET_PICKUP", pickup });
  }, []);

  const setDropoff = useCallback((dropoff: LocationData) => {
    dispatch({ type: "SET_DROPOFF", dropoff });
  }, []);

  const setRouteData = useCallback((routeData: RouteData | null) => {
    dispatch({ type: "SET_ROUTE_DATA", routeData });
  }, []);

  const setRouteAlternatives = useCallback((alternatives: RouteAlternative[]) => {
    dispatch({ type: "SET_ROUTE_ALTERNATIVES", alternatives });
  }, []);

  const setSelectedRoute = useCallback((routeId: string) => {
    dispatch({ type: "SET_SELECTED_ROUTE", routeId });
  }, []);

  const getSelectedRoute = useCallback((): RouteAlternative | null => {
    if (!state.selectedRouteId || state.routeAlternatives.length === 0) return null;
    return state.routeAlternatives.find(r => r.id === state.selectedRouteId) || null;
  }, [state.selectedRouteId, state.routeAlternatives]);

  const setSelectedOption = useCallback((option: RideOption) => {
    dispatch({ type: "SET_OPTION", option });
  }, []);

  const setPaymentMethod = useCallback((payment: PaymentMethod) => {
    dispatch({ type: "SET_PAYMENT", payment });
  }, []);

  const setPromoCode = useCallback((code: string, valid: boolean) => {
    dispatch({ type: "SET_PROMO", code, valid });
  }, []);

  const setPromoValidation = useCallback((validation: PromoValidation | null) => {
    dispatch({ type: "SET_PROMO_VALIDATION", validation });
  }, []);

  const clearPromo = useCallback(() => {
    dispatch({ type: "CLEAR_PROMO" });
  }, []);

  const setFareEstimate = useCallback((estimate: FareEstimate) => {
    dispatch({ type: "SET_FARE_ESTIMATE", estimate });
  }, []);

  const setActiveRide = useCallback((rideId: string) => {
    dispatch({ type: "SET_ACTIVE_RIDE", rideId });
  }, []);

  const setError = useCallback((error: string | null) => {
    dispatch({ type: "SET_ERROR", error });
  }, []);

  const clearBooking = useCallback(() => {
    dispatch({ type: "CLEAR_BOOKING" });
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const canProceedToDropoff = !!state.pickup?.address && !!state.pickup?.lat && !!state.pickup?.lng;
  const canProceedToOptions = canProceedToDropoff && !!state.dropoff?.address && !!state.dropoff?.lat && !!state.dropoff?.lng;
  const canProceedToConfirm = canProceedToOptions && !!state.selectedOption && !!state.paymentMethod;

  return (
    <RideBookingContext.Provider
      value={{
        state,
        setStep,
        setPickup,
        setDropoff,
        setRouteData,
        setRouteAlternatives,
        setSelectedRoute,
        setSelectedOption,
        setPaymentMethod,
        setPromoCode,
        setPromoValidation,
        clearPromo,
        setFareEstimate,
        setActiveRide,
        setError,
        clearBooking,
        canProceedToDropoff,
        canProceedToOptions,
        canProceedToConfirm,
        getSelectedRoute,
      }}
    >
      {children}
    </RideBookingContext.Provider>
  );
}

export function useRideBooking() {
  const context = useContext(RideBookingContext);
  if (!context) {
    throw new Error("useRideBooking must be used within a RideBookingProvider");
  }
  return context;
}
