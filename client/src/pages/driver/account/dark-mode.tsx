import { Link } from "wouter";
import { ArrowLeft, Moon, Sun, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

const themes = [
  { id: "light", name: "Light", description: "Light theme", icon: Sun },
  { id: "dark", name: "Dark", description: "Dark theme", icon: Moon },
  { id: "system", name: "System", description: "Match system settings", icon: Monitor },
];

export default function DarkModeSettings() {
  const { toast } = useToast();

  const { data: preferences } = useQuery({
    queryKey: ["/api/driver/preferences"],
  });

  const currentTheme = preferences?.themePreference || "system";

  const updateThemeMutation = useMutation({
    mutationFn: async (themePreference: string) => {
      const result = await apiRequest("/api/driver/preferences/theme", {
        method: "PATCH",
        body: JSON.stringify({ themePreference }),
        headers: { "Content-Type": "application/json" },
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/preferences"] });
      toast({ title: "Theme preference updated successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update theme preference",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleSelectTheme = (themeId: string) => {
    if (themeId !== currentTheme) {
      updateThemeMutation.mutate(themeId);
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
                onClick={() => handleSelectTheme(theme.id)}
                disabled={updateThemeMutation.isPending}
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
