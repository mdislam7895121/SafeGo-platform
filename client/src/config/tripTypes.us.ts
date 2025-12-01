export type DriverTripTypeCode =
  | "safego_x"
  | "safego_comfort"
  | "safego_xl"
  | "safego_comfort_xl"
  | "safego_black"
  | "safego_black_suv"
  | "safego_premium"
  | "safego_pet"
  | "safego_eats"
  | "safego_parcel";

export interface DriverTripTypeConfig {
  code: DriverTripTypeCode;
  title: string;
  icon: "car" | "truck" | "crown" | "pet" | "eats" | "parcel";
  isDefaultEnabled: boolean;
}

export const US_DRIVER_TRIP_TYPES: DriverTripTypeConfig[] = [
  { code: "safego_x", title: "SafeGo X", icon: "car", isDefaultEnabled: true },
  { code: "safego_comfort", title: "SafeGo Comfort", icon: "car", isDefaultEnabled: true },
  { code: "safego_xl", title: "SafeGo XL", icon: "truck", isDefaultEnabled: true },
  { code: "safego_comfort_xl", title: "Comfort XL", icon: "truck", isDefaultEnabled: false },
  { code: "safego_black", title: "SafeGo Black", icon: "crown", isDefaultEnabled: false },
  { code: "safego_black_suv", title: "Black SUV", icon: "crown", isDefaultEnabled: false },
  { code: "safego_premium", title: "SafeGo Premium", icon: "crown", isDefaultEnabled: false },
  { code: "safego_pet", title: "SafeGo Pet", icon: "pet", isDefaultEnabled: false },
  { code: "safego_eats", title: "SafeGo Eats", icon: "eats", isDefaultEnabled: true },
  { code: "safego_parcel", title: "SafeGo Parcel", icon: "parcel", isDefaultEnabled: true },
];

export type BDDriverTripTypeCode =
  | "safego_go"
  | "safego_bike"
  | "safego_cng"
  | "safego_moto"
  | "safego_eats"
  | "safego_parcel";

export interface BDDriverTripTypeConfig {
  code: BDDriverTripTypeCode;
  title: string;
  icon: "car" | "bike" | "zap" | "eats" | "parcel";
  isDefaultEnabled: boolean;
}

export const BD_DRIVER_TRIP_TYPES: BDDriverTripTypeConfig[] = [
  { code: "safego_go", title: "SafeGo Go", icon: "car", isDefaultEnabled: true },
  { code: "safego_bike", title: "SafeGo Bike", icon: "bike", isDefaultEnabled: true },
  { code: "safego_cng", title: "SafeGo CNG", icon: "zap", isDefaultEnabled: true },
  { code: "safego_moto", title: "SafeGo Moto", icon: "bike", isDefaultEnabled: true },
  { code: "safego_eats", title: "SafeGo Eats", icon: "eats", isDefaultEnabled: true },
  { code: "safego_parcel", title: "SafeGo Parcel", icon: "parcel", isDefaultEnabled: true },
];
