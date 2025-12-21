import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Gauge, Home, Construction } from "lucide-react";

export default function AdminOperations() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Gauge className="h-6 w-6" />
            Operations Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Real-time monitoring of rides, orders, parcels, and drivers
          </p>
        </div>
        <Link href="/admin">
          <Button variant="outline" className="gap-2">
            <Home className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>
      </div>

      <Card className="border-dashed">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
            <Construction className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          </div>
          <CardTitle>Coming Soon</CardTitle>
          <CardDescription className="max-w-md mx-auto">
            The Operations Dashboard is currently under development. This feature will provide 
            real-time monitoring of all platform operations including rides, orders, parcels, and driver activities.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Link href="/admin/operations-center">
            <Button variant="default" className="gap-2">
              <Gauge className="h-4 w-4" />
              Try Operations Center
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
