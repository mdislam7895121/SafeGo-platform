import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  ArrowLeft, 
  Bell, 
  MessageSquare, 
  Smartphone,
  Mail,
  Route,
  DollarSign,
  Shield,
  Globe,
  ChevronRight,
  Check,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const PAYOUT_DAYS = [
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
];

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "bn", label: "বাংলা (Bengali)" },
  { value: "es", label: "Español (Spanish)" },
  { value: "fr", label: "Français (French)" },
  { value: "ar", label: "العربية (Arabic)" },
];

const REGIONS = [
  { value: "auto", label: "Auto-detect" },
  { value: "us", label: "United States" },
  { value: "bd", label: "Bangladesh" },
  { value: "in", label: "India" },
  { value: "pk", label: "Pakistan" },
  { value: "gb", label: "United Kingdom" },
];

export default function DriverSettings() {
  const { toast } = useToast();

  const { data: preferences, isLoading } = useQuery({
    queryKey: ["/api/driver/preferences"],
  });

  const updateNotificationsMutation = useMutation({
    mutationFn: async (data: Record<string, boolean>) => {
      const result = await apiRequest("/api/driver/preferences/notifications", {
        method: "PATCH",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/preferences"] });
      toast({ title: "Notification preferences updated" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const updateTripMutation = useMutation({
    mutationFn: async (data: Record<string, boolean>) => {
      const result = await apiRequest("/api/driver/preferences/trip", {
        method: "PATCH",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/preferences"] });
      toast({ title: "Trip preferences updated" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const updateEarningsMutation = useMutation({
    mutationFn: async (data: Record<string, string | boolean>) => {
      const result = await apiRequest("/api/driver/preferences/earnings", {
        method: "PATCH",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/preferences"] });
      toast({ title: "Earnings preferences updated" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const updateSafetyMutation = useMutation({
    mutationFn: async (data: Record<string, boolean>) => {
      const result = await apiRequest("/api/driver/preferences/safety", {
        method: "PATCH",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/preferences"] });
      toast({ title: "Safety preferences updated" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const updateLanguageMutation = useMutation({
    mutationFn: async (preferredLanguage: string) => {
      const result = await apiRequest("/api/driver/preferences/language", {
        method: "PATCH",
        body: JSON.stringify({ preferredLanguage }),
        headers: { "Content-Type": "application/json" },
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/preferences"] });
      toast({ title: "Language preference updated" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const updateRegionMutation = useMutation({
    mutationFn: async (regionPreference: string) => {
      const result = await apiRequest("/api/driver/preferences/region", {
        method: "PATCH",
        body: JSON.stringify({ regionPreference }),
        headers: { "Content-Type": "application/json" },
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/preferences"] });
      toast({ title: "Region preference updated" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const isPending = 
    updateNotificationsMutation.isPending ||
    updateTripMutation.isPending ||
    updateEarningsMutation.isPending ||
    updateSafetyMutation.isPending ||
    updateLanguageMutation.isPending ||
    updateRegionMutation.isPending;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="bg-primary text-primary-foreground p-6 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-8 w-48" />
          </div>
        </div>
        <div className="p-6 max-w-2xl mx-auto space-y-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
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
          <div className="flex-1">
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Settings</h1>
            <p className="text-sm opacity-90 mt-1">Manage your preferences</p>
          </div>
          {isPending && (
            <Loader2 className="h-5 w-5 animate-spin" />
          )}
        </div>
      </div>

      <div className="p-4 md:p-6 max-w-2xl mx-auto">
        <Tabs defaultValue="notifications" className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-6" data-testid="tabs-settings">
            <TabsTrigger value="notifications" className="flex flex-col items-center gap-1 py-2" data-testid="tab-notifications">
              <Bell className="h-4 w-4" />
              <span className="text-xs hidden sm:inline">Notifications</span>
            </TabsTrigger>
            <TabsTrigger value="trip" className="flex flex-col items-center gap-1 py-2" data-testid="tab-trip">
              <Route className="h-4 w-4" />
              <span className="text-xs hidden sm:inline">Trip</span>
            </TabsTrigger>
            <TabsTrigger value="earnings" className="flex flex-col items-center gap-1 py-2" data-testid="tab-earnings">
              <DollarSign className="h-4 w-4" />
              <span className="text-xs hidden sm:inline">Earnings</span>
            </TabsTrigger>
            <TabsTrigger value="safety" className="flex flex-col items-center gap-1 py-2" data-testid="tab-safety">
              <Shield className="h-4 w-4" />
              <span className="text-xs hidden sm:inline">Safety</span>
            </TabsTrigger>
            <TabsTrigger value="language" className="flex flex-col items-center gap-1 py-2" data-testid="tab-language">
              <Globe className="h-4 w-4" />
              <span className="text-xs hidden sm:inline">Language</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="notifications" className="space-y-4 mt-0">
            <Card data-testid="card-push-notifications">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Smartphone className="h-5 w-5" />
                  Push Notifications
                </CardTitle>
                <CardDescription>Notifications sent to your device</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <Label htmlFor="push-enabled">Push Notifications</Label>
                    <p className="text-sm text-muted-foreground">Enable all push notifications</p>
                  </div>
                  <Switch
                    id="push-enabled"
                    checked={preferences?.notifyPush ?? true}
                    onCheckedChange={(checked) => updateNotificationsMutation.mutate({ notifyPush: checked })}
                    disabled={isPending}
                    data-testid="switch-push-enabled"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <Label htmlFor="ride-requests">Ride Requests</Label>
                    <p className="text-sm text-muted-foreground">New ride requests nearby</p>
                  </div>
                  <Switch
                    id="ride-requests"
                    checked={preferences?.notifyRideRequests ?? true}
                    onCheckedChange={(checked) => updateNotificationsMutation.mutate({ notifyRideRequests: checked })}
                    disabled={isPending || !preferences?.notifyPush}
                    data-testid="switch-ride-requests"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <Label htmlFor="promotions">Promotions & Offers</Label>
                    <p className="text-sm text-muted-foreground">Special bonuses and surge alerts</p>
                  </div>
                  <Switch
                    id="promotions"
                    checked={preferences?.notifyPromotions ?? true}
                    onCheckedChange={(checked) => updateNotificationsMutation.mutate({ notifyPromotions: checked })}
                    disabled={isPending || !preferences?.notifyPush}
                    data-testid="switch-promotions"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <Label htmlFor="earnings">Earnings Updates</Label>
                    <p className="text-sm text-muted-foreground">Daily and weekly earnings summaries</p>
                  </div>
                  <Switch
                    id="earnings"
                    checked={preferences?.notifyEarnings ?? true}
                    onCheckedChange={(checked) => updateNotificationsMutation.mutate({ notifyEarnings: checked })}
                    disabled={isPending || !preferences?.notifyPush}
                    data-testid="switch-earnings"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <Label htmlFor="support">Support Messages</Label>
                    <p className="text-sm text-muted-foreground">Updates from SafeGo support</p>
                  </div>
                  <Switch
                    id="support"
                    checked={preferences?.notifySupport ?? true}
                    onCheckedChange={(checked) => updateNotificationsMutation.mutate({ notifySupport: checked })}
                    disabled={isPending || !preferences?.notifyPush}
                    data-testid="switch-support"
                  />
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-sms-notifications">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  SMS Notifications
                </CardTitle>
                <CardDescription>Text messages sent to your phone</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <Label htmlFor="sms-enabled">SMS Notifications</Label>
                    <p className="text-sm text-muted-foreground">Receive important updates via text</p>
                  </div>
                  <Switch
                    id="sms-enabled"
                    checked={preferences?.notifySms ?? true}
                    onCheckedChange={(checked) => updateNotificationsMutation.mutate({ notifySms: checked })}
                    disabled={isPending}
                    data-testid="switch-sms-enabled"
                  />
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-email-notifications">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Email Notifications
                </CardTitle>
                <CardDescription>Updates sent to your email</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <Label htmlFor="email-weekly">Weekly Summary</Label>
                    <p className="text-sm text-muted-foreground">Weekly earnings and trip reports</p>
                  </div>
                  <Switch
                    id="email-weekly"
                    checked={preferences?.notifyEmailWeekly ?? true}
                    onCheckedChange={(checked) => updateNotificationsMutation.mutate({ notifyEmailWeekly: checked })}
                    disabled={isPending}
                    data-testid="switch-email-weekly"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <Label htmlFor="email-tips">Tips & Best Practices</Label>
                    <p className="text-sm text-muted-foreground">Helpful tips to earn more</p>
                  </div>
                  <Switch
                    id="email-tips"
                    checked={preferences?.notifyEmailTips ?? false}
                    onCheckedChange={(checked) => updateNotificationsMutation.mutate({ notifyEmailTips: checked })}
                    disabled={isPending}
                    data-testid="switch-email-tips"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trip" className="space-y-4 mt-0">
            <Card data-testid="card-trip-preferences">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Route className="h-5 w-5" />
                  Trip Preferences
                </CardTitle>
                <CardDescription>Customize your trip preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <Label htmlFor="long-trips">Accept Long Trips</Label>
                    <p className="text-sm text-muted-foreground">Allow trips longer than 45 minutes</p>
                  </div>
                  <Switch
                    id="long-trips"
                    checked={preferences?.acceptLongTrips ?? true}
                    onCheckedChange={(checked) => updateTripMutation.mutate({ acceptLongTrips: checked })}
                    disabled={isPending}
                    data-testid="switch-long-trips"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <Label htmlFor="short-trips">Prefer Short Trips</Label>
                    <p className="text-sm text-muted-foreground">Prioritize trips under 15 minutes</p>
                  </div>
                  <Switch
                    id="short-trips"
                    checked={preferences?.preferShortTrips ?? false}
                    onCheckedChange={(checked) => updateTripMutation.mutate({ preferShortTrips: checked })}
                    disabled={isPending}
                    data-testid="switch-short-trips"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <Label htmlFor="avoid-highways">Avoid Highways</Label>
                    <p className="text-sm text-muted-foreground">Prefer surface streets for navigation</p>
                  </div>
                  <Switch
                    id="avoid-highways"
                    checked={preferences?.avoidHighways ?? false}
                    onCheckedChange={(checked) => updateTripMutation.mutate({ avoidHighways: checked })}
                    disabled={isPending}
                    data-testid="switch-avoid-highways"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <Link href="/driver/account/work-hub">
                  <div className="flex items-center justify-between hover-elevate p-2 -m-2 rounded-lg cursor-pointer" data-testid="link-work-hub">
                    <div>
                      <h3 className="font-medium">Work Hub Settings</h3>
                      <p className="text-sm text-muted-foreground">Auto-accept, shared rides, and more</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <Link href="/driver/account/navigation">
                  <div className="flex items-center justify-between hover-elevate p-2 -m-2 rounded-lg cursor-pointer" data-testid="link-navigation">
                    <div>
                      <h3 className="font-medium">Navigation Settings</h3>
                      <p className="text-sm text-muted-foreground">Preferred navigation app and map style</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </Link>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="earnings" className="space-y-4 mt-0">
            <Card data-testid="card-payout-preferences">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Payout Preferences
                </CardTitle>
                <CardDescription>Configure how you receive your earnings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="payout-day">Weekly Payout Day</Label>
                  <p className="text-sm text-muted-foreground mb-2">Choose which day to receive your weekly payout</p>
                  <Select
                    value={preferences?.weeklyPayoutDay || "friday"}
                    onValueChange={(value) => updateEarningsMutation.mutate({ weeklyPayoutDay: value })}
                    disabled={isPending}
                  >
                    <SelectTrigger id="payout-day" className="w-full" data-testid="select-payout-day">
                      <SelectValue placeholder="Select payout day" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYOUT_DAYS.map((day) => (
                        <SelectItem key={day.value} value={day.value} data-testid={`option-${day.value}`}>
                          <div className="flex items-center gap-2">
                            {preferences?.weeklyPayoutDay === day.value && <Check className="h-4 w-4" />}
                            {day.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <Label htmlFor="instant-payout">Instant Payout</Label>
                    <p className="text-sm text-muted-foreground">Enable instant payouts (fees may apply)</p>
                  </div>
                  <Switch
                    id="instant-payout"
                    checked={preferences?.instantPayoutEnabled ?? false}
                    onCheckedChange={(checked) => updateEarningsMutation.mutate({ instantPayoutEnabled: checked })}
                    disabled={isPending}
                    data-testid="switch-instant-payout"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <Link href="/driver/account/payout-methods">
                  <div className="flex items-center justify-between hover-elevate p-2 -m-2 rounded-lg cursor-pointer" data-testid="link-payout-methods">
                    <div>
                      <h3 className="font-medium">Payout Methods</h3>
                      <p className="text-sm text-muted-foreground">Manage your bank accounts and cards</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <Link href="/driver/account/tax-info">
                  <div className="flex items-center justify-between hover-elevate p-2 -m-2 rounded-lg cursor-pointer" data-testid="link-tax-info">
                    <div>
                      <h3 className="font-medium">Tax Information</h3>
                      <p className="text-sm text-muted-foreground">Tax documents and W-9 status</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </Link>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="safety" className="space-y-4 mt-0">
            <Card data-testid="card-safety-preferences">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Safety Preferences
                </CardTitle>
                <CardDescription>Configure your safety settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <Label htmlFor="share-trip">Share Trip Status</Label>
                    <p className="text-sm text-muted-foreground">Allow emergency contacts to track your trips</p>
                  </div>
                  <Switch
                    id="share-trip"
                    checked={preferences?.shareTripStatus ?? true}
                    onCheckedChange={(checked) => updateSafetyMutation.mutate({ shareTripStatus: checked })}
                    disabled={isPending}
                    data-testid="switch-share-trip"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <Label htmlFor="emergency-shortcut">Emergency Shortcut</Label>
                    <p className="text-sm text-muted-foreground">Quick access to emergency services</p>
                  </div>
                  <Switch
                    id="emergency-shortcut"
                    checked={preferences?.emergencyShortcutEnabled ?? true}
                    onCheckedChange={(checked) => updateSafetyMutation.mutate({ emergencyShortcutEnabled: checked })}
                    disabled={isPending}
                    data-testid="switch-emergency-shortcut"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <Link href="/driver/account/privacy">
                  <div className="flex items-center justify-between hover-elevate p-2 -m-2 rounded-lg cursor-pointer" data-testid="link-privacy">
                    <div>
                      <h3 className="font-medium">Privacy & Data</h3>
                      <p className="text-sm text-muted-foreground">Location history and data sharing</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <Link href="/driver/account/manage">
                  <div className="flex items-center justify-between hover-elevate p-2 -m-2 rounded-lg cursor-pointer" data-testid="link-emergency-contacts">
                    <div>
                      <h3 className="font-medium">Emergency Contacts</h3>
                      <p className="text-sm text-muted-foreground">Manage your emergency contacts</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </Link>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="language" className="space-y-4 mt-0">
            <Card data-testid="card-language-preferences">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Language & Region
                </CardTitle>
                <CardDescription>Set your preferred language and region</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="language">Language</Label>
                  <p className="text-sm text-muted-foreground mb-2">Choose your preferred language</p>
                  <Select
                    value={preferences?.preferredLanguage || "en"}
                    onValueChange={(value) => updateLanguageMutation.mutate(value)}
                    disabled={isPending}
                  >
                    <SelectTrigger id="language" className="w-full" data-testid="select-language">
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map((lang) => (
                        <SelectItem key={lang.value} value={lang.value} data-testid={`option-${lang.value}`}>
                          <div className="flex items-center gap-2">
                            {preferences?.preferredLanguage === lang.value && <Check className="h-4 w-4" />}
                            {lang.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="region">Region</Label>
                  <p className="text-sm text-muted-foreground mb-2">Set your region for localized content</p>
                  <Select
                    value={preferences?.regionPreference || "auto"}
                    onValueChange={(value) => updateRegionMutation.mutate(value)}
                    disabled={isPending}
                  >
                    <SelectTrigger id="region" className="w-full" data-testid="select-region">
                      <SelectValue placeholder="Select region" />
                    </SelectTrigger>
                    <SelectContent>
                      {REGIONS.map((region) => (
                        <SelectItem key={region.value} value={region.value} data-testid={`option-${region.value}`}>
                          <div className="flex items-center gap-2">
                            {preferences?.regionPreference === region.value && <Check className="h-4 w-4" />}
                            {region.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <Link href="/driver/account/dark-mode">
                  <div className="flex items-center justify-between hover-elevate p-2 -m-2 rounded-lg cursor-pointer" data-testid="link-appearance">
                    <div>
                      <h3 className="font-medium">Appearance</h3>
                      <p className="text-sm text-muted-foreground">Dark mode and theme settings</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </Link>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
