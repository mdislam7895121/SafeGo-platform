import { useState, useEffect } from "react";
import { MapPin, Navigation, ExternalLink, Layers, Route, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  NavigationProvider,
  NAVIGATION_PROVIDERS,
  loadNavigationPreferences,
  saveNavigationPreferences,
  type NavigationPreferences,
} from "@/lib/navigationProviders";

export function NavigationSettings() {
  const { toast } = useToast();
  const [preferences, setPreferences] = useState<NavigationPreferences>({
    primaryProvider: NavigationProvider.SAFEGO,
    showTrafficByDefault: false,
    autoRouteRecalculation: true,
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loaded = loadNavigationPreferences();
    setPreferences(loaded);
  }, []);

  const handleProviderChange = (value: string) => {
    const provider = value as NavigationProvider;
    setPreferences((prev) => ({ ...prev, primaryProvider: provider }));
    saveNavigationPreferences({ primaryProvider: provider });
    
    const providerInfo = NAVIGATION_PROVIDERS.find((p) => p.id === provider);
    toast({
      title: "Navigation provider updated",
      description: `${providerInfo?.name || provider} is now your default`,
    });
  };

  const handleTrafficToggle = (checked: boolean) => {
    setPreferences((prev) => ({ ...prev, showTrafficByDefault: checked }));
    saveNavigationPreferences({ showTrafficByDefault: checked });
    toast({
      title: checked ? "Traffic layer enabled" : "Traffic layer disabled",
      description: "Your preference has been saved",
    });
  };

  const handleAutoRecalculateToggle = (checked: boolean) => {
    setPreferences((prev) => ({ ...prev, autoRouteRecalculation: checked }));
    saveNavigationPreferences({ autoRouteRecalculation: checked });
    toast({
      title: checked ? "Auto-recalculation enabled" : "Auto-recalculation disabled",
      description: "Your preference has been saved",
    });
  };

  return (
    <div className="space-y-6" data-testid="navigation-settings">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <Navigation className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Navigation Provider</CardTitle>
              <CardDescription>
                Choose your preferred map for turn-by-turn directions
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={preferences.primaryProvider}
            onValueChange={handleProviderChange}
            className="space-y-3"
            data-testid="radio-navigation-provider"
          >
            {NAVIGATION_PROVIDERS.map((provider) => (
              <div
                key={provider.id}
                className={`relative flex items-center space-x-3 rounded-lg border p-4 transition-colors hover-elevate cursor-pointer ${
                  preferences.primaryProvider === provider.id
                    ? "border-primary bg-primary/5"
                    : "border-border"
                }`}
                onClick={() => handleProviderChange(provider.id)}
                data-testid={`provider-radio-${provider.id}`}
              >
                <RadioGroupItem value={provider.id} id={provider.id} className="sr-only" />
                <div className="flex-shrink-0">
                  {provider.isExternal ? (
                    <ExternalLink className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <MapPin className="h-5 w-5 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor={provider.id}
                      className="text-sm font-medium cursor-pointer"
                    >
                      {provider.name}
                    </Label>
                    {provider.id === NavigationProvider.SAFEGO && (
                      <Badge variant="secondary" className="text-[10px]">
                        Recommended
                      </Badge>
                    )}
                    {provider.isExternal && (
                      <Badge variant="outline" className="text-[10px]">
                        External
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {provider.description}
                  </p>
                </div>
                {preferences.primaryProvider === provider.id && (
                  <Check className="h-5 w-5 text-primary flex-shrink-0" />
                )}
              </div>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <Layers className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Map Preferences</CardTitle>
              <CardDescription>
                Customize your in-app map experience
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between" data-testid="toggle-traffic-default">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Show traffic by default</Label>
              <p className="text-xs text-muted-foreground">
                Display traffic conditions on the map automatically
              </p>
            </div>
            <Switch
              checked={preferences.showTrafficByDefault}
              onCheckedChange={handleTrafficToggle}
              data-testid="switch-traffic-default"
            />
          </div>

          <div className="flex items-center justify-between" data-testid="toggle-auto-recalculate">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Auto route recalculation</Label>
              <p className="text-xs text-muted-foreground">
                Automatically recalculate route when you go off-track
              </p>
            </div>
            <Switch
              checked={preferences.autoRouteRecalculation}
              onCheckedChange={handleAutoRecalculateToggle}
              data-testid="switch-auto-recalculate"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/30">
              <Route className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-lg">Navigation Tips</CardTitle>
              <CardDescription>
                Get the most out of SafeGo navigation
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
              <span>
                <strong className="text-foreground">SafeGo Map</strong> provides seamless
                in-app navigation with live ETA updates and traffic info.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
              <span>
                External apps like <strong className="text-foreground">Google Maps</strong> or{" "}
                <strong className="text-foreground">Waze</strong> open in a new window.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
              <span>
                Enable <strong className="text-foreground">auto recalculation</strong> to
                automatically update your route if you take a different path.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
              <span>
                For the best experience, ensure GPS is enabled with high accuracy.
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

export default NavigationSettings;
