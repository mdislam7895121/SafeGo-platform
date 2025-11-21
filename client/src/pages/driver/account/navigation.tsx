import { Link } from "wouter";
import { ArrowLeft, Navigation, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const navApps = [
  { id: "google", name: "Google Maps" },
  { id: "waze", name: "Waze" },
  { id: "apple", name: "Apple Maps" },
  { id: "builtin", name: "Built-in Navigation" },
];

export default function NavigationSettings() {
  const currentApp = "google";

  return (
    <div className="bg-background">
      <div className="bg-primary text-primary-foreground p-6 ">
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
            <CardTitle>Navigation App</CardTitle>
            <CardDescription>Choose your preferred navigation app</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {navApps.map((app) => (
              <button
                key={app.id}
                className={`flex items-center gap-4 w-full p-4 rounded-lg hover-elevate active-elevate-2 ${
                  app.id === currentApp ? "bg-primary/10 border-2 border-primary" : "border-2 border-transparent"
                }`}
                data-testid={`button-nav-${app.id}`}
              >
                <Navigation className="h-6 w-6 text-muted-foreground" />
                <p className="font-medium flex-1 text-left">{app.name}</p>
                {app.id === currentApp && (
                  <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <Check className="h-4 w-4 text-primary-foreground" />
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
