import { Link } from "wouter";
import { ArrowLeft, Moon, Sun, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const themes = [
  { id: "light", name: "Light", description: "Light theme", icon: Sun },
  { id: "dark", name: "Dark", description: "Dark theme", icon: Moon },
  { id: "system", name: "System", description: "Match system settings", icon: Monitor },
];

export default function DarkModeSettings() {
  const currentTheme = "system";

  return (
    <div className="bg-background">
      <div className="bg-primary text-primary-foreground p-6 ">
        <div className="flex items-center gap-4">
          <Link href="/driver/account">
            <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10" data-testid="button-back">
              <ArrowLeft className="h-6 w-6" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Dark Mode</h1>
        </div>
      </div>

      <div className="p-6 max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Theme Preference</CardTitle>
            <CardDescription>Choose how the app looks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {themes.map((theme) => (
              <button
                key={theme.id}
                className={`flex items-center gap-4 w-full p-4 rounded-lg hover-elevate active-elevate-2 ${
                  theme.id === currentTheme ? "bg-primary/10 border-2 border-primary" : "border-2 border-transparent"
                }`}
                data-testid={`button-theme-${theme.id}`}
              >
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <theme.icon className="h-6 w-6" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium">{theme.name}</p>
                  <p className="text-sm text-muted-foreground">{theme.description}</p>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
