import { useRef, useEffect, useMemo } from "react";
import { format, addDays, isSameDay, startOfDay, parseISO } from "date-fns";

interface PromotionsDateStripProps {
  startDate?: Date;
  days?: number;
  selectedDate: string;
  onDateChange: (date: string) => void;
}

const WEEKDAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];

export function PromotionsDateStrip({
  startDate,
  days = 14,
  selectedDate,
  onDateChange,
}: PromotionsDateStripProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  const baseDate = startDate || startOfDay(new Date());
  
  const dates = useMemo(() => {
    const result: Date[] = [];
    for (let i = -3; i < days - 3; i++) {
      result.push(startOfDay(addDays(baseDate, i)));
    }
    return result;
  }, [baseDate, days]);

  const selectedDateObj = useMemo(() => {
    try {
      return startOfDay(parseISO(selectedDate));
    } catch {
      return startOfDay(new Date());
    }
  }, [selectedDate]);
  
  const todayObj = useMemo(() => startOfDay(new Date()), []);

  useEffect(() => {
    if (selectedRef.current && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const selectedEl = selectedRef.current;
      const containerWidth = container.clientWidth;
      const selectedLeft = selectedEl.offsetLeft;
      const selectedWidth = selectedEl.offsetWidth;
      
      const scrollPosition = selectedLeft - (containerWidth / 2) + (selectedWidth / 2);
      container.scrollTo({ left: Math.max(0, scrollPosition), behavior: "smooth" });
    }
  }, [selectedDate]);

  useEffect(() => {
    if (selectedRef.current && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const selectedEl = selectedRef.current;
      const containerWidth = container.clientWidth;
      const selectedLeft = selectedEl.offsetLeft;
      const selectedWidth = selectedEl.offsetWidth;
      
      const scrollPosition = selectedLeft - (containerWidth / 2) + (selectedWidth / 2);
      container.scrollTo({ left: Math.max(0, scrollPosition), behavior: "auto" });
    }
  }, []);

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

        return (
          <button
            key={dateStr}
            ref={isSelected ? selectedRef : null}
            onClick={() => onDateChange(dateStr)}
            className={`
              flex flex-col items-center justify-center min-w-[48px] h-[64px] rounded-xl
              transition-all duration-200 ease-out shrink-0
              ${isSelected 
                ? "bg-white text-purple-600 shadow-lg scale-105" 
                : "bg-white/20 text-white hover:bg-white/30"
              }
              ${isToday && !isSelected ? "ring-2 ring-white/50" : ""}
            `}
            data-testid={`date-pill-${dateStr}`}
          >
            <span className={`text-xs font-medium ${isSelected ? "text-purple-400" : "opacity-80"}`}>
              {WEEKDAY_INITIALS[dayOfWeek]}
            </span>
            <span className={`text-lg font-bold ${isSelected ? "text-purple-600" : ""}`}>
              {dayNumber}
            </span>
            {isToday && (
              <div className={`w-1.5 h-1.5 rounded-full mt-0.5 ${isSelected ? "bg-purple-500" : "bg-white"}`} />
            )}
          </button>
        );
      })}
    </div>
  );
}
