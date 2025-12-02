export const BUS_TYPES = [
  { id: "non_ac", label: "নন-এসি", labelEn: "Non-AC", fareMultiplier: 1.0 },
  { id: "ac", label: "এসি", labelEn: "AC", fareMultiplier: 1.5 },
  { id: "ac_business", label: "এসি বিজনেস", labelEn: "AC Business", fareMultiplier: 1.8 },
  { id: "vip", label: "ভিআইপি", labelEn: "VIP", fareMultiplier: 2.2 },
  { id: "sleeper", label: "স্লিপার", labelEn: "Sleeper", fareMultiplier: 2.0 },
] as const;

export type BusTypeId = (typeof BUS_TYPES)[number]["id"];

export interface SeatLayoutConfig {
  id: string;
  label: string;
  labelEn: string;
  rows: number;
  seatsPerRow: number;
  pattern: number[];
  hasUpperDeck?: boolean;
}

export const SEAT_LAYOUTS: SeatLayoutConfig[] = [
  { id: "2x2", label: "২×২ (৪০ সিট)", labelEn: "2×2 (40 seats)", rows: 10, seatsPerRow: 4, pattern: [2, 2] },
  { id: "2x1", label: "২×১ (৩০ সিট)", labelEn: "2×1 (30 seats)", rows: 10, seatsPerRow: 3, pattern: [2, 1] },
  { id: "1x1_sleeper", label: "১×১ স্লিপার (২০ সিট)", labelEn: "1×1 Sleeper (20 seats)", rows: 10, seatsPerRow: 2, pattern: [1, 1] },
  { id: "double_decker", label: "ডাবল ডেকার (৭০ সিট)", labelEn: "Double Decker (70 seats)", rows: 10, seatsPerRow: 4, pattern: [2, 2], hasUpperDeck: true },
];

export type SeatLayoutId = "2x2" | "2x1" | "1x1_sleeper" | "double_decker";

export const SCHEDULE_TYPES = [
  { id: "single", label: "একক ট্রিপ", labelEn: "Single Trip" },
  { id: "daily", label: "প্রতিদিন", labelEn: "Daily" },
  { id: "weekly", label: "সাপ্তাহিক", labelEn: "Weekly" },
  { id: "weekend", label: "শুধু উইকেন্ড", labelEn: "Weekend Only" },
  { id: "custom", label: "কাস্টম", labelEn: "Custom" },
] as const;

export type ScheduleTypeId = (typeof SCHEDULE_TYPES)[number]["id"];

export const WEEKDAYS = [
  { id: "sat", label: "শনি", labelEn: "Sat" },
  { id: "sun", label: "রবি", labelEn: "Sun" },
  { id: "mon", label: "সোম", labelEn: "Mon" },
  { id: "tue", label: "মঙ্গল", labelEn: "Tue" },
  { id: "wed", label: "বুধ", labelEn: "Wed" },
  { id: "thu", label: "বৃহঃ", labelEn: "Thu" },
  { id: "fri", label: "শুক্র", labelEn: "Fri" },
] as const;

export const PAYMENT_MODES = [
  { id: "online", label: "অনলাইন পেমেন্ট", labelEn: "Online Payment" },
  { id: "cash", label: "নগদ পেমেন্ট", labelEn: "Cash Payment" },
  { id: "both", label: "উভয়", labelEn: "Both" },
] as const;

export type PaymentModeId = (typeof PAYMENT_MODES)[number]["id"];

export interface SeatState {
  id: string;
  row: number;
  col: number;
  status: "available" | "selected" | "booked" | "blocked";
  seatNumber: string;
  deck?: "lower" | "upper";
  price?: number;
}

