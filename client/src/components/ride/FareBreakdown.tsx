import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { 
  ChevronDown, 
  ChevronUp, 
  Car, 
  Clock, 
  Route, 
  Building2, 
  Percent,
  Receipt,
  Tag,
  Moon,
  TrendingUp,
  MapPin,
  Navigation,
  Shield,
  AlertCircle,
  Plane,
  ArrowRightLeft,
  FileText,
  Flag,
  DollarSign,
  Wallet,
  User,
  CircleAlert,
  Activity,
  Gauge,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export type DemandLevel = "low" | "normal" | "high";

export interface FareBreakdownData {
  tripFare: number;
  trafficAdjustment: number;
  trafficMultiplier?: number;
  tolls: number;
  cityFees: number;
  serviceFee: number;
  promoDiscount: number;
  totalFare: number;
  nightSurcharge?: number;
  peakHourSurcharge?: number;
  shortTripAdjustment?: number;
  longDistanceFee?: number;
  crossCitySurcharge?: number;
  crossStateSurcharge?: number;
  returnDeadheadFee?: number;
  excessReturnMiles?: number;
  airportFee?: number;
  airportCode?: string;
  borderZoneFee?: number;
  stateRegulatoryFee?: number;
  stateRegulatoryFeeLabel?: string;
  
  vehicleCategoryId?: string;
  vehicleCategoryDisplayName?: string;
  vehicleCategoryMultiplierApplied?: boolean;
  vehicleCategoryMinimumApplied?: boolean;
  preMultiplierBaseFare?: number;
  preMultiplierDistanceFare?: number;
  preMultiplierTimeFare?: number;
  vehicleCategoryMinimumFare?: number;
  
  // Cross-State Fare Engine (Uber-style pricing)
  crossStateFareApplied?: boolean;
  crossStatePickupState?: string;
  crossStateDropoffState?: string;
  crossStateFareBaseFare?: number;
  crossStateFareDistanceCost?: number;
  crossStateFareTimeCost?: number;
  crossStateFareSurcharge?: number;
  crossStateFareTolls?: number;
  crossStateFarePreSurgeSubtotal?: number;
  crossStateFareSurgeMultiplier?: number;
  crossStateFareSurgeAmount?: number;
  crossStateFareSurgeApplied?: boolean;
  crossStateFareTotal?: number;
  crossStateFareMinimumApplied?: boolean;
  crossStateFareMaximumApplied?: boolean;
  crossStateFareOriginal?: number;
  
  // NYC TLC Regulatory Fees
  tlcCongestionFee?: number;
  tlcCongestionFeeApplied?: boolean;
  tlcAirportFee?: number;
  tlcAirportName?: string;
  tlcAirportCode?: string;
  tlcAirportFeeApplied?: boolean;
  tlcAVFFee?: number;
  tlcAVFFeeApplied?: boolean;
  tlcBCFFee?: number;
  tlcBCFFeeRate?: number;
  tlcBCFFeeApplied?: boolean;
  tlcHVRFFee?: number;
  tlcHVRFFeeApplied?: boolean;
  tlcStateSurcharge?: number;
  tlcStateSurchargeApplied?: boolean;
  tlcLongTripFee?: number;
  tlcLongTripFeeApplied?: boolean;
  tlcOutOfTownFee?: number;
  tlcOutOfTownApplied?: boolean;
  
  // NYC TLC Cross-City (Cross-Borough) Fee
  tlcCrossCityFee?: number;
  tlcCrossCityFeeApplied?: boolean;
  tlcPickupBorough?: string;
  tlcDropoffBorough?: string;
  
  // NYC TLC Toll Facilities (bridges, tunnels with EZ-Pass rates)
  tlcTollsBreakdown?: Array<{
    id: string;
    name: string;
    shortName: string;
    amount: number;
    isPeak: boolean;
    operator: string;
    direction?: string;
  }>;
  tollsApplied?: boolean;
  
  surgeAmount?: number;
  surgeMultiplier?: number;
  surgeReason?: string;
  surgeReasons?: string[];
  surgeTimingWindow?: string;
  surgeCapped?: boolean;
  minimumFareApplied?: boolean;
  maximumFareApplied?: boolean;
  stateMinimumFareApplied?: boolean;
  stateMinimumFare?: number;
  absoluteMinimumFare?: number;
  originalFare?: number;
  driverMinimumPayoutApplied?: boolean;
  effectiveDiscountPct?: number;
  customerServiceFee?: number;
  platformCommission?: number;
  driverEarnings?: number;
  driverEarningsMinimumApplied?: boolean;
  marginProtectionCapped?: boolean;
  demandLevel?: DemandLevel;
  demandScore?: number;
  commissionRate?: number;
  dynamicCommissionApplied?: boolean;
  commissionCapped?: boolean;
  commissionFloored?: boolean;
  // Consolidated flags object
  flags?: {
    trafficApplied?: boolean;
    surgeApplied?: boolean;
    surgeCapped?: boolean;
    nightApplied?: boolean;
    peakApplied?: boolean;
    longDistanceApplied?: boolean;
    crossCityApplied?: boolean;
    crossStateApplied?: boolean;
    airportFeeApplied?: boolean;
    borderZoneApplied?: boolean;
    regulatoryFeeApplied?: boolean;
    returnDeadheadApplied?: boolean;
    promoApplied?: boolean;
    stateMinimumFareApplied?: boolean;
    shortTripAdjustmentApplied?: boolean;
    marginProtectionApplied?: boolean;
    marginProtectionCapped?: boolean;
    dynamicCommissionApplied?: boolean;
    commissionCapped?: boolean;
    commissionFloored?: boolean;
    // NYC TLC regulatory flags
    tlcCongestionFeeApplied?: boolean;
    tlcAirportFeeApplied?: boolean;
    tlcAVFFeeApplied?: boolean;
    tlcBCFFeeApplied?: boolean;
    tlcHVRFFeeApplied?: boolean;
    tlcStateSurchargeApplied?: boolean;
    tlcLongTripFeeApplied?: boolean;
    tlcOutOfTownApplied?: boolean;
    tlcCrossCityFeeApplied?: boolean;
    tollsApplied?: boolean;
  };
  // Legacy individual flags (for backward compatibility)
  crossCityApplied?: boolean;
  crossStateApplied?: boolean;
  regulatoryFeeApplied?: boolean;
  airportFeeApplied?: boolean;
  borderZoneFeeApplied?: boolean;
  returnDeadheadApplied?: boolean;
}

export interface FareBreakdownProps {
  breakdown: FareBreakdownData;
  currency?: string;
  className?: string;
  alwaysExpanded?: boolean;
}

function formatCurrency(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function getSurgeReasonLabel(reason: string): string {
  const labels: Record<string, string> = {
    weekday_morning_peak: 'Morning rush',
    weekday_evening_peak: 'Evening rush',
    weekend_friday_night: 'Friday night',
    weekend_saturday_night: 'Saturday night',
    weekend_sunday_evening: 'Sunday evening',
    weather_rain: 'Rainy weather',
    weather_snow: 'Snow conditions',
    weather_storm: 'Storm',
    weather_low_visibility: 'Low visibility',
    weather_extreme_cold: 'Extreme cold',
    event_pre: 'Event nearby',
    event_post: 'Event ended',
    airport_jfk: 'JFK zone',
    airport_lga: 'LGA zone',
    airport_ewr: 'Newark zone',
    driver_shortage: 'Fewer drivers',
    combined: 'Multiple factors',
    manual: 'High demand',
    none: '',
  };
  return labels[reason] || reason;
}

function getSurgeTimingWindowLabel(window: string): string {
  const labels: Record<string, string> = {
    weekday_morning: '7-10 AM',
    weekday_evening: '4-8 PM',
    friday_night: 'Fri 6 PM+',
    saturday_night: 'Sat 5 PM+',
    sunday_evening: 'Sun 5-9 PM',
    event_window: 'Event',
    airport_zone: 'Airport',
    off_peak: '',
    combined: 'Multiple',
  };
  return labels[window] || '';
}

interface BreakdownLineProps {
  icon: typeof Car;
  label: string;
  amount: number;
  currency: string;
  isDiscount?: boolean;
  isTotal?: boolean;
}

function BreakdownLine({ 
  icon: Icon, 
  label, 
  amount, 
  currency, 
  isDiscount = false,
  isTotal = false,
}: BreakdownLineProps) {
  if (amount === 0 && !isTotal) return null;

  return (
    <div 
      className={`flex items-center justify-between py-2 ${
        isTotal ? "border-t border-border pt-3 mt-1" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${isDiscount ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`} />
        <span className={`text-sm ${isTotal ? "font-semibold" : ""}`}>{label}</span>
      </div>
      <span 
        className={`text-sm ${
          isDiscount 
            ? "text-green-600 dark:text-green-400 font-medium" 
            : isTotal 
              ? "font-bold text-base" 
              : ""
        }`}
      >
        {isDiscount ? `-${formatCurrency(amount, currency)}` : formatCurrency(amount, currency)}
      </span>
    </div>
  );
}

function BreakdownContent({ breakdown, currency }: { breakdown: FareBreakdownData; currency: string }) {
  return (
    <div className="space-y-0.5">
      <BreakdownLine 
        icon={Car} 
        label="Trip fare" 
        amount={breakdown.tripFare} 
        currency={currency} 
      />
      <BreakdownLine 
        icon={Clock} 
        label="Traffic adjustment" 
        amount={breakdown.trafficAdjustment} 
        currency={currency} 
      />
      {(breakdown.surgeAmount ?? 0) > 0 && (
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-2 flex-wrap">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              Surge pricing ({breakdown.surgeMultiplier?.toFixed(2) || '1.00'}x)
            </span>
            {breakdown.surgeReason && breakdown.surgeReason !== 'none' && breakdown.surgeReason !== 'manual' && (
              <Badge 
                variant="secondary" 
                className="text-xs"
                data-testid="badge-surge-reason"
              >
                {getSurgeReasonLabel(breakdown.surgeReason)}
              </Badge>
            )}
            {breakdown.surgeTimingWindow && getSurgeTimingWindowLabel(breakdown.surgeTimingWindow) && (
              <Badge 
                variant="outline" 
                className="text-xs"
                data-testid="badge-surge-timing-window"
              >
                {getSurgeTimingWindowLabel(breakdown.surgeTimingWindow)}
              </Badge>
            )}
            {(breakdown.surgeCapped || breakdown.flags?.surgeCapped) && (
              <Badge 
                variant="destructive" 
                className="text-xs"
                data-testid="badge-surge-capped"
              >
                Capped
              </Badge>
            )}
          </div>
          <span className="text-sm" data-testid="text-surge-amount">
            {formatCurrency(breakdown.surgeAmount ?? 0, currency)}
          </span>
        </div>
      )}
      {(breakdown.nightSurcharge ?? 0) > 0 && (
        <BreakdownLine 
          icon={Moon} 
          label="Night surcharge (8PM-6AM)" 
          amount={breakdown.nightSurcharge ?? 0} 
          currency={currency} 
        />
      )}
      {(breakdown.peakHourSurcharge ?? 0) > 0 && (
        <BreakdownLine 
          icon={Clock} 
          label="Peak hour (rush hour)" 
          amount={breakdown.peakHourSurcharge ?? 0} 
          currency={currency} 
        />
      )}
      {(breakdown.shortTripAdjustment ?? 0) > 0 && (
        <BreakdownLine 
          icon={Navigation} 
          label="Short trip adjustment" 
          amount={breakdown.shortTripAdjustment ?? 0} 
          currency={currency} 
        />
      )}
      {(breakdown.longDistanceFee ?? 0) > 0 && (
        <BreakdownLine 
          icon={Navigation} 
          label="Long distance fee" 
          amount={breakdown.longDistanceFee ?? 0} 
          currency={currency} 
        />
      )}
      {(breakdown.crossCitySurcharge ?? 0) > 0 && (
        <BreakdownLine 
          icon={MapPin} 
          label="Cross-city surcharge" 
          amount={breakdown.crossCitySurcharge ?? 0} 
          currency={currency} 
        />
      )}
      {/* Cross-State Fare Engine Section (Uber-style pricing) */}
      {breakdown.crossStateFareApplied && (
        <div className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 rounded-lg p-3 my-2 border border-orange-200 dark:border-orange-800" data-testid="section-cross-state-fare">
          <div className="flex items-center gap-2 mb-3">
            <ArrowRightLeft className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            <span className="font-semibold text-sm text-orange-800 dark:text-orange-200">Cross-State Trip Pricing</span>
            {breakdown.crossStatePickupState && breakdown.crossStateDropoffState && (
              <Badge variant="outline" className="text-xs bg-orange-100 dark:bg-orange-900/50 border-orange-300 dark:border-orange-700" data-testid="badge-cross-state-route">
                {breakdown.crossStatePickupState} to {breakdown.crossStateDropoffState}
              </Badge>
            )}
          </div>
          
          <div className="space-y-1.5 text-sm">
            {/* Base Fare */}
            <div className="flex justify-between items-center" data-testid="row-cross-state-base-fare">
              <span className="text-muted-foreground">Base fare</span>
              <span className="font-medium">{formatCurrency(breakdown.crossStateFareBaseFare ?? 0, currency)}</span>
            </div>
            
            {/* Distance Cost */}
            <div className="flex justify-between items-center" data-testid="row-cross-state-distance">
              <span className="text-muted-foreground">Distance cost</span>
              <span className="font-medium">{formatCurrency(breakdown.crossStateFareDistanceCost ?? 0, currency)}</span>
            </div>
            
            {/* Time Cost */}
            <div className="flex justify-between items-center" data-testid="row-cross-state-time">
              <span className="text-muted-foreground">Time cost</span>
              <span className="font-medium">{formatCurrency(breakdown.crossStateFareTimeCost ?? 0, currency)}</span>
            </div>
            
            {/* Cross-State Surcharge */}
            <div className="flex justify-between items-center" data-testid="row-cross-state-surcharge">
              <span className="text-muted-foreground">Cross-state surcharge</span>
              <span className="font-medium">{formatCurrency(breakdown.crossStateFareSurcharge ?? 0, currency)}</span>
            </div>
            
            {/* Tolls (if applicable) */}
            {(breakdown.crossStateFareTolls ?? 0) > 0 && (
              <div className="flex justify-between items-center" data-testid="row-cross-state-tolls">
                <span className="text-muted-foreground">Tolls</span>
                <span className="font-medium">{formatCurrency(breakdown.crossStateFareTolls ?? 0, currency)}</span>
              </div>
            )}
            
            {/* Pre-Surge Subtotal */}
            <div className="flex justify-between items-center pt-1 border-t border-orange-200 dark:border-orange-700" data-testid="row-cross-state-subtotal">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">{formatCurrency(breakdown.crossStateFarePreSurgeSubtotal ?? 0, currency)}</span>
            </div>
            
            {/* Surge Multiplier (if applied) */}
            {breakdown.crossStateFareSurgeApplied && (breakdown.crossStateFareSurgeMultiplier ?? 1) > 1 && (
              <div className="flex justify-between items-center text-orange-700 dark:text-orange-300" data-testid="row-cross-state-surge">
                <div className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  <span>Surge ({breakdown.crossStateFareSurgeMultiplier?.toFixed(2)}x)</span>
                </div>
                <span className="font-medium">+{formatCurrency(breakdown.crossStateFareSurgeAmount ?? 0, currency)}</span>
              </div>
            )}
            
            {/* Total */}
            <div className="flex justify-between items-center pt-2 border-t border-orange-300 dark:border-orange-600 font-semibold" data-testid="row-cross-state-total">
              <span>Cross-state total</span>
              <span className="text-orange-700 dark:text-orange-300">{formatCurrency(breakdown.crossStateFareTotal ?? breakdown.totalFare, currency)}</span>
            </div>
            
            {/* Minimum/Maximum Applied Badges */}
            {(breakdown.crossStateFareMinimumApplied || breakdown.crossStateFareMaximumApplied) && (
              <div className="flex justify-end gap-2 mt-1">
                {breakdown.crossStateFareMinimumApplied && (
                  <Badge variant="secondary" className="text-xs" data-testid="badge-cross-state-minimum">
                    Minimum applied
                  </Badge>
                )}
                {breakdown.crossStateFareMaximumApplied && (
                  <Badge variant="secondary" className="text-xs" data-testid="badge-cross-state-maximum">
                    Maximum applied
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Legacy cross-state surcharge (only shown when cross-state fare engine is not active) */}
      {!breakdown.crossStateFareApplied && (breakdown.crossStateSurcharge ?? 0) > 0 && (
        <BreakdownLine 
          icon={MapPin} 
          label="Cross-state surcharge" 
          amount={breakdown.crossStateSurcharge ?? 0} 
          currency={currency} 
        />
      )}
      {(breakdown.returnDeadheadFee ?? 0) > 0 && (
        <BreakdownLine 
          icon={ArrowRightLeft} 
          label="Return deadhead fee" 
          amount={breakdown.returnDeadheadFee ?? 0} 
          currency={currency} 
        />
      )}
      {(breakdown.airportFee ?? 0) > 0 && (
        <BreakdownLine 
          icon={Plane} 
          label={`Airport fee${breakdown.airportCode ? ` (${breakdown.airportCode})` : ''}`}
          amount={breakdown.airportFee ?? 0} 
          currency={currency} 
        />
      )}
      {(breakdown.borderZoneFee ?? 0) > 0 && (
        <BreakdownLine 
          icon={Flag} 
          label="Border zone fee" 
          amount={breakdown.borderZoneFee ?? 0} 
          currency={currency} 
        />
      )}
      {(breakdown.stateRegulatoryFee ?? 0) > 0 && (
        <BreakdownLine 
          icon={FileText} 
          label={breakdown.stateRegulatoryFeeLabel || "State regulatory fee"}
          amount={breakdown.stateRegulatoryFee ?? 0} 
          currency={currency} 
        />
      )}
      
      {/* NYC TLC Regulatory Fees Section */}
      {(breakdown.tlcCongestionFee ?? 0) > 0 && (
        <BreakdownLine 
          icon={Building2} 
          label="NYC Congestion Surcharge"
          amount={breakdown.tlcCongestionFee ?? 0} 
          currency={currency} 
        />
      )}
      {(breakdown.tlcAirportFee ?? 0) > 0 && (
        <BreakdownLine 
          icon={Plane} 
          label={`NYC TLC Airport Fee${breakdown.tlcAirportCode ? ` (${breakdown.tlcAirportCode})` : ''}`}
          amount={breakdown.tlcAirportFee ?? 0} 
          currency={currency} 
        />
      )}
      {(breakdown.tlcAVFFee ?? 0) > 0 && (
        <BreakdownLine 
          icon={Shield} 
          label="NYC Accessible Vehicle Fund"
          amount={breakdown.tlcAVFFee ?? 0} 
          currency={currency} 
        />
      )}
      {(breakdown.tlcBCFFee ?? 0) > 0 && (
        <BreakdownLine 
          icon={FileText} 
          label={`NYC Black Car Fund (${((breakdown.tlcBCFFeeRate ?? 0.0275) * 100).toFixed(2)}%)`}
          amount={breakdown.tlcBCFFee ?? 0} 
          currency={currency} 
        />
      )}
      {(breakdown.tlcHVRFFee ?? 0) > 0 && (
        <BreakdownLine 
          icon={Shield} 
          label="NYC HVFHV Workers' Comp"
          amount={breakdown.tlcHVRFFee ?? 0} 
          currency={currency} 
        />
      )}
      {(breakdown.tlcStateSurcharge ?? 0) > 0 && (
        <BreakdownLine 
          icon={Flag} 
          label="NY State Surcharge"
          amount={breakdown.tlcStateSurcharge ?? 0} 
          currency={currency} 
        />
      )}
      {(breakdown.tlcLongTripFee ?? 0) > 0 && (
        <BreakdownLine 
          icon={Clock} 
          label="NYC Long Trip Surcharge"
          amount={breakdown.tlcLongTripFee ?? 0} 
          currency={currency} 
        />
      )}
      {(breakdown.tlcOutOfTownFee ?? 0) > 0 && (
        <BreakdownLine 
          icon={Navigation} 
          label="Out-of-Town Return Fee"
          amount={breakdown.tlcOutOfTownFee ?? 0} 
          currency={currency} 
        />
      )}
      {(breakdown.tlcCrossCityFee ?? 0) > 0 && (
        <div 
          className="flex items-center justify-between py-2"
          data-testid="row-tlc-cross-city-fee"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">NYC Cross-City Fee</span>
            {breakdown.tlcPickupBorough && breakdown.tlcDropoffBorough && (
              <Badge variant="outline" className="text-xs" data-testid="badge-cross-city-boroughs">
                {breakdown.tlcPickupBorough.replace('_', ' ')} to {breakdown.tlcDropoffBorough.replace('_', ' ')}
              </Badge>
            )}
          </div>
          <span className="text-sm" data-testid="text-cross-city-fee-amount">
            {formatCurrency(breakdown.tlcCrossCityFee ?? 0, currency)}
          </span>
        </div>
      )}
      
      {/* NYC TLC Tolls - Individual bridge/tunnel line items */}
      {breakdown.tlcTollsBreakdown && breakdown.tlcTollsBreakdown.length > 0 ? (
        <>
          {breakdown.tlcTollsBreakdown.map((toll, index) => (
            <div 
              key={`toll-${toll.id}-${index}`}
              className="flex items-center justify-between py-2"
              data-testid={`row-toll-${toll.id}`}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <Route className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{toll.shortName}</span>
                <Badge variant="outline" className="text-xs" data-testid={`badge-toll-rate-${toll.id}`}>
                  {toll.isPeak ? 'Peak' : 'Off-Peak'}
                </Badge>
                {toll.direction && (
                  <Badge variant="secondary" className="text-xs" data-testid={`badge-toll-direction-${toll.id}`}>
                    {toll.direction === 'eastbound' ? 'EB' : toll.direction === 'westbound' ? 'WB' : toll.direction}
                  </Badge>
                )}
              </div>
              <span className="text-sm" data-testid={`text-toll-amount-${toll.id}`}>
                {formatCurrency(toll.amount, currency)}
              </span>
            </div>
          ))}
        </>
      ) : (
        <BreakdownLine 
          icon={Route} 
          label="Tolls" 
          amount={breakdown.tolls} 
          currency={currency} 
        />
      )}
      <BreakdownLine 
        icon={Building2} 
        label="City & airport fees" 
        amount={breakdown.cityFees} 
        currency={currency} 
      />
      <BreakdownLine 
        icon={Percent} 
        label="SafeGo service fee" 
        amount={breakdown.serviceFee} 
        currency={currency} 
      />
      {(breakdown.customerServiceFee ?? 0) > 0 && (
        <BreakdownLine 
          icon={DollarSign} 
          label="Customer service fee" 
          amount={breakdown.customerServiceFee ?? 0} 
          currency={currency} 
        />
      )}
      {breakdown.promoDiscount > 0 && (
        <BreakdownLine 
          icon={Tag} 
          label="Promo discount" 
          amount={breakdown.promoDiscount} 
          currency={currency} 
          isDiscount={true}
        />
      )}
      <BreakdownLine 
        icon={Receipt} 
        label="Total" 
        amount={breakdown.totalFare} 
        currency={currency} 
        isTotal={true}
      />
      
      {/* Driver and Platform Earnings Section */}
      {(breakdown.driverEarnings !== undefined || breakdown.platformCommission !== undefined) && (
        <div className="border-t border-border mt-3 pt-3">
          <div className="text-xs text-muted-foreground mb-2 font-medium">Earnings Breakdown</div>
          {breakdown.driverEarnings !== undefined && (
            <div className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Driver earnings</span>
                {breakdown.driverEarningsMinimumApplied && (
                  <Badge variant="secondary" className="text-xs" data-testid="badge-driver-minimum">
                    Min applied
                  </Badge>
                )}
              </div>
              <span className="text-sm font-medium text-green-600 dark:text-green-400" data-testid="text-driver-earnings">
                {formatCurrency(breakdown.driverEarnings, currency)}
              </span>
            </div>
          )}
          {breakdown.platformCommission !== undefined && (
            <div className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  {(breakdown.dynamicCommissionApplied || breakdown.flags?.dynamicCommissionApplied)
                    ? `Dynamic commission (${breakdown.commissionRate?.toFixed(1) || '15'}%)`
                    : `Platform commission (${breakdown.commissionRate?.toFixed(1) || '15'}%)`
                  }
                </span>
                {(breakdown.dynamicCommissionApplied || breakdown.flags?.dynamicCommissionApplied) && breakdown.demandLevel && (
                  <Badge 
                    variant={breakdown.demandLevel === 'high' ? 'destructive' : breakdown.demandLevel === 'low' ? 'secondary' : 'outline'}
                    className="text-xs"
                    data-testid="badge-demand-level"
                  >
                    {breakdown.demandLevel === 'high' ? 'High demand' : breakdown.demandLevel === 'low' ? 'Low demand' : 'Normal'}
                  </Badge>
                )}
                {(breakdown.commissionCapped || breakdown.flags?.commissionCapped) && (
                  <Badge variant="outline" className="text-xs" data-testid="badge-commission-capped">
                    Max capped
                  </Badge>
                )}
                {(breakdown.commissionFloored || breakdown.flags?.commissionFloored) && (
                  <Badge variant="secondary" className="text-xs" data-testid="badge-commission-floored">
                    Min floored
                  </Badge>
                )}
              </div>
              <span className="text-sm" data-testid="text-platform-commission">
                {formatCurrency(breakdown.platformCommission, currency)}
              </span>
            </div>
          )}
          {(breakdown.dynamicCommissionApplied || breakdown.flags?.dynamicCommissionApplied) && breakdown.demandLevel && (
            <div className="flex items-center gap-2 py-1 text-xs text-muted-foreground">
              <Activity className="h-3 w-3" />
              <span>Based on current demand</span>
              {breakdown.demandScore !== undefined && (
                <span className="flex items-center gap-1">
                  <Gauge className="h-3 w-3" />
                  Score: {breakdown.demandScore}
                </span>
              )}
            </div>
          )}
        </div>
      )}
      
      {breakdown.minimumFareApplied && (
        <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
          <Shield className="h-3 w-3" />
          <span>
            {breakdown.stateMinimumFareApplied 
              ? `State minimum fare applied (${formatCurrency(breakdown.stateMinimumFare || 0, currency)})`
              : 'Minimum fare applied'
            }
          </span>
        </div>
      )}
      {breakdown.maximumFareApplied && (
        <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
          <AlertCircle className="h-3 w-3" />
          <span>Fare capped at maximum</span>
        </div>
      )}
      {(breakdown.marginProtectionCapped || breakdown.flags?.marginProtectionCapped) && (
        <div className="flex items-center gap-2 pt-2 text-xs text-amber-600 dark:text-amber-400" data-testid="text-margin-protection-capped">
          <CircleAlert className="h-3 w-3" />
          <span>Margin protection capped - minimum commission not achieved</span>
        </div>
      )}
    </div>
  );
}

export function FareBreakdown({
  breakdown,
  currency = "USD",
  className = "",
  alwaysExpanded = false,
}: FareBreakdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (alwaysExpanded) {
    return (
      <Card className={className} data-testid="fare-breakdown-card">
        <CardContent className="p-4 sm:p-5">
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Fare Details
          </h4>
          <BreakdownContent breakdown={breakdown} currency={currency} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <Card data-testid="fare-breakdown-accordion">
        <CollapsibleTrigger asChild>
          <Button 
            variant="ghost" 
            className="w-full justify-between p-4 h-auto hover:bg-muted/50"
            data-testid="button-toggle-breakdown"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <Receipt className="h-4 w-4" />
              View fare details
            </span>
            {isOpen ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 px-4 pb-4">
            <BreakdownContent breakdown={breakdown} currency={currency} />
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export default FareBreakdown;
