import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format, addDays, addWeeks, addMonths } from "date-fns";
import { bn } from "date-fns/locale";
import {
  SCHEDULE_TYPES,
  WEEKDAYS,
  type ScheduleTypeId,
} from "@/lib/bd-ticket-types";
import { Calendar as CalendarIcon, Clock, Repeat, CalendarDays } from "lucide-react";

interface ScheduleConfig {
  type: ScheduleTypeId;
  startDate: Date;
  endDate?: Date;
  departureTime: string;
  arrivalTime: string;
  selectedDays: string[];
  repeatCount?: number;
}

interface ScheduleBuilderProps {
  value?: Partial<ScheduleConfig>;
  onChange: (config: ScheduleConfig) => void;
  className?: string;
}

export function ScheduleBuilder({
  value,
  onChange,
  className,
}: ScheduleBuilderProps) {
  const [scheduleType, setScheduleType] = useState<ScheduleTypeId>(
    value?.type || "single"
  );
  const [startDate, setStartDate] = useState<Date>(
    value?.startDate || new Date()
  );
  const [endDate, setEndDate] = useState<Date | undefined>(value?.endDate);
  const [departureTime, setDepartureTime] = useState(
    value?.departureTime || "08:00"
  );
  const [arrivalTime, setArrivalTime] = useState(value?.arrivalTime || "14:00");
  const [selectedDays, setSelectedDays] = useState<string[]>(
    value?.selectedDays || []
  );
  const [repeatCount, setRepeatCount] = useState(value?.repeatCount || 30);
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);

  useEffect(() => {
    onChange({
      type: scheduleType,
      startDate,
      endDate,
      departureTime,
      arrivalTime,
      selectedDays,
      repeatCount,
    });
  }, [
    scheduleType,
    startDate,
    endDate,
    departureTime,
    arrivalTime,
    selectedDays,
    repeatCount,
  ]);

  useEffect(() => {
    if (scheduleType === "single") {
      setEndDate(undefined);
      setSelectedDays([]);
    } else if (scheduleType === "daily") {
      setEndDate(addDays(startDate, repeatCount));
      setSelectedDays(WEEKDAYS.map((d) => d.id));
    } else if (scheduleType === "weekly") {
      setEndDate(addWeeks(startDate, 4));
    } else if (scheduleType === "weekend") {
      setSelectedDays(["fri", "sat"]);
      setEndDate(addMonths(startDate, 1));
    }
  }, [scheduleType, startDate, repeatCount]);

  const toggleDay = (dayId: string) => {
    setSelectedDays((prev) =>
      prev.includes(dayId)
        ? prev.filter((d) => d !== dayId)
        : [...prev, dayId]
    );
  };

  const formatDateBangla = (date: Date) => {
    return format(date, "d MMMM yyyy", { locale: bn });
  };

  const getScheduleSummary = () => {
    switch (scheduleType) {
      case "single":
        return `${formatDateBangla(startDate)} তারিখে একটি ট্রিপ`;
      case "daily":
        return `প্রতিদিন ${formatDateBangla(startDate)} থেকে ${
          endDate ? formatDateBangla(endDate) : ""
        }`;
      case "weekly":
        return `সাপ্তাহিক ${selectedDays
          .map((d) => WEEKDAYS.find((w) => w.id === d)?.label)
          .join(", ")}`;
      case "weekend":
        return "শুধু শুক্র ও শনিবার";
      case "custom":
        return `কাস্টম: ${selectedDays
          .map((d) => WEEKDAYS.find((w) => w.id === d)?.label)
          .join(", ")}`;
      default:
        return "";
    }
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <CalendarDays className="h-5 w-5" />
          সময়সূচী নির্ধারণ
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>সময়সূচীর ধরন</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {SCHEDULE_TYPES.map((type) => (
              <Button
                key={type.id}
                type="button"
                variant={scheduleType === type.id ? "default" : "outline"}
                size="sm"
                onClick={() => setScheduleType(type.id as ScheduleTypeId)}
                data-testid={`schedule-type-${type.id}`}
              >
                {type.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>ছাড়ার সময়</Label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="time"
                value={departureTime}
                onChange={(e) => setDepartureTime(e.target.value)}
                className="pl-10 h-12"
                data-testid="input-departure-time"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>পৌঁছানোর সময়</Label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="time"
                value={arrivalTime}
                onChange={(e) => setArrivalTime(e.target.value)}
                className="pl-10 h-12"
                data-testid="input-arrival-time"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>শুরুর তারিখ</Label>
            <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full h-12 justify-start text-left font-normal",
                    !startDate && "text-muted-foreground"
                  )}
                  data-testid="button-start-date"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? formatDateBangla(startDate) : "তারিখ নির্বাচন করুন"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={(date) => {
                    if (date) {
                      setStartDate(date);
                      setStartDateOpen(false);
                    }
                  }}
                  disabled={(date) => date < new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {scheduleType !== "single" && (
            <div className="space-y-2">
              <Label>শেষের তারিখ</Label>
              <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full h-12 justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                    data-testid="button-end-date"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? formatDateBangla(endDate) : "তারিখ নির্বাচন করুন"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => {
                      if (date) {
                        setEndDate(date);
                        setEndDateOpen(false);
                      }
                    }}
                    disabled={(date) => date <= startDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>

        {(scheduleType === "weekly" || scheduleType === "custom") && (
          <div className="space-y-2">
            <Label>সপ্তাহের দিন নির্বাচন করুন</Label>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((day) => (
                <Button
                  key={day.id}
                  type="button"
                  variant={selectedDays.includes(day.id) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleDay(day.id)}
                  data-testid={`day-${day.id}`}
                >
                  {day.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {scheduleType === "daily" && (
          <div className="space-y-2">
            <Label>কতদিন চলবে?</Label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={1}
                max={365}
                value={repeatCount}
                onChange={(e) => setRepeatCount(parseInt(e.target.value) || 30)}
                className="w-24 h-12"
                data-testid="input-repeat-count"
              />
              <span className="text-muted-foreground">দিন</span>
            </div>
          </div>
        )}

        <div className="p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2 text-sm">
            <Repeat className="h-4 w-4 text-primary" />
            <span className="font-medium">সারাংশ:</span>
            <span className="text-muted-foreground">{getScheduleSummary()}</span>
          </div>
          {scheduleType !== "single" && endDate && (
            <div className="mt-2 text-xs text-muted-foreground">
              মোট ট্রিপ: আনুমানিক{" "}
              {scheduleType === "daily"
                ? repeatCount
                : scheduleType === "weekly"
                ? Math.ceil(
                    (endDate.getTime() - startDate.getTime()) /
                      (7 * 24 * 60 * 60 * 1000)
                  ) * selectedDays.length
                : scheduleType === "weekend"
                ? Math.ceil(
                    (endDate.getTime() - startDate.getTime()) /
                      (7 * 24 * 60 * 60 * 1000)
                  ) * 2
                : selectedDays.length}{" "}
              টি
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function QuickScheduleSelect({
  onSelect,
  className,
}: {
  onSelect: (type: ScheduleTypeId, days?: string[]) => void;
  className?: string;
}) {
  const quickOptions = [
    { type: "single" as ScheduleTypeId, label: "আজকে একটি ট্রিপ" },
    { type: "daily" as ScheduleTypeId, label: "প্রতিদিন (১ মাস)" },
    { type: "weekend" as ScheduleTypeId, label: "শুধু উইকেন্ড" },
    {
      type: "custom" as ScheduleTypeId,
      label: "শুধু শুক্রবার",
      days: ["fri"],
    },
  ];

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {quickOptions.map((option, index) => (
        <Button
          key={index}
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onSelect(option.type, option.days)}
          data-testid={`quick-schedule-${index}`}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
