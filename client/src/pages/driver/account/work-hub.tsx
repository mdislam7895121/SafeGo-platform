import { Link } from "wouter";
import { ArrowLeft, Clock, Calendar, TrendingUp, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function WorkHub() {
  return (
    <div className="min-h-screen bg-background">
      <div className="bg-primary text-primary-foreground p-6 sticky top-0 z-10">
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
              <Switch id="accept-rides" data-testid="switch-auto-accept" />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label htmlFor="long-trips">Accept long trips</Label>
                <p className="text-sm text-muted-foreground">Rides over 30 minutes</p>
              </div>
              <Switch id="long-trips" data-testid="switch-long-trips" />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label htmlFor="shared-rides">Accept shared rides</Label>
                <p className="text-sm text-muted-foreground">Multiple passengers in one trip</p>
              </div>
              <Switch id="shared-rides" data-testid="switch-shared-rides" />
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
