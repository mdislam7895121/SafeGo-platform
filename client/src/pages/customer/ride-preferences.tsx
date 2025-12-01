import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ArrowLeft, Car, Music, Volume2, VolumeX, Thermometer, MessageSquare,
  Loader2, Save, CheckCircle2, Dog, Cigarette, Baby, Accessibility
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface RidePreferences {
  id: string;
  preferredTemperature?: "cool" | "warm" | "no_preference";
  musicPreference?: "quiet" | "driver_choice" | "my_music" | "no_preference";
  conversationLevel?: "quiet" | "friendly" | "no_preference";
  accessibilityNeeds?: string[];
  petFriendly: boolean;
  childSeatRequired: boolean;
  preferNonSmoking: boolean;
  specialInstructions?: string;
}

interface RidePreferencesResponse {
  preferences: RidePreferences | null;
}

const temperatureOptions = [
  { value: "cool", label: "Cool (A/C On)", icon: "❄️" },
  { value: "warm", label: "Warm", icon: "🌡️" },
  { value: "no_preference", label: "No Preference", icon: "➖" },
];

const musicOptions = [
  { value: "quiet", label: "Quiet Ride (No Music)", icon: VolumeX },
  { value: "driver_choice", label: "Driver's Choice", icon: Music },
  { value: "my_music", label: "I'll Play My Own", icon: Volume2 },
  { value: "no_preference", label: "No Preference", icon: Music },
];

const conversationOptions = [
  { value: "quiet", label: "Quiet Ride", description: "I prefer minimal conversation" },
  { value: "friendly", label: "Friendly Chat", description: "I enjoy conversation" },
  { value: "no_preference", label: "No Preference", description: "I'm flexible" },
];

const accessibilityOptions = [
  { value: "wheelchair", label: "Wheelchair Accessible" },
  { value: "service_animal", label: "Service Animal" },
  { value: "hearing_impaired", label: "Hearing Impaired" },
  { value: "visual_impaired", label: "Visually Impaired" },
  { value: "extra_assistance", label: "Extra Assistance Needed" },
];

