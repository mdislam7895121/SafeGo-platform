import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Clock, Save, Info, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

type DayOfWeek = "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";

interface RestaurantHours {
  id: string;
  dayOfWeek: DayOfWeek;
  isClosed: boolean;
  openTime1?: string | null;
  closeTime1?: string | null;
  openTime2?: string | null;
  closeTime2?: string | null;
}

interface ProfileData {
  ownerRole?: string;
  canViewAnalytics?: boolean;
}

export default function RestaurantHoursPage() {
  const { toast } = useToast();
  const [editedHours, setEditedHours] = useState<Record<string, RestaurantHours>>({});

  // Fetch profile to determine RBAC
  const { data: homeData } = useQuery<{ profile: ProfileData }>({
    queryKey: ["/api/restaurant/home"],
  });

  const userRole = homeData?.profile?.ownerRole || "OWNER";
  const canEdit = userRole === "OWNER";
  const canView = userRole === "OWNER" || homeData?.profile?.canViewAnalytics;

  // Fetch restaurant hours
  const { data, isLoading } = useQuery<{ hours: RestaurantHours[] }>({
    queryKey: ["/api/restaurant/settings/hours"],
    enabled: canView,
  });

  const hours = data?.hours || [];

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (hoursData: Partial<RestaurantHours>[]) => {
      const res = await apiRequest("PATCH", "/api/restaurant/settings/hours", { hours: hoursData });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/settings/hours"] });
      setEditedHours({});
      toast({
        title: "Success",
        description: "Business hours updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update business hours",
        variant: "destructive",
      });
    },
  });

  const dayOrder: DayOfWeek[] = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
  const dayNames: Record<DayOfWeek, string> = {
    MONDAY: "Monday",
    TUESDAY: "Tuesday",
    WEDNESDAY: "Wednesday",
    THURSDAY: "Thursday",
    FRIDAY: "Friday",
    SATURDAY: "Saturday",
    SUNDAY: "Sunday",
  };

  const getHoursForDay = (day: DayOfWeek): RestaurantHours => {
    const dayKey = day;
    if (editedHours[dayKey]) {
      return editedHours[dayKey];
    }
    const found = hours.find((h) => h.dayOfWeek === day);
    return (
      found || {
        id: "",
        dayOfWeek: day,
        isClosed: true,
        openTime1: null,
        closeTime1: null,
        openTime2: null,
        closeTime2: null,
      }
    );
  };

  const updateDayHours = (day: DayOfWeek, updates: Partial<RestaurantHours>) => {
    const current = getHoursForDay(day);
    setEditedHours({
      ...editedHours,
      [day]: { ...current, ...updates },
    });
  };

  const handleSave = () => {
    const hoursToUpdate = dayOrder.map((day) => {
      const dayHours = editedHours[day] || getHoursForDay(day);
      return {
        dayOfWeek: day,
        isClosed: dayHours.isClosed,
        openTime1: dayHours.isClosed ? null : dayHours.openTime1,
        closeTime1: dayHours.isClosed ? null : dayHours.closeTime1,
        openTime2: dayHours.isClosed ? null : dayHours.openTime2,
        closeTime2: dayHours.isClosed ? null : dayHours.closeTime2,
      };
    });

    updateMutation.mutate(hoursToUpdate);
  };

  const hasChanges = Object.keys(editedHours).length > 0;

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-accent rounded w-64"></div>
          <div className="h-32 bg-accent rounded"></div>
        </div>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="p-8">
        <Alert variant="destructive" data-testid="alert-no-permission">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You don't have permission to view operational settings.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <Clock className="h-8 w-8" />
          Business Hours
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage your restaurant's operating hours for each day of the week
        </p>
      </div>

      {!canEdit && (
        <Alert data-testid="alert-view-only">
          <Info className="h-4 w-4" />
          <AlertDescription>
            You have read-only access to these settings. Only the restaurant owner can make changes.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Weekly Schedule</CardTitle>
          <CardDescription>
            Set your opening and closing times for each day. You can define split shifts with two time periods per day.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {dayOrder.map((day) => {
            const dayHours = getHoursForDay(day);
            const isClosed = dayHours.isClosed;

            return (
              <div
                key={day}
                className="p-4 border rounded-lg space-y-3"
                data-testid={`day-row-${day.toLowerCase()}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="font-semibold w-24" data-testid={`text-day-${day.toLowerCase()}`}>
                      {dayNames[day]}
                    </span>
                    {isClosed && (
                      <Badge variant="secondary" data-testid={`badge-closed-${day.toLowerCase()}`}>
                        Closed
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`closed-${day}`}>Closed</Label>
                    <Switch
                      id={`closed-${day}`}
                      checked={isClosed}
                      onCheckedChange={(checked) => updateDayHours(day, { isClosed: checked })}
                      disabled={!canEdit}
                      data-testid={`switch-closed-${day.toLowerCase()}`}
                    />
                  </div>
                </div>

                {!isClosed && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">First Shift - Open</Label>
                        <input
                          type="time"
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors"
                          value={dayHours.openTime1 || ""}
                          onChange={(e) => updateDayHours(day, { openTime1: e.target.value || null })}
                          disabled={!canEdit}
                          data-testid={`input-open1-${day.toLowerCase()}`}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">First Shift - Close</Label>
                        <input
                          type="time"
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors"
                          value={dayHours.closeTime1 || ""}
                          onChange={(e) => updateDayHours(day, { closeTime1: e.target.value || null })}
                          disabled={!canEdit}
                          data-testid={`input-close1-${day.toLowerCase()}`}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">Second Shift - Open (Optional)</Label>
                        <input
                          type="time"
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors"
                          value={dayHours.openTime2 || ""}
                          onChange={(e) => updateDayHours(day, { openTime2: e.target.value || null })}
                          disabled={!canEdit}
                          data-testid={`input-open2-${day.toLowerCase()}`}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Second Shift - Close (Optional)</Label>
                        <input
                          type="time"
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors"
                          value={dayHours.closeTime2 || ""}
                          onChange={(e) => updateDayHours(day, { closeTime2: e.target.value || null })}
                          disabled={!canEdit}
                          data-testid={`input-close2-${day.toLowerCase()}`}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {canEdit && hasChanges && (
        <div className="flex items-center justify-end gap-4">
          <Button
            variant="outline"
            onClick={() => setEditedHours({})}
            disabled={updateMutation.isPending}
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="gap-2"
            data-testid="button-save"
          >
            <Save className="h-4 w-4" />
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      )}
    </div>
  );
}
