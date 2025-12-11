/**
 * Driver Trip Earnings View Types
 * 
 * Detailed earnings breakdown for drivers showing transparent trip costs and payouts.
 * This data is ONLY for driver-authenticated views and must NOT be exposed to riders.
 */

export interface RegulatoryBreakdown {
  congestion?: number;
  airportFee?: number;
  stateSurcharge?: number;
  hvfSurcharge?: number;
  tolls?: number;
  longTripFee?: number;
  outOfTownFee?: number;
  crossBoroughFee?: number;
  blackCarFund?: number;
  accessibleVehicleFee?: number;
  other?: number;
}

export interface DriverTripEarningsView {
  tripId: string;
  tripCode: string;
  city: string;
  borough?: string;
  serviceType: "RIDE" | "FOOD" | "PARCEL";
  categoryCode: string;
  categoryLabel: string;

  riderPaidTotal: number;
  riderCurrency: string;

  baseFare: number;
  distanceFare: number;
  timeFare: number;
  surgeAmount: number;
  bookingFee: number;
  otherServiceFees: number;
  tipAmount: number;
  tollsAmount: number;
  deliveryFee: number;

  hasRegulatoryFees: boolean;
  regulatoryFeesTotal: number;
  regulatoryBreakdown: RegulatoryBreakdown;

  promoCode: string | null;
  promoLabel: string | null;
  promoDiscountAmount: number;

  platformCommissionAmount: number;
  platformCommissionPercent: number;
  driverIncentivesAmount: number;

  driverEarningsNet: number;
  payoutCurrency: string;

  tripDistance: number;
  tripDistanceUnit: "miles" | "km";
  tripDurationMinutes: number;
  tripStartTime: string;
  tripEndTime: string | null;

  pickupAddress: string;
  dropoffAddress: string;
  customerFirstName?: string;
  customerRating?: number;
}

export interface DriverEarningsSummary {
  periodStart: string;
  periodEnd: string;
  totalTrips: number;
  completedTrips: number;
  cancelledTrips: number;
  totalRiderPayments: number;
  totalCommissionPaid: number;
  totalIncentivesEarned: number;
  totalRegulatoryFees: number;
  netEarnings: number;
  currency: string;
}
