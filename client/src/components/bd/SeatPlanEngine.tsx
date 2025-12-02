import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  SEAT_LAYOUTS,
  type SeatLayoutId,
  type SeatState,
  generateSeats,
  getTotalSeats,
  formatCurrencyBangla,
} from "@/lib/bd-ticket-types";
import { Armchair, Check, X, Lock } from "lucide-react";

interface SeatPlanEngineProps {
  layout: SeatLayoutId;
  baseFare: number;
  busType: string;
  seats?: SeatState[];
  onSeatsChange?: (seats: SeatState[]) => void;
  mode?: "edit" | "view" | "select";
  selectedSeats?: string[];
  onSeatSelect?: (seatId: string) => void;
  maxSelectable?: number;
}

export function SeatPlanEngine({
  layout,
  baseFare,
  busType,
  seats: externalSeats,
  onSeatsChange,
  mode = "view",
  selectedSeats = [],
  onSeatSelect,
  maxSelectable = 5,
}: SeatPlanEngineProps) {
  const [internalSeats, setInternalSeats] = useState<SeatState[]>([]);
  const [activeDeck, setActiveDeck] = useState<"lower" | "upper">("lower");

  const layoutConfig = SEAT_LAYOUTS.find((l) => l.id === layout);
  const seats = externalSeats || internalSeats;

  useEffect(() => {
    if (!externalSeats) {
      const generated = generateSeats(layout, baseFare, busType as any);
      setInternalSeats(generated);
      onSeatsChange?.(generated);
    }
  }, [layout, baseFare, busType, externalSeats]);

  const handleSeatClick = (seat: SeatState) => {
    if (mode === "view") return;
    if (seat.status === "booked" || seat.status === "blocked") return;

    if (mode === "select") {
      if (selectedSeats.includes(seat.id)) {
        onSeatSelect?.(seat.id);
      } else if (selectedSeats.length < maxSelectable) {
        onSeatSelect?.(seat.id);
      }
      return;
    }

    if (mode === "edit") {
      const newStatus: SeatState["status"] =
        seat.status === "available" ? "blocked" : "available";
      
      const updatedSeats = seats.map((s) =>
        s.id === seat.id ? { ...s, status: newStatus } : s
      );
      
      if (externalSeats) {
        onSeatsChange?.(updatedSeats);
      } else {
        setInternalSeats(updatedSeats);
        onSeatsChange?.(updatedSeats);
      }
    }
  };

  const getSeatColor = (seat: SeatState) => {
    if (selectedSeats.includes(seat.id)) {
      return "bg-primary text-primary-foreground border-primary";
    }
    switch (seat.status) {
      case "available":
        return "bg-green-100 dark:bg-green-900/30 border-green-500 text-green-700 dark:text-green-300 hover-elevate cursor-pointer";
      case "selected":
        return "bg-primary text-primary-foreground border-primary";
      case "booked":
        return "bg-red-100 dark:bg-red-900/30 border-red-500 text-red-700 dark:text-red-300 cursor-not-allowed";
      case "blocked":
        return "bg-muted border-muted-foreground/30 text-muted-foreground cursor-not-allowed";
      default:
        return "bg-muted";
    }
  };

  const lowerDeckSeats = seats.filter((s) => s.deck === "lower" || !s.deck);
  const upperDeckSeats = seats.filter((s) => s.deck === "upper");
  const hasUpperDeck = layoutConfig?.hasUpperDeck;

  const renderSeatGrid = (deckSeats: SeatState[]) => {
    if (!layoutConfig) return null;

    const rows: SeatState[][] = [];
    for (let i = 0; i < layoutConfig.rows; i++) {
      rows.push(deckSeats.filter((s) => s.row === i));
    }

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-center mb-4">
          <div className="bg-muted rounded-t-xl px-8 py-2 text-sm font-medium text-muted-foreground">
            ড্রাইভার
          </div>
        </div>

        <div className="space-y-1">
          {rows.map((row, rowIndex) => (
            <div
              key={rowIndex}
              className="flex items-center justify-center gap-1"
            >
              <div className="flex gap-1">
                {row.slice(0, layoutConfig.pattern[0]).map((seat) => (
                  <button
                    key={seat.id}
                    type="button"
                    onClick={() => handleSeatClick(seat)}
                    disabled={
                      mode === "view" ||
                      seat.status === "booked" ||
                      (mode === "select" &&
                        !selectedSeats.includes(seat.id) &&
                        selectedSeats.length >= maxSelectable)
                    }
                    className={cn(
                      "w-10 h-10 rounded-md border-2 flex items-center justify-center text-xs font-bold transition-all",
                      getSeatColor(seat)
                    )}
                    data-testid={`seat-${seat.id}`}
                  >
                    {seat.status === "blocked" ? (
                      <Lock className="h-4 w-4" />
                    ) : seat.status === "booked" ? (
                      <X className="h-4 w-4" />
                    ) : selectedSeats.includes(seat.id) ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      seat.seatNumber
                    )}
                  </button>
                ))}
              </div>

              <div className="w-8" />

              <div className="flex gap-1">
                {row.slice(layoutConfig.pattern[0]).map((seat) => (
                  <button
                    key={seat.id}
                    type="button"
                    onClick={() => handleSeatClick(seat)}
                    disabled={
                      mode === "view" ||
                      seat.status === "booked" ||
                      (mode === "select" &&
                        !selectedSeats.includes(seat.id) &&
                        selectedSeats.length >= maxSelectable)
                    }
                    className={cn(
                      "w-10 h-10 rounded-md border-2 flex items-center justify-center text-xs font-bold transition-all",
                      getSeatColor(seat)
                    )}
                    data-testid={`seat-${seat.id}`}
                  >
                    {seat.status === "blocked" ? (
                      <Lock className="h-4 w-4" />
                    ) : seat.status === "booked" ? (
                      <X className="h-4 w-4" />
                    ) : selectedSeats.includes(seat.id) ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      seat.seatNumber
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center mt-4">
          <div className="bg-muted rounded-b-xl px-8 py-2 text-sm font-medium text-muted-foreground">
            পেছন
          </div>
        </div>
      </div>
    );
  };

  const availableCount = seats.filter((s) => s.status === "available").length;
  const bookedCount = seats.filter((s) => s.status === "booked").length;
  const blockedCount = seats.filter((s) => s.status === "blocked").length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base font-medium">
            সিট প্ল্যান - {layoutConfig?.label}
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
              <Armchair className="h-3 w-3 mr-1" />
              খালি: {availableCount}
            </Badge>
            <Badge variant="outline" className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
              <X className="h-3 w-3 mr-1" />
              বুকড: {bookedCount}
            </Badge>
            {blockedCount > 0 && (
              <Badge variant="outline" className="bg-muted">
                <Lock className="h-3 w-3 mr-1" />
                ব্লকড: {blockedCount}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {hasUpperDeck ? (
          <Tabs value={activeDeck} onValueChange={(v) => setActiveDeck(v as "lower" | "upper")}>
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="lower" data-testid="tab-lower-deck">
                নিচের ডেক
              </TabsTrigger>
              <TabsTrigger value="upper" data-testid="tab-upper-deck">
                উপরের ডেক
              </TabsTrigger>
            </TabsList>
            <TabsContent value="lower">
              {renderSeatGrid(lowerDeckSeats)}
            </TabsContent>
            <TabsContent value="upper">
              {renderSeatGrid(upperDeckSeats)}
            </TabsContent>
          </Tabs>
        ) : (
          renderSeatGrid(lowerDeckSeats)
        )}

        <div className="flex flex-wrap items-center justify-center gap-4 mt-6 pt-4 border-t">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded border-2 bg-green-100 dark:bg-green-900/30 border-green-500" />
            <span className="text-sm">খালি</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded border-2 bg-primary" />
            <span className="text-sm">নির্বাচিত</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded border-2 bg-red-100 dark:bg-red-900/30 border-red-500" />
            <span className="text-sm">বুকড</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded border-2 bg-muted" />
            <span className="text-sm">ব্লকড</span>
          </div>
        </div>

        {mode === "select" && selectedSeats.length > 0 && (
          <div className="mt-4 p-3 bg-primary/10 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="font-medium">
                নির্বাচিত সিট: {selectedSeats.length}/{maxSelectable}
              </span>
              <span className="font-bold text-primary">
                মোট: {formatCurrencyBangla(selectedSeats.length * (seats[0]?.price || 0))}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function SeatLayoutSelector({
  value,
  onChange,
  className,
}: {
  value: SeatLayoutId;
  onChange: (layout: SeatLayoutId) => void;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-2 gap-2", className)}>
      {SEAT_LAYOUTS.map((layout) => (
        <Button
          key={layout.id}
          type="button"
          variant={value === layout.id ? "default" : "outline"}
          className={cn(
            "h-auto py-3 flex flex-col items-center gap-1",
            value === layout.id && "ring-2 ring-primary"
          )}
          onClick={() => onChange(layout.id as SeatLayoutId)}
          data-testid={`layout-${layout.id}`}
        >
          <span className="font-medium">{layout.label}</span>
          <span className="text-xs text-muted-foreground">
            {getTotalSeats(layout.id as SeatLayoutId)} সিট
          </span>
        </Button>
      ))}
    </div>
  );
}
