import { useState, useEffect } from "react";
import { Link } from "wouter";
import { ArrowLeft, Map, Navigation2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const navigationApps = [
  { 
    id: "safego", 
    name: "Default SafeGo Map", 
    description: "Built-in navigation with real-time traffic",
    available: true 
  },
  { 
    id: "google", 
    name: "Google Maps", 
    description: "Navigate with Google Maps app",
    available: true 
  },
  { 
    id: "apple", 
    name: "Apple Maps", 
    description: "Navigate with Apple Maps app",
    available: true 
  },
  { 
    id: "waze", 
    name: "Waze", 
    description: "Navigate with Waze app",
    available: true 
  },
];

const mapStyles = [
  { id: "standard", name: "Standard", description: "Default map style" },
  { id: "satellite", name: "Satellite", description: "Aerial view" },
  { id: "terrain", name: "Terrain", description: "Topographic details" },
  { id: "dark", name: "Dark Mode", description: "Optimized for night driving" },
];

export default function MapSettings() {
  const { toast } = useToast();
  const [selectedNav, setSelectedNav] = useState("safego");
  const [selectedStyle, setSelectedStyle] = useState("standard");

  // Load saved preferences from localStorage on mount
  useEffect(() => {
    const savedNav = localStorage.getItem("driver_navigation_app");
    const savedStyle = localStorage.getItem("driver_map_style");
    
    if (savedNav && navigationApps.some(app => app.id === savedNav)) {
      setSelectedNav(savedNav);
    }
    
    if (savedStyle && mapStyles.some(style => style.id === savedStyle)) {
      setSelectedStyle(savedStyle);
    }
  }, []);

  const handleNavChange = (navId: string) => {
    setSelectedNav(navId);
    // Store in localStorage for now - can be synced to backend later
    localStorage.setItem("driver_navigation_app", navId);
    toast({
      title: "Navigation App Updated",
      description: `You will now use ${navigationApps.find(n => n.id === navId)?.name}`,
    });
  };

  const handleStyleChange = (styleId: string) => {
    setSelectedStyle(styleId);
    // Store in localStorage for now - can be synced to backend later
    localStorage.setItem("driver_map_style", styleId);
    toast({
      title: "Map Style Updated",
      description: `Map style changed to ${mapStyles.find(s => s.id === styleId)?.name}`,
    });
  };

  return (
    <div className="bg-background min-h-screen">
      <div className="bg-primary text-primary-foreground p-6 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link href="/driver/account">
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-primary-foreground hover:bg-primary-foreground/10" 
              data-testid="button-back"
            >
              <ArrowLeft className="h-6 w-6" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Map Settings</h1>
            <p className="text-sm opacity-90 mt-1">Choose your preferred navigation app and map display</p>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-2xl mx-auto space-y-6">
        {/* Navigation App Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Navigation2 className="h-5 w-5" />
              Navigation App
            </CardTitle>
            <CardDescription>Choose which app to use for navigation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {navigationApps.map((app) => (
              <button
                key={app.id}
                onClick={() => handleNavChange(app.id)}
                disabled={!app.available}
                className={`flex items-center justify-between w-full p-4 rounded-lg hover-elevate active-elevate-2 ${
                  app.id === selectedNav 
                    ? "bg-primary/10 border-2 border-primary" 
                    : "border-2 border-transparent"
                } ${!app.available ? "opacity-50 cursor-not-allowed" : ""}`}
                data-testid={`button-nav-${app.id}`}
              >
                <div className="text-left">
                  <p className="font-medium">{app.name}</p>
                  <p className="text-sm text-muted-foreground">{app.description}</p>
                </div>
                {app.id === selectedNav && (
                  <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <Check className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Map Style Selection (only shown for SafeGo default map) */}
        {selectedNav === "safego" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Map className="h-5 w-5" />
                Map Display Style
              </CardTitle>
              <CardDescription>Choose your preferred map appearance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {mapStyles.map((style) => (
                <button
                  key={style.id}
                  onClick={() => handleStyleChange(style.id)}
                  className={`flex items-center justify-between w-full p-4 rounded-lg hover-elevate active-elevate-2 ${
                    style.id === selectedStyle 
                      ? "bg-primary/10 border-2 border-primary" 
                      : "border-2 border-transparent"
                  }`}
                  data-testid={`button-style-${style.id}`}
                >
                  <div className="text-left">
                    <p className="font-medium">{style.name}</p>
                    <p className="text-sm text-muted-foreground">{style.description}</p>
                  </div>
                  {style.id === selectedStyle && (
                    <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                      <Check className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                </button>
              ))}
            </CardContent>
          </Card>
        )}

        {selectedNav !== "safego" && (
          <div className="bg-muted/50 p-4 rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong>Note:</strong> When you tap navigation during a trip, the selected app will open automatically. 
              Make sure you have {navigationApps.find(n => n.id === selectedNav)?.name} installed on your device.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
