import { Link } from "wouter";
import { ArrowLeft, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SmartNotificationPreferences } from "@/components/notifications/SmartNotificationPreferences";

export default function NotificationSettings() {
  return (
    <div className="min-h-screen bg-background pb-20">
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
          <div className="flex items-center gap-2">
            <Bell className="h-6 w-6" />
            <h1 className="text-xl font-bold" data-testid="text-page-title">Smart Notifications</h1>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-2xl mx-auto">
        <SmartNotificationPreferences userType="driver" />
      </div>
    </div>
  );
}
