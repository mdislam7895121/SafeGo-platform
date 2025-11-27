import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Settings,
  Globe,
  Bell,
  MapPin,
  Moon,
  Shield,
  Lock,
  ChevronRight,
  Check,
  Smartphone,
  Volume2,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface PreferencesData {
  language: string;
  notifications: {
    push: boolean;
    email: boolean;
    sms: boolean;
    promotions: boolean;
  };
  mapProvider: string;
  darkMode: boolean;
  soundEffects: boolean;
}

const languages = [
  { value: "en", label: "English" },
  { value: "bn", label: "Bengali" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
];

const mapProviders = [
  { value: "safego", label: "SafeGo Maps" },
  { value: "google", label: "Google Maps" },
  { value: "apple", label: "Apple Maps" },
  { value: "waze", label: "Waze" },
];

export default function RiderSettings() {
  const { data: preferencesData, isLoading } = useQuery<PreferencesData>({
    queryKey: ["/api/customer/preferences"],
  });

  const updatePreferenceMutation = useMutation({
    mutationFn: async (data: Partial<PreferencesData>) => {
      return apiRequest("/api/customer/preferences", {
        method: "PATCH",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer/preferences"] });
    },
  });

  const preferences = preferencesData || {
    language: "en",
    notifications: {
      push: true,
      email: true,
      sms: false,
      promotions: true,
    },
    mapProvider: "safego",
    darkMode: false,
    soundEffects: true,
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-settings-title">
          Settings
        </h1>
        <p className="text-muted-foreground">
          Customize your SafeGo experience
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Language & Region
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="language">App Language</Label>
            <Select
              value={preferences.language}
              onValueChange={(value) => updatePreferenceMutation.mutate({ language: value })}
            >
              <SelectTrigger className="w-40" id="language" data-testid="select-language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {languages.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </CardTitle>
          <CardDescription>
            Choose how you want to be notified
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Smartphone className="h-5 w-5 text-muted-foreground" />
              <div>
                <Label>Push Notifications</Label>
                <p className="text-xs text-muted-foreground">Trip updates and alerts</p>
              </div>
            </div>
            <Switch
              checked={preferences.notifications.push}
              onCheckedChange={(checked) =>
                updatePreferenceMutation.mutate({
                  notifications: { ...preferences.notifications, push: checked },
                })
              }
              data-testid="switch-push-notifications"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Email Notifications</Label>
              <p className="text-xs text-muted-foreground">Receipts and summaries</p>
            </div>
            <Switch
              checked={preferences.notifications.email}
              onCheckedChange={(checked) =>
                updatePreferenceMutation.mutate({
                  notifications: { ...preferences.notifications, email: checked },
                })
              }
              data-testid="switch-email-notifications"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>SMS Notifications</Label>
              <p className="text-xs text-muted-foreground">Critical updates only</p>
            </div>
            <Switch
              checked={preferences.notifications.sms}
              onCheckedChange={(checked) =>
                updatePreferenceMutation.mutate({
                  notifications: { ...preferences.notifications, sms: checked },
                })
              }
              data-testid="switch-sms-notifications"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Promotions & Offers</Label>
              <p className="text-xs text-muted-foreground">Discounts and special deals</p>
            </div>
            <Switch
              checked={preferences.notifications.promotions}
              onCheckedChange={(checked) =>
                updatePreferenceMutation.mutate({
                  notifications: { ...preferences.notifications, promotions: checked },
                })
              }
              data-testid="switch-promo-notifications"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Navigation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="map-provider">Default Map App</Label>
            <Select
              value={preferences.mapProvider}
              onValueChange={(value) => updatePreferenceMutation.mutate({ mapProvider: value })}
            >
              <SelectTrigger className="w-40" id="map-provider" data-testid="select-map-provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {mapProviders.map((provider) => (
                  <SelectItem key={provider.value} value={provider.value}>
                    {provider.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Appearance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Moon className="h-5 w-5 text-muted-foreground" />
              <div>
                <Label>Dark Mode</Label>
                <p className="text-xs text-muted-foreground">Use dark theme</p>
              </div>
            </div>
            <Switch
              checked={preferences.darkMode}
              onCheckedChange={(checked) =>
                updatePreferenceMutation.mutate({ darkMode: checked })
              }
              data-testid="switch-dark-mode"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Volume2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <Label>Sound Effects</Label>
                <p className="text-xs text-muted-foreground">Notification sounds</p>
              </div>
            </div>
            <Switch
              checked={preferences.soundEffects}
              onCheckedChange={(checked) =>
                updatePreferenceMutation.mutate({ soundEffects: checked })
              }
              data-testid="switch-sound-effects"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Privacy & Security
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            <Link href="/rider/settings/privacy">
              <button className="w-full flex items-center justify-between p-4 hover-elevate text-left" data-testid="link-privacy-settings">
                <div className="flex items-center gap-3">
                  <Lock className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">Privacy Settings</span>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </button>
            </Link>
            <Link href="/rider/settings/security">
              <button className="w-full flex items-center justify-between p-4 hover-elevate text-left" data-testid="link-security-settings">
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">Security Settings</span>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <div className="text-center text-sm text-muted-foreground">
        <p>SafeGo v2.0.0</p>
        <div className="flex justify-center gap-4 mt-2">
          <Link href="/terms">
            <Button variant="ghost" size="sm" className="p-0 h-auto text-primary" data-testid="link-terms-of-service">
              Terms of Service
            </Button>
          </Link>
          <Link href="/privacy">
            <Button variant="ghost" size="sm" className="p-0 h-auto text-primary" data-testid="link-privacy-policy">
              Privacy Policy
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
