import { Link } from "wouter";
import { ArrowLeft, Clock, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

export default function WorkHub() {
  const { toast } = useToast();

  const { data: preferences } = useQuery({
    queryKey: ["/api/driver/preferences"],
  });

  const updateWorkPrefsMutation = useMutation({
    mutationFn: async (data: any) => {
      const result = await apiRequest("/api/driver/preferences/work", {
        method: "PATCH",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/preferences"] });
      toast({ title: "Work preferences updated successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update work preferences",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleToggle = (field: string, value: boolean) => {
    updateWorkPrefsMutation.mutate({ [field]: value });
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
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Work Hub</h1>
        </div>
      </div>

      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Work Preferences</CardTitle>
            <CardDescription>Customize your driving experience</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label htmlFor="accept-rides">Auto-accept rides</Label>
                <p className="text-sm text-muted-foreground">Automatically accept incoming requests</p>
              </div>
              <Switch 
                id="accept-rides" 
                checked={preferences?.autoAcceptRides || false}
                onCheckedChange={(checked) => handleToggle("autoAcceptRides", checked)}
                disabled={updateWorkPrefsMutation.isPending}
                data-testid="switch-auto-accept" 
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label htmlFor="long-trips">Accept long trips</Label>
                <p className="text-sm text-muted-foreground">Rides over 30 minutes</p>
              </div>
              <Switch 
                id="long-trips" 
                checked={preferences?.acceptLongTrips || false}
                onCheckedChange={(checked) => handleToggle("acceptLongTrips", checked)}
                disabled={updateWorkPrefsMutation.isPending}
                data-testid="switch-long-trips" 
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label htmlFor="shared-rides">Accept shared rides</Label>
                <p className="text-sm text-muted-foreground">Multiple passengers in one trip</p>
              </div>
              <Switch 
                id="shared-rides" 
                checked={preferences?.acceptSharedRides || false}
                onCheckedChange={(checked) => handleToggle("acceptSharedRides", checked)}
                disabled={updateWorkPrefsMutation.isPending}
                data-testid="switch-shared-rides" 
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Weekly Summary</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Clock className="h-4 w-4" />
                <span className="text-sm">Hours Online</span>
              </div>
              <p className="text-2xl font-bold">32.5</p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Calendar className="h-4 w-4" />
                <span className="text-sm">Trips Completed</span>
              </div>
              <p className="text-2xl font-bold">78</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
