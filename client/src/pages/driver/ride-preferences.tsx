import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  ArrowLeft, 
  Car,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Loader2,
  Shield,
  Users,
  Zap,
  Crown,
  Truck,
  Accessibility
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CategoryInfo {
  id: string;
  displayName: string;
  shortDescription: string;
  seatCount: number;
  baseMultiplier: number;
  minimumFare: number;
  iconType: string;
}

interface PreferencesData {
  driverId: string;
  vehicleId: string;
  vehicleCategory: string;
  eligibleCategories: CategoryInfo[];
  allowedCategories: string[];
  lockedCategories: string[];
  preferencesLastUpdated: string | null;
  canDisableCategories: boolean;
}

function getCategoryIcon(iconType: string, className: string = "h-5 w-5") {
  switch (iconType) {
    case "economy":
      return <Car className={className} />;
    case "comfort":
      return <Zap className={className} />;
    case "xl":
      return <Users className={className} />;
    case "premium":
      return <Crown className={className} />;
    case "suv":
      return <Truck className={className} />;
    case "accessible":
      return <Accessibility className={className} />;
    default:
      return <Car className={className} />;
  }
}

function getCategoryBadgeColor(id: string): string {
  if (id.includes("BLACK")) return "bg-neutral-900 text-white";
  if (id.includes("COMFORT")) return "bg-blue-600 text-white";
  if (id.includes("XL")) return "bg-purple-600 text-white";
  if (id.includes("WAV")) return "bg-teal-600 text-white";
  return "bg-primary text-primary-foreground";
}

