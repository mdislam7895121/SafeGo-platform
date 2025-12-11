import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Armchair,
  BedDouble,
  CircleSlash,
  CheckCircle2,
  Info,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SEAT_LAYOUTS,
  formatCurrencyBangla,
  type SeatState,
  type SeatLayoutId,
} from "@/lib/bd-ticket-types";

interface SeatMapProps {
  seatLayout: SeatLayoutId;
  seats: SeatState[];
  selectedSeats: string[];
  onSeatSelect: (seatId: string) => void;
  farePerSeat: number;
  disabled?: boolean;
  maxSeats?: number;
  className?: string;
}

const SEAT_STATUS_STYLES = {
  available: "bg-background border-2 border-primary/30 hover-elevate cursor-pointer",
  selected: "bg-primary text-primary-foreground border-2 border-primary",
  booked: "bg-muted text-muted-foreground border-2 border-muted cursor-not-allowed",
  blocked: "bg-destructive/20 text-destructive border-2 border-destructive/30 cursor-not-allowed",
};

export function SeatMap({
  seatLayout,
  seats,
  selectedSeats,
  onSeatSelect,
  farePerSeat,
  disabled = false,
  maxSeats = 10,
  className,
}: SeatMapProps) {
  const [activeDeck, setActiveDeck] = useState<"lower" | "upper">("lower");

  const layoutConfig = SEAT_LAYOUTS.find((l) => l.id === seatLayout);
  const hasUpperDeck = layoutConfig?.hasUpperDeck || false;
  const isSleeper = seatLayout === "1x1_sleeper";

  const filteredSeats = useMemo(() => {
    if (hasUpperDeck) {
      return seats.filter((seat) => seat.deck === activeDeck);
    }
    return seats;
  }, [seats, activeDeck, hasUpperDeck]);

  const seatsByRow = useMemo(() => {
    const rows: Map<number, SeatState[]> = new Map();
    filteredSeats.forEach((seat) => {
      const existing = rows.get(seat.row) || [];
      existing.push(seat);
      rows.set(seat.row, existing);
    });
    rows.forEach((rowSeats) => rowSeats.sort((a, b) => a.col - b.col));
    return rows;
  }, [filteredSeats]);

  const handleSeatClick = (seat: SeatState) => {
    if (disabled) return;
    if (seat.status === "booked" || seat.status === "blocked") return;
    
    const isSelected = selectedSeats.includes(seat.id);
    if (!isSelected && selectedSeats.length >= maxSeats) {
      return;
    }
    
    onSeatSelect(seat.id);
  };

  const getSeatStatus = (seat: SeatState): SeatState["status"] => {
    if (selectedSeats.includes(seat.id)) return "selected";
    return seat.status;
  };

  const renderSeat = (seat: SeatState) => {
    const status = getSeatStatus(seat);
    const isClickable = !disabled && status !== "booked" && status !== "blocked";
    const sizeClass = isSleeper ? "w-14 h-20" : "w-10 h-10 md:w-12 md:h-12";

    return (
      <button
        key={seat.id}
        type="button"
        onClick={() => handleSeatClick(seat)}
        disabled={!isClickable}
        className={cn(
          "rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all",
          sizeClass,
          SEAT_STATUS_STYLES[status],
          isClickable && status === "available" && "active-elevate-2"
        )}
        data-testid={`seat-${seat.seatNumber}`}
        aria-label={`সিট ${seat.seatNumber} - ${status === "available" ? "খালি" : status === "selected" ? "নির্বাচিত" : "বুকড"}`}
      >
        {isSleeper ? (
          <BedDouble className="h-5 w-5" />
        ) : (
          <Armchair className="h-4 w-4" />
        )}
        <span className="text-[10px] font-semibold">{seat.seatNumber}</span>
      </button>
    );
  };

  const renderRow = (rowNum: number, rowSeats: SeatState[]) => {
    if (!layoutConfig) return null;

    const leftSeats = rowSeats.slice(0, layoutConfig.pattern[0]);
    const rightSeats = rowSeats.slice(layoutConfig.pattern[0]);

    return (
      <div
        key={rowNum}
        className="flex items-center justify-center gap-4 md:gap-6"
        data-testid={`row-${rowNum}`}
      >
        <div className="flex gap-1.5 md:gap-2">
          {leftSeats.map(renderSeat)}
        </div>
        <div className="w-4 md:w-8" />
        <div className="flex gap-1.5 md:gap-2">
          {rightSeats.map(renderSeat)}
        </div>
      </div>
    );
  };

  return (
    <Card className={cn("overflow-hidden", className)} data-testid="card-seat-map">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <Armchair className="h-5 w-5 text-primary" />
            সিট নির্বাচন করুন
          </CardTitle>
          <Badge variant="secondary" className="text-xs" data-testid="badge-price">
            প্রতি সিট: {formatCurrencyBangla(farePerSeat)}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-4 mt-3 text-xs" data-testid="legend-container">
          <div className="flex items-center gap-1.5" data-testid="legend-available">
            <div className="w-5 h-5 rounded bg-background border-2 border-primary/30" />
            <span>খালি</span>
          </div>
          <div className="flex items-center gap-1.5" data-testid="legend-selected">
            <div className="w-5 h-5 rounded bg-primary border-2 border-primary" />
            <span>নির্বাচিত</span>
          </div>
          <div className="flex items-center gap-1.5" data-testid="legend-booked">
            <div className="w-5 h-5 rounded bg-muted border-2 border-muted" />
            <span>বুকড</span>
          </div>
          {maxSeats && (
            <div className="flex items-center gap-1.5 text-muted-foreground" data-testid="legend-max-seats">
              <Info className="h-4 w-4" />
              <span>সর্বোচ্চ {maxSeats}টি সিট নির্বাচন করা যাবে</span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {hasUpperDeck && (
          <Tabs
            value={activeDeck}
            onValueChange={(v) => setActiveDeck(v as "lower" | "upper")}
            className="mb-4"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="lower" className="gap-2" data-testid="tab-lower-deck">
                <ArrowDown className="h-4 w-4" />
                নিচের ডেক
              </TabsTrigger>
              <TabsTrigger value="upper" className="gap-2" data-testid="tab-upper-deck">
                <ArrowUp className="h-4 w-4" />
                উপরের ডেক
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        <div className="bg-muted/30 rounded-xl p-4 md:p-6">
          <div className="flex flex-col items-center mb-4">
            <div className="w-20 h-8 bg-muted rounded-t-full flex items-center justify-center text-xs text-muted-foreground">
              ড্রাইভার
            </div>
            <div className="w-full h-px bg-border mt-2" />
          </div>

          <div className="space-y-2 md:space-y-3">
            {Array.from(seatsByRow.entries())
              .sort(([a], [b]) => a - b)
              .map(([rowNum, rowSeats]) => renderRow(rowNum, rowSeats))}
          </div>

          <div className="mt-4 flex justify-center">
            <div className="w-16 h-6 bg-muted rounded-b-lg flex items-center justify-center text-xs text-muted-foreground">
              পেছন
            </div>
          </div>
        </div>

        {selectedSeats.length > 0 && (
          <div className="mt-4 p-3 bg-primary/5 rounded-lg border border-primary/20">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">
                  নির্বাচিত সিট: {selectedSeats.length}টি
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selectedSeats.map((seatId) => {
                  const seat = seats.find((s) => s.id === seatId);
                  return (
                    <Badge
                      key={seatId}
                      variant="secondary"
                      className="text-xs"
                      data-testid={`badge-selected-${seat?.seatNumber}`}
                    >
                      {seat?.seatNumber}
                    </Badge>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function generateDemoSeats(
  layout: SeatLayoutId,
  farePerSeat: number,
  bookedPercentage: number = 0.15
): SeatState[] {
  const layoutConfig = SEAT_LAYOUTS.find((l) => l.id === layout);
  if (!layoutConfig) return [];

  const seats: SeatState[] = [];
  let seatNum = 1;

  const generateDeckSeats = (deck: "lower" | "upper" = "lower") => {
    for (let row = 0; row < layoutConfig.rows; row++) {
      let col = 0;
      for (let leftSeats = 0; leftSeats < layoutConfig.pattern[0]; leftSeats++) {
        const isBooked = Math.random() < bookedPercentage;
        seats.push({
          id: `${deck}-${row}-${col}`,
          row,
          col,
          status: isBooked ? "booked" : "available",
          seatNumber: `${deck === "upper" ? "U" : ""}${seatNum}`,
          deck,
          price: farePerSeat,
        });
        seatNum++;
        col++;
      }
      col++;
      for (let rightSeats = 0; rightSeats < layoutConfig.pattern[1]; rightSeats++) {
        const isBooked = Math.random() < bookedPercentage;
        seats.push({
          id: `${deck}-${row}-${col}`,
          row,
          col,
          status: isBooked ? "booked" : "available",
          seatNumber: `${deck === "upper" ? "U" : ""}${seatNum}`,
          deck,
          price: farePerSeat,
        });
        seatNum++;
        col++;
      }
    }
  };

  generateDeckSeats("lower");
  if (layoutConfig.hasUpperDeck) {
    seatNum = 1;
    generateDeckSeats("upper");
  }

  return seats;
}