export default function RidePreferences() {
  const { toast } = useToast();
  const [hasChanges, setHasChanges] = useState(false);

  const [preferences, setPreferences] = useState<Partial<RidePreferences>>({
    preferredTemperature: "no_preference",
    musicPreference: "no_preference",
    conversationLevel: "no_preference",
    accessibilityNeeds: [],
    petFriendly: false,
    childSeatRequired: false,
    preferNonSmoking: true,
    specialInstructions: "",
  });

  const { data, isLoading } = useQuery<RidePreferencesResponse>({
    queryKey: ["/api/customer/ride-preferences"],
  });

  useEffect(() => {
    if (data?.preferences) {
      setPreferences({
        ...data.preferences,
        accessibilityNeeds: data.preferences.accessibilityNeeds || [],
      });
    }
  }, [data]);

  const updatePreferencesMutation = useMutation({
    mutationFn: async (prefs: Partial<RidePreferences>) => {
      const response = await apiRequest("/api/customer/ride-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer/ride-preferences"] });
      toast({
        title: "Preferences saved",
        description: "Your ride preferences have been updated.",
      });
      setHasChanges(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Save failed",
        description: error.message || "Could not save your preferences. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handlePreferenceChange = <K extends keyof typeof preferences>(
    key: K,
    value: typeof preferences[K]
  ) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleAccessibilityToggle = (value: string) => {
    const current = preferences.accessibilityNeeds || [];
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    handlePreferenceChange("accessibilityNeeds", updated);
  };

  const handleSave = () => {
    updatePreferencesMutation.mutate(preferences);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="p-6 space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-50 bg-background border-b">
        <div className="flex items-center gap-4 p-4">
          <Link href="/customer">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-lg font-semibold">Ride Preferences</h1>
        </div>
      </div>

      <div className="p-4 space-y-6 max-w-lg mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Car className="h-4 w-4" />
              In-Ride Comfort
            </CardTitle>
            <CardDescription>
              Set your preferred ride environment
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Thermometer className="h-4 w-4" />
                Temperature
              </Label>
              <Select
                value={preferences.preferredTemperature || "no_preference"}
                onValueChange={(value) =>
                  handlePreferenceChange("preferredTemperature", value as any)
                }
              >
                <SelectTrigger data-testid="select-temperature">
                  <SelectValue placeholder="Select temperature preference" />
                </SelectTrigger>
                <SelectContent>
                  {temperatureOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span className="flex items-center gap-2">
                        <span>{opt.icon}</span>
                        {opt.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Music className="h-4 w-4" />
                Music
              </Label>
              <Select
                value={preferences.musicPreference || "no_preference"}
                onValueChange={(value) =>
                  handlePreferenceChange("musicPreference", value as any)
                }
              >
                <SelectTrigger data-testid="select-music">
                  <SelectValue placeholder="Select music preference" />
                </SelectTrigger>
                <SelectContent>
                  {musicOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Conversation Level
              </Label>
              <div className="space-y-2">
                {conversationOptions.map((opt) => (
                  <div
                    key={opt.value}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      preferences.conversationLevel === opt.value
                        ? "border-primary bg-primary/5"
                        : "hover-elevate"
                    }`}
                    onClick={() =>
                      handlePreferenceChange("conversationLevel", opt.value as any)
                    }
                    data-testid={`option-conversation-${opt.value}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{opt.label}</p>
                        <p className="text-xs text-muted-foreground">{opt.description}</p>
                      </div>
                      {preferences.conversationLevel === opt.value && (
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Accessibility className="h-4 w-4" />
              Special Requirements
            </CardTitle>
            <CardDescription>
              Let drivers know about your specific needs
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-950 flex items-center justify-center">
                  <Dog className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">Pet Friendly</p>
                  <p className="text-xs text-muted-foreground">Traveling with a pet</p>
                </div>
              </div>
              <Switch
                checked={preferences.petFriendly}
                onCheckedChange={(checked) => handlePreferenceChange("petFriendly", checked)}
                data-testid="switch-pet-friendly"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
                  <Baby className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">Child Seat Required</p>
                  <p className="text-xs text-muted-foreground">Need a car seat for a child</p>
                </div>
              </div>
              <Switch
                checked={preferences.childSeatRequired}
                onCheckedChange={(checked) => handlePreferenceChange("childSeatRequired", checked)}
                data-testid="switch-child-seat"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-950 flex items-center justify-center">
                  <Cigarette className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">Non-Smoking Vehicle</p>
                  <p className="text-xs text-muted-foreground">Prefer smoke-free rides</p>
                </div>
              </div>
              <Switch
                checked={preferences.preferNonSmoking}
                onCheckedChange={(checked) => handlePreferenceChange("preferNonSmoking", checked)}
                data-testid="switch-non-smoking"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Accessibility className="h-4 w-4" />
              Accessibility Needs
            </CardTitle>
            <CardDescription>
              Select any accessibility accommodations you need
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {accessibilityOptions.map((opt) => (
                <div
                  key={opt.value}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    preferences.accessibilityNeeds?.includes(opt.value)
                      ? "border-primary bg-primary/5"
                      : "hover-elevate"
                  }`}
                  onClick={() => handleAccessibilityToggle(opt.value)}
                  data-testid={`option-accessibility-${opt.value}`}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">{opt.label}</p>
                    {preferences.accessibilityNeeds?.includes(opt.value) && (
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Special Instructions</CardTitle>
            <CardDescription>
              Any additional notes for your driver
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={preferences.specialInstructions || ""}
              onChange={(e) => handlePreferenceChange("specialInstructions", e.target.value)}
              placeholder="e.g., Please call when you arrive, I have mobility limitations..."
              className="min-h-[100px] resize-none"
              maxLength={500}
              data-testid="textarea-special-instructions"
            />
            <p className="text-xs text-muted-foreground mt-2 text-right">
              {(preferences.specialInstructions || "").length}/500 characters
            </p>
          </CardContent>
        </Card>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t">
          <div className="max-w-lg mx-auto">
            <Button
              className="w-full h-12"
              onClick={handleSave}
              disabled={!hasChanges || updatePreferencesMutation.isPending}
              data-testid="button-save-preferences"
            >
              {updatePreferencesMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Preferences
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
