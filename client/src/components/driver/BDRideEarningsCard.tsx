/**
 * BD Ride Earnings Card
 * 
 * Driver-facing component showing detailed BD ride earnings breakdown with:
 * - BDT currency display
 * - Night/peak multiplier indicators
 * - Cash collection instructions
 * - Commission breakdown
 * - Platform fee details
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  BanknoteIcon,
  CreditCard,
  Moon,
  Zap,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Bike,
  Truck,
  Car,
  Crown,
  Clock,
  Navigation,
  Wallet,
} from "lucide-react";

interface FareBreakdown {
  baseFare: number;
  distanceFare: number;
  timeFare: number;
  bookingFee: number;
  subtotal: number;
  nightMultiplier: number;
  peakMultiplier: number;
  finalMultiplier: number;
  multiplierAdjustment: number;
  priorityFee: number;
  totalFare: number;
  minimumFareApplied: boolean;
  safegoCommission: number;
  driverEarnings: number;
  currency: string;
  commissionRate: number;
}

interface BDRideEarningsCardProps {
  rideId: string;
  vehicleType: string;
  paymentMethod: "cash" | "online";
  distanceKm: number;
  durationMin: number;
  fareBreakdown: FareBreakdown;
  status: string;
  isNightTime?: boolean;
  isPeakTime?: boolean;
  cashCollected?: boolean;
  onCashCollectionConfirm?: () => void;
}

function getVehicleIcon(vehicleType: string) {
  switch (vehicleType) {
    case "bike":
      return <Bike className="h-5 w-5" />;
    case "cng":
      return <Truck className="h-5 w-5" />;
    case "car_premium":
      return <Crown className="h-5 w-5" />;
    default:
      return <Car className="h-5 w-5" />;
  }
}

function getVehicleDisplayName(vehicleType: string): string {
  switch (vehicleType) {
    case "bike":
      return "Bike";
    case "cng":
      return "CNG Auto";
    case "car_economy":
      return "Economy Car";
    case "car_premium":
      return "Premium Car";
    default:
      return vehicleType;
  }
}

function formatBDT(amount: number): string {
  return `৳${amount.toLocaleString("en-BD", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function BDRideEarningsCard({
  rideId,
  vehicleType,
  paymentMethod,
  distanceKm,
  durationMin,
  fareBreakdown,
  status,
  isNightTime = false,
  isPeakTime = false,
  cashCollected = false,
  onCashCollectionConfirm,
}: BDRideEarningsCardProps) {
  const isCash = paymentMethod === "cash";
  const isCompleted = status === "completed";

  return (
    <Card className="overflow-hidden" data-testid={`bd-ride-earnings-${rideId}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              {getVehicleIcon(vehicleType)}
            </div>
            <div>
              <span>{getVehicleDisplayName(vehicleType)}</span>
              <p className="text-sm text-muted-foreground font-normal">
                {distanceKm.toFixed(1)} km • {durationMin} min
              </p>
            </div>
          </CardTitle>
          <div className="flex items-center gap-2">
            {isNightTime && (
              <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                <Moon className="h-3 w-3 mr-1" />
                Night
              </Badge>
            )}
            {isPeakTime && (
              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                <Zap className="h-3 w-3 mr-1" />
                Peak
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isCash && isCompleted && !cashCollected && (
          <Alert className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
            <BanknoteIcon className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              <strong>Cash Collection Required</strong>
              <p className="mt-1">
                Collect {formatBDT(fareBreakdown.totalFare)} from the passenger. Your earnings (
                {formatBDT(fareBreakdown.driverEarnings)}) will be available after confirming cash
                receipt.
              </p>
              {onCashCollectionConfirm && (
                <button
                  onClick={onCashCollectionConfirm}
                  className="mt-2 px-4 py-2 bg-amber-600 text-white rounded-md text-sm font-medium hover:bg-amber-700 transition-colors"
                  data-testid="button-confirm-cash"
                >
                  Confirm Cash Collected
                </button>
              )}
            </AlertDescription>
          </Alert>
        )}

        {isCash && cashCollected && (
          <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              <strong>Cash Collected</strong>
              <p className="mt-1">
                You collected {formatBDT(fareBreakdown.totalFare)}. SafeGo commission (
                {formatBDT(fareBreakdown.safegoCommission)}) will be deducted from your wallet.
              </p>
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Base Fare</span>
            <span>{formatBDT(fareBreakdown.baseFare)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1">
              <Navigation className="h-3 w-3" />
              Distance ({distanceKm.toFixed(1)} km)
            </span>
            <span>{formatBDT(fareBreakdown.distanceFare)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Time ({durationMin} min)
            </span>
            <span>{formatBDT(fareBreakdown.timeFare)}</span>
          </div>
          {fareBreakdown.bookingFee > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Booking Fee</span>
              <span>{formatBDT(fareBreakdown.bookingFee)}</span>
            </div>
          )}

          <Separator className="my-2" />

          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatBDT(fareBreakdown.subtotal)}</span>
          </div>

          {fareBreakdown.nightMultiplier > 1 && (
            <div className="flex justify-between text-sm text-indigo-600 dark:text-indigo-400">
              <span className="flex items-center gap-1">
                <Moon className="h-3 w-3" />
                Night Multiplier
              </span>
              <span>×{fareBreakdown.nightMultiplier.toFixed(1)}</span>
            </div>
          )}

          {fareBreakdown.peakMultiplier > 1 && (
            <div className="flex justify-between text-sm text-orange-600 dark:text-orange-400">
              <span className="flex items-center gap-1">
                <Zap className="h-3 w-3" />
                Peak Multiplier
              </span>
              <span>×{fareBreakdown.peakMultiplier.toFixed(1)}</span>
            </div>
          )}

          {fareBreakdown.multiplierAdjustment > 0 && (
            <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
              <span className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                Surge Adjustment
              </span>
              <span>+{formatBDT(fareBreakdown.multiplierAdjustment)}</span>
            </div>
          )}

          {fareBreakdown.priorityFee > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Priority Fee</span>
              <span>+{formatBDT(fareBreakdown.priorityFee)}</span>
            </div>
          )}

          {fareBreakdown.minimumFareApplied && (
            <div className="flex justify-between text-sm text-muted-foreground italic">
              <span>Minimum Fare Applied</span>
              <CheckCircle className="h-4 w-4" />
            </div>
          )}

          <Separator className="my-2" />

          <div className="flex justify-between font-medium">
            <span>Customer Paid</span>
            <span className="text-lg">{formatBDT(fareBreakdown.totalFare)}</span>
          </div>

          <Separator className="my-2" />

          <div className="flex justify-between text-sm text-red-600 dark:text-red-400">
            <span className="flex items-center gap-1">
              SafeGo Commission ({fareBreakdown.commissionRate}%)
            </span>
            <span>-{formatBDT(fareBreakdown.safegoCommission)}</span>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-green-600" />
              <span className="font-medium text-green-800 dark:text-green-200">Your Earnings</span>
            </div>
            <span className="text-xl font-bold text-green-700 dark:text-green-300">
              {formatBDT(fareBreakdown.driverEarnings)}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 pt-2 text-sm text-muted-foreground">
          <Badge variant="outline" className="gap-1">
            {isCash ? (
              <>
                <BanknoteIcon className="h-3 w-3" />
                Cash Payment
              </>
            ) : (
              <>
                <CreditCard className="h-3 w-3" />
                Online Payment
              </>
            )}
          </Badge>
          <Badge variant="secondary" className="gap-1">
            {fareBreakdown.currency}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

export default BDRideEarningsCard;