export default function DriverRidePreferences() {
  const { toast } = useToast();

  const { data: preferences, isLoading, error } = useQuery<{ success: boolean; data: PreferencesData }>({
    queryKey: ["/api/driver/category-preferences"],
  });

  const updatePreferencesMutation = useMutation({
    mutationFn: async (allowedCategories: string[]) => {
      const result = await apiRequest("/api/driver/category-preferences", {
        method: "PUT",
        body: JSON.stringify({ allowedCategories }),
        headers: { "Content-Type": "application/json" },
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/category-preferences"] });
      toast({ 
        title: "Preferences updated",
        description: "Your ride category preferences have been saved."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update preferences",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleToggleCategory = (categoryId: string, currentlyEnabled: boolean) => {
    if (!preferences?.data) return;
    
    const { allowedCategories, lockedCategories, eligibleCategories } = preferences.data;
    
    if (lockedCategories.includes(categoryId)) {
      toast({
        title: "Category locked",
        description: "This category cannot be disabled for safety/compliance reasons.",
        variant: "destructive",
      });
      return;
    }

    let newAllowed: string[];
    
    if (currentlyEnabled) {
      newAllowed = allowedCategories.filter(c => c !== categoryId);
      if (newAllowed.length === 0) {
        toast({
          title: "Cannot disable all categories",
          description: "You must have at least one category enabled to receive ride requests.",
          variant: "destructive",
        });
        return;
      }
    } else {
      newAllowed = [...allowedCategories, categoryId];
    }

    updatePreferencesMutation.mutate(newAllowed);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="bg-primary text-primary-foreground p-6 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-8 w-48" />
          </div>
        </div>
        <div className="p-6 max-w-2xl mx-auto space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !preferences?.data) {
    return (
      <div className="min-h-screen bg-background">
        <div className="bg-primary text-primary-foreground p-6 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <Link href="/driver/settings">
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-primary-foreground hover:bg-primary-foreground/10" 
                data-testid="button-back"
              >
                <ArrowLeft className="h-6 w-6" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Ride Preferences</h1>
          </div>
        </div>
        <div className="p-6 max-w-2xl mx-auto">
          <Alert variant="destructive" data-testid="alert-error">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Unable to load your ride preferences. Please ensure you have a registered vehicle with an approved category.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const { 
    vehicleCategory, 
    eligibleCategories, 
    allowedCategories, 
    lockedCategories,
    preferencesLastUpdated,
    canDisableCategories 
  } = preferences.data;

  const enabledCount = allowedCategories.length;
  const totalEligible = eligibleCategories.length;

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-primary text-primary-foreground p-6 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link href="/driver/settings">
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-primary-foreground hover:bg-primary-foreground/10" 
              data-testid="button-back"
            >
              <ArrowLeft className="h-6 w-6" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Ride Preferences</h1>
            <p className="text-sm opacity-90 mt-1">Choose which ride types you want to accept</p>
          </div>
          {updatePreferencesMutation.isPending && (
            <Loader2 className="h-5 w-5 animate-spin" />
          )}
        </div>
      </div>

      <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
        <Card data-testid="card-vehicle-category">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  Your Vehicle Category
                </CardTitle>
                <CardDescription>
                  Based on your approved vehicle category
                </CardDescription>
              </div>
              <Badge className={getCategoryBadgeColor(vehicleCategory)} data-testid="badge-vehicle-category">
                {vehicleCategory.replace("SAFEGO_", "")}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span data-testid="text-enabled-count">{enabledCount} enabled</span>
              </div>
              <div className="flex items-center gap-1">
                <Info className="h-4 w-4" />
                <span data-testid="text-eligible-count">{totalEligible} eligible</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Alert data-testid="alert-info">
          <Info className="h-4 w-4" />
          <AlertDescription>
            Toggle categories on or off to control which ride requests you receive. 
            Disabling a category means you won't get requests for that ride type.
          </AlertDescription>
        </Alert>

        <Card data-testid="card-category-preferences">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Ride Categories</CardTitle>
            <CardDescription>
              Enable or disable categories based on your preference
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {eligibleCategories.map((category) => {
              const isEnabled = allowedCategories.includes(category.id);
              const isLocked = lockedCategories.includes(category.id);
              
              return (
                <div 
                  key={category.id}
                  className="flex items-center justify-between p-4 rounded-lg border hover-elevate transition-colors"
                  data-testid={`category-row-${category.id}`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`p-2 rounded-lg ${getCategoryBadgeColor(category.id)}`}>
                      {getCategoryIcon(category.iconType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Label className="font-medium" data-testid={`text-category-name-${category.id}`}>
                          {category.displayName}
                        </Label>
                        {isLocked && (
                          <Badge variant="outline" className="text-xs" data-testid={`badge-locked-${category.id}`}>
                            <Shield className="h-3 w-3 mr-1" />
                            Required
                          </Badge>
                        )}
                        {category.id === vehicleCategory && (
                          <Badge variant="secondary" className="text-xs" data-testid={`badge-primary-${category.id}`}>
                            Primary
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate" data-testid={`text-category-desc-${category.id}`}>
                        {category.shortDescription}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{category.seatCount} seats</span>
                        <span className="text-primary font-medium">
                          {category.baseMultiplier.toFixed(1)}x rate
                        </span>
                        <span>Min ${category.minimumFare.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    {isEnabled ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-muted-foreground" />
                    )}
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={() => handleToggleCategory(category.id, isEnabled)}
                      disabled={isLocked || updatePreferencesMutation.isPending}
                      data-testid={`switch-category-${category.id}`}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {lockedCategories.length > 0 && (
          <Alert data-testid="alert-locked-info">
            <Shield className="h-4 w-4" />
            <AlertDescription>
              Categories marked as "Required" cannot be disabled. 
              {lockedCategories.includes("SAFEGO_WAV") && (
                <span className="block mt-1">
                  WAV (Wheelchair Accessible Vehicles) is locked for accessibility compliance.
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {preferencesLastUpdated && (
          <p className="text-center text-sm text-muted-foreground" data-testid="text-last-updated">
            Last updated: {new Date(preferencesLastUpdated).toLocaleDateString()} at{" "}
            {new Date(preferencesLastUpdated).toLocaleTimeString()}
          </p>
        )}
      </div>
    </div>
  );
}
