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

export interface RideBookingState {
  step: "idle" | "pickup" | "dropoff" | "options" | "confirm" | "requesting" | "active";
  pickup: LocationData | null;
  dropoff: LocationData | null;
  routeData: RouteData | null;
  selectedOption: RideOption | null;
  paymentMethod: PaymentMethod | null;
  promoCode: string | null;
  promoValid: boolean;
  fareEstimate: FareEstimate | null;
  activeRideId: string | null;
  error: string | null;
}

type RideBookingAction =
  | { type: "SET_STEP"; step: RideBookingState["step"] }
  | { type: "SET_PICKUP"; pickup: LocationData }
  | { type: "SET_DROPOFF"; dropoff: LocationData }
  | { type: "SET_ROUTE_DATA"; routeData: RouteData }
  | { type: "SET_OPTION"; option: RideOption }
  | { type: "SET_PAYMENT"; payment: PaymentMethod }
  | { type: "SET_PROMO"; code: string; valid: boolean }
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
  selectedOption: null,
  paymentMethod: null,
  promoCode: null,
  promoValid: false,
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
    case "SET_OPTION":
      return { ...state, selectedOption: action.option, error: null };
    case "SET_PAYMENT":
      return { ...state, paymentMethod: action.payment, error: null };
    case "SET_PROMO":
      return { ...state, promoCode: action.code, promoValid: action.valid, error: null };
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
  setRouteData: (routeData: RouteData) => void;
  setSelectedOption: (option: RideOption) => void;
  setPaymentMethod: (payment: PaymentMethod) => void;
  setPromoCode: (code: string, valid: boolean) => void;
  setFareEstimate: (estimate: FareEstimate) => void;
  setActiveRide: (rideId: string) => void;
  setError: (error: string | null) => void;
  clearBooking: () => void;
  canProceedToDropoff: boolean;
  canProceedToOptions: boolean;
  canProceedToConfirm: boolean;
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
          selectedOption: state.selectedOption,
          paymentMethod: state.paymentMethod,
          promoCode: state.promoCode,
          promoValid: state.promoValid,
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

  const setRouteData = useCallback((routeData: RouteData) => {
    dispatch({ type: "SET_ROUTE_DATA", routeData });
  }, []);

  const setSelectedOption = useCallback((option: RideOption) => {
    dispatch({ type: "SET_OPTION", option });
  }, []);

  const setPaymentMethod = useCallback((payment: PaymentMethod) => {
    dispatch({ type: "SET_PAYMENT", payment });
  }, []);

  const setPromoCode = useCallback((code: string, valid: boolean) => {
    dispatch({ type: "SET_PROMO", code, valid });
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
        setSelectedOption,
        setPaymentMethod,
        setPromoCode,
        setFareEstimate,
        setActiveRide,
        setError,
        clearBooking,
        canProceedToDropoff,
        canProceedToOptions,
        canProceedToConfirm,
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
