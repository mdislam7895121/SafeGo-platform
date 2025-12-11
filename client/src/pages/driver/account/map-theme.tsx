import { Link } from "wouter";
import { ArrowLeft, Map } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const mapThemes = [
  { id: "standard", name: "Standard", description: "Default map style" },
  { id: "satellite", name: "Satellite", description: "Aerial view" },
  { id: "terrain", name: "Terrain", description: "Topographic details" },
  { id: "dark", name: "Dark Mode", description: "Optimized for night driving" },
];

export default function MapThemeSettings() {
  const currentTheme = "standard";

  return (
    <div className="bg-background">
      <div className="bg-primary text-primary-foreground p-6 ">
        <div className="flex items-center gap-4">
          <Link href="/driver/account">
            <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10" data-testid="button-back">
              <ArrowLeft className="h-6 w-6" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Map Theme</h1>
        </div>
      </div>

      <div className="p-6 max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Map Display</CardTitle>
            <CardDescription>Choose your preferred map style</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {mapThemes.map((theme) => (
              <button
                key={theme.id}
                className={`flex items-center justify-between w-full p-4 rounded-lg hover-elevate active-elevate-2 ${
                  theme.id === currentTheme ? "bg-primary/10 border-2 border-primary" : "border-2 border-transparent"
                }`}
                data-testid={`button-map-${theme.id}`}
              >
                <div>
                  <p className="font-medium">{theme.name}</p>
                  <p className="text-sm text-muted-foreground">{theme.description}</p>
                </div>
                {theme.id === currentTheme && (
                  <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                    <Map className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