export interface TicketSchedule {
  id: string;
  operatorId: string;
  routeId: string;
  originCity: string;
  originCityBn: string;
  destinationCity: string;
  destinationCityBn: string;
  coachName: string;
  busType: BusTypeId;
  seatLayout: SeatLayoutId;
  departureTime: string;
  arrivalTime: string;
  baseFare: number;
  calculatedFare: number;
  totalSeats: number;
  availableSeats: number;
  scheduleType: ScheduleTypeId;
  scheduleDays?: string[];
  startDate: string;
  endDate?: string;
  paymentMode: PaymentModeId;
  commission: number;
  commissionRate: number;
  status: "draft" | "pending" | "approved" | "active" | "blocked" | "completed";
  seats: SeatState[];
}

export const SAFEGO_COMMISSION_RATE = 0.10;

export function calculateFare(baseFare: number, busType: BusTypeId): number {
  const busTypeConfig = BUS_TYPES.find((bt) => bt.id === busType);
  return Math.round(baseFare * (busTypeConfig?.fareMultiplier || 1));
}

export function calculateCommission(fare: number): number {
  return Math.round(fare * SAFEGO_COMMISSION_RATE);
}

export function generateSeats(layout: SeatLayoutId, baseFare: number, busType: BusTypeId): SeatState[] {
  const layoutConfig = SEAT_LAYOUTS.find((l) => l.id === layout);
  if (!layoutConfig) return [];

  const seats: SeatState[] = [];
  const fare = calculateFare(baseFare, busType);
  let seatNum = 1;

  const generateDeckSeats = (deck: "lower" | "upper" = "lower") => {
    for (let row = 0; row < layoutConfig.rows; row++) {
      let col = 0;
      for (let leftSeats = 0; leftSeats < layoutConfig.pattern[0]; leftSeats++) {
        seats.push({
          id: `${deck}-${row}-${col}`,
          row,
          col,
          status: "available",
          seatNumber: `${deck === "upper" ? "U" : ""}${seatNum}`,
          deck,
          price: fare,
        });
        seatNum++;
        col++;
      }
      col++;
      for (let rightSeats = 0; rightSeats < layoutConfig.pattern[1]; rightSeats++) {
        seats.push({
          id: `${deck}-${row}-${col}`,
          row,
          col,
          status: "available",
          seatNumber: `${deck === "upper" ? "U" : ""}${seatNum}`,
          deck,
          price: fare,
        });
        seatNum++;
        col++;
      }
    }
  };

  generateDeckSeats("lower");
  if (layoutConfig.hasUpperDeck) {
    generateDeckSeats("upper");
  }

  return seats;
}

export function getTotalSeats(layout: SeatLayoutId): number {
  const layoutConfig = SEAT_LAYOUTS.find((l) => l.id === layout);
  if (!layoutConfig) return 0;
  const seatsPerDeck = layoutConfig.rows * layoutConfig.seatsPerRow;
  return layoutConfig.hasUpperDeck ? seatsPerDeck * 2 : seatsPerDeck;
}

export function formatTime12Hour(time24: string): string {
  if (!time24) return "";
  const [hours, minutes] = time24.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const hours12 = hours % 12 || 12;
  return `${hours12}:${minutes.toString().padStart(2, "0")} ${period}`;
}

export function formatTimeBangla(time24: string): string {
  if (!time24) return "";
  const [hours, minutes] = time24.split(":").map(Number);
  const period = hours >= 12 ? "বিকাল" : "সকাল";
  const hours12 = hours % 12 || 12;
  const banglaDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  const hourStr = String(hours12).split("").map((d) => banglaDigits[parseInt(d)]).join("");
  const minStr = String(minutes).padStart(2, "0").split("").map((d) => banglaDigits[parseInt(d)]).join("");
  return `${period} ${hourStr}:${minStr}`;
}

export function formatCurrencyBangla(amount: number): string {
  const banglaDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  const formatted = amount.toLocaleString("en-IN");
  return "৳" + formatted.split("").map((c) => /\d/.test(c) ? banglaDigits[parseInt(c)] : c).join("");
}
