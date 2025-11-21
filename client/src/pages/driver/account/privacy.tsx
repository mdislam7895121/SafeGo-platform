import { Link } from "wouter";
import { ArrowLeft, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function PrivacySettings() {
  return (
    <div className="min-h-screen bg-background">
      <div className="bg-primary text-primary-foreground p-6 sticky top-0 z-10">
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
              <Switch id="location-sharing" defaultChecked data-testid="switch-location" />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label htmlFor="analytics">Usage Analytics</Label>
                <p className="text-sm text-muted-foreground">Share app usage data</p>
              </div>
              <Switch id="analytics" data-testid="switch-analytics" />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label htmlFor="personalized">Personalized Experience</Label>
                <p className="text-sm text-muted-foreground">Use data to improve your experience</p>
              </div>
              <Switch id="personalized" defaultChecked data-testid="switch-personalized" />
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
