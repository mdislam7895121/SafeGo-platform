import { Link } from "wouter";
import { ArrowLeft, Navigation, Check, MapPin, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

const navApps = [
  { id: "safego", name: "SafeGo Map Only", description: "Use in-app SafeGo Map navigation", icon: MapPin, isDefault: true },
  { id: "google", name: "Google Maps", description: "Open turn-by-turn directions in Google Maps", icon: ExternalLink },
  { id: "waze", name: "Waze", description: "Open navigation in Waze app", icon: ExternalLink },
  { id: "apple", name: "Apple Maps", description: "Open navigation in Apple Maps", icon: ExternalLink },
];

export default function NavigationSettings() {
  const { toast } = useToast();

  const { data: preferences } = useQuery<{ preferredNavigationApp?: string }>({
    queryKey: ["/api/driver/preferences"],
  });

  const currentApp = preferences?.preferredNavigationApp || "safego";

  const updateNavigationMutation = useMutation({
    mutationFn: async (preferredNavigationApp: string) => {
      const result = await apiRequest("/api/driver/preferences/navigation", {
        method: "PATCH",
        body: JSON.stringify({ preferredNavigationApp }),
        headers: { "Content-Type": "application/json" },
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/preferences"] });
      toast({ title: "Navigation app updated successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update navigation app",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleSelectNav = (appId: string) => {
    if (appId !== currentApp) {
      updateNavigationMutation.mutate(appId);
    }
  };

  return (
    <div className="bg-background">
      <div className="bg-primary text-primary-foreground p-6">
        <div className="flex items-center gap-4">
          <Link href="/driver/account">
            <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10" data-testid="button-back">
              <ArrowLeft className="h-6 w-6" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Navigation</h1>
        </div>
      </div>

      <div className="p-6 max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Navigation className="h-5 w-5" />
              Navigation Preferences
            </CardTitle>
            <CardDescription>
              Choose how you want to navigate during trips. SafeGo Map shows directions in-app, 
              while external apps open turn-by-turn navigation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {navApps.map((app) => {
              const Icon = app.icon;
              return (
                <button
                  key={app.id}
                  onClick={() => handleSelectNav(app.id)}
                  disabled={updateNavigationMutation.isPending}
                  className={`flex items-start gap-4 w-full p-4 rounded-lg hover-elevate active-elevate-2 text-left ${
                    app.id === currentApp ? "bg-primary/10 border-2 border-primary" : "border-2 border-transparent"
                  }`}
                  data-testid={`button-nav-${app.id}`}
                >
                  <div className={`p-2 rounded-full ${app.id === currentApp ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{app.name}</p>
                      {app.isDefault && (
                        <Badge variant="secondary" className="text-xs">Recommended</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{app.description}</p>
                  </div>
                  {app.id === currentApp && (
                    <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-1">
                      <Check className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                </button>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
