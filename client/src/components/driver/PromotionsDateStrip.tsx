import { useRef, useEffect, useMemo } from "react";
import { format, addDays, isSameDay, startOfDay, parseISO } from "date-fns";

interface CalendarEntry {
  count: number;
  types: string[];
}

interface PromotionsDateStripProps {
  startDate?: Date;
  days?: number;
  selectedDate: string;
  onDateChange: (date: string) => void;
  calendar?: Record<string, CalendarEntry>;
}

const WEEKDAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];

export function PromotionsDateStrip({
  startDate,
  days = 14,
  selectedDate,
  onDateChange,
  calendar,
}: PromotionsDateStripProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);
  const prevSelectedDateRef = useRef<string>(selectedDate);
  const hasInitialScrolledRef = useRef(false);

  const baseDateStr = useMemo(() => {
    const date = startDate || new Date();
    return format(startOfDay(date), "yyyy-MM-dd");
  }, [startDate]);
  
  const dates = useMemo(() => {
    const baseDate = parseISO(baseDateStr);
    const result: Date[] = [];
    for (let i = -3; i < days - 3; i++) {
      result.push(startOfDay(addDays(baseDate, i)));
    }
    return result;
  }, [baseDateStr, days]);

  const selectedDateObj = useMemo(() => {
    try {
      return startOfDay(parseISO(selectedDate));
    } catch {
      return startOfDay(new Date());
    }
  }, [selectedDate]);
  
  const todayStr = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);
  const todayObj = useMemo(() => startOfDay(parseISO(todayStr)), [todayStr]);

  useEffect(() => {
    if (!hasInitialScrolledRef.current && selectedRef.current && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const selectedEl = selectedRef.current;
      const containerWidth = container.clientWidth;
      const selectedLeft = selectedEl.offsetLeft;
      const selectedWidth = selectedEl.offsetWidth;
      
      const scrollPosition = selectedLeft - (containerWidth / 2) + (selectedWidth / 2);
      container.scrollTo({ left: Math.max(0, scrollPosition), behavior: "auto" });
      hasInitialScrolledRef.current = true;
    }
  }, [dates]);

  useEffect(() => {
    if (prevSelectedDateRef.current !== selectedDate && selectedRef.current && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const selectedEl = selectedRef.current;
      const containerWidth = container.clientWidth;
      const selectedLeft = selectedEl.offsetLeft;
      const selectedWidth = selectedEl.offsetWidth;
      
      const scrollPosition = selectedLeft - (containerWidth / 2) + (selectedWidth / 2);
      container.scrollTo({ left: Math.max(0, scrollPosition), behavior: "smooth" });
      prevSelectedDateRef.current = selectedDate;
    }
  }, [selectedDate]);

  return (
    <div 
      ref={scrollContainerRef}
      className="flex gap-2 overflow-x-auto pb-2 px-4 -mx-4 scrollbar-hide"
      style={{ 
        scrollbarWidth: "none",
        msOverflowStyle: "none",
        WebkitOverflowScrolling: "touch"
      }}
      data-testid="date-strip-container"
    >
      {dates.map((date) => {
        const isSelected = isSameDay(date, selectedDateObj);
        const isToday = isSameDay(date, todayObj);
        const dateStr = format(date, "yyyy-MM-dd");
        const dayOfWeek = date.getDay();
        const dayNumber = date.getDate();
        const hasPromotions = calendar && calendar[dateStr] && calendar[dateStr].count > 0;

        return (
          <button
            key={dateStr}
            ref={isSelected ? selectedRef : null}
            onClick={() => onDateChange(dateStr)}
            className={`
              flex flex-col items-center justify-center min-w-[48px] h-[64px] rounded-xl
              transition-all duration-200 ease-out shrink-0 relative
              ${isSelected 
                ? "bg-background text-primary shadow-lg scale-105 border border-border" 
                : "bg-white/20 text-white/90 hover:bg-white/30 active:scale-95"
              }
              ${isToday && !isSelected ? "ring-2 ring-white/60" : ""}
            `}
            data-testid={`date-pill-${dateStr}`}
          >
            <span className={`text-xs font-medium ${isSelected ? "text-muted-foreground" : "opacity-80"}`}>
              {WEEKDAY_INITIALS[dayOfWeek]}
            </span>
            <span className={`text-lg font-bold ${isSelected ? "text-foreground" : ""}`}>
              {dayNumber}
            </span>
            <div className="flex items-center gap-0.5 mt-0.5 h-1.5">
              {isToday && (
                <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-primary" : "bg-white"}`} />
              )}
              {hasPromotions && (
                <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-green-500" : "bg-green-400"}`} />
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
