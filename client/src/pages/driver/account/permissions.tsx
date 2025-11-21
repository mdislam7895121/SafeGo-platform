import { Link } from "wouter";
import { ArrowLeft, Settings, MapPin, Camera, Mic, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const permissions = [
  { icon: MapPin, name: "Location", status: "granted", description: "Required for navigation and ride matching" },
  { icon: Camera, name: "Camera", status: "granted", description: "For document uploads and profile photos" },
  { icon: Mic, name: "Microphone", status: "denied", description: "For support calls" },
  { icon: Bell, name: "Notifications", status: "granted", description: "For ride requests and updates" },
];

export default function AppPermissions() {
  return (
    <div className="min-h-screen bg-background">
      <div className="bg-primary text-primary-foreground p-6 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link href="/driver/account">
            <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10" data-testid="button-back">
              <ArrowLeft className="h-6 w-6" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">App Permissions</h1>
        </div>
      </div>

      <div className="p-6 max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Permissions</CardTitle>
            <CardDescription>Manage what the app can access</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {permissions.map((permission, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <permission.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{permission.name}</p>
                    <p className="text-sm text-muted-foreground">{permission.description}</p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={permission.status === "granted" 
                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" 
                    : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                  }
                >
                  {permission.status === "granted" ? "Granted" : "Denied"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
