import { Link } from "wouter";
import { ArrowLeft, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

export default function PrivacySettings() {
  const { toast } = useToast();

  const { data: preferences } = useQuery({
    queryKey: ["/api/driver/preferences"],
  });

  const updatePrivacyMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", "/api/driver/preferences/privacy", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/preferences"] });
      toast({ title: "Privacy preferences updated successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update privacy preferences",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleToggle = (field: string, value: boolean) => {
    updatePrivacyMutation.mutate({ [field]: value });
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
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Privacy</h1>
        </div>
      </div>

      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Data & Privacy</CardTitle>
            <CardDescription>Control how your data is used</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label htmlFor="location-sharing">Share Location History</Label>
                <p className="text-sm text-muted-foreground">Help improve route suggestions</p>
              </div>
              <Switch 
                id="location-sharing" 
                checked={preferences?.shareLocationHistory || false}
                onCheckedChange={(checked) => handleToggle("shareLocationHistory", checked)}
                disabled={updatePrivacyMutation.isPending}
                data-testid="switch-location" 
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label htmlFor="analytics">Usage Analytics</Label>
                <p className="text-sm text-muted-foreground">Share app usage data</p>
              </div>
              <Switch 
                id="analytics" 
                checked={preferences?.shareUsageAnalytics || false}
                onCheckedChange={(checked) => handleToggle("shareUsageAnalytics", checked)}
                disabled={updatePrivacyMutation.isPending}
                data-testid="switch-analytics" 
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label htmlFor="personalized">Personalized Experience</Label>
                <p className="text-sm text-muted-foreground">Use data to improve your experience</p>
              </div>
              <Switch 
                id="personalized" 
                checked={preferences?.personalizedExperience || false}
                onCheckedChange={(checked) => handleToggle("personalizedExperience", checked)}
                disabled={updatePrivacyMutation.isPending}
                data-testid="switch-personalized" 
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Data Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full justify-start" data-testid="button-download-data">
              <Shield className="h-4 w-4 mr-2" />
              Download My Data
            </Button>
            <Button variant="outline" className="w-full justify-start" data-testid="button-delete-history">
              <Shield className="h-4 w-4 mr-2" />
              Delete Trip History
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
