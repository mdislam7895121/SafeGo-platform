import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function NotificationSettings() {
  return (
    <div className="bg-background">
      <div className="bg-primary text-primary-foreground p-6 ">
        <div className="flex items-center gap-4">
          <Link href="/driver/account">
            <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10" data-testid="button-back">
              <ArrowLeft className="h-6 w-6" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Notifications</h1>
        </div>
      </div>

      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Push Notifications</CardTitle>
            <CardDescription>Manage what notifications you receive</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label htmlFor="ride-requests">Ride Requests</Label>
                <p className="text-sm text-muted-foreground">New ride requests nearby</p>
              </div>
              <Switch id="ride-requests" defaultChecked data-testid="switch-ride-requests" />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label htmlFor="promotions">Promotions & Offers</Label>
                <p className="text-sm text-muted-foreground">Special bonuses and surge alerts</p>
              </div>
              <Switch id="promotions" defaultChecked data-testid="switch-promotions" />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label htmlFor="earnings">Earnings Updates</Label>
                <p className="text-sm text-muted-foreground">Daily and weekly earnings summaries</p>
              </div>
              <Switch id="earnings" defaultChecked data-testid="switch-earnings" />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label htmlFor="support">Support Messages</Label>
                <p className="text-sm text-muted-foreground">Updates from SafeGo support</p>
              </div>
              <Switch id="support" defaultChecked data-testid="switch-support" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Email Notifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label htmlFor="email-weekly">Weekly Summary</Label>
                <p className="text-sm text-muted-foreground">Weekly earnings and trip reports</p>
              </div>
              <Switch id="email-weekly" defaultChecked data-testid="switch-email-weekly" />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label htmlFor="email-tips">Tips & Best Practices</Label>
                <p className="text-sm text-muted-foreground">Helpful tips to earn more</p>
              </div>
              <Switch id="email-tips" data-testid="switch-email-tips" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
