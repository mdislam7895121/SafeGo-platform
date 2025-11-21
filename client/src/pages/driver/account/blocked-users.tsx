import { Link } from "wouter";
import { ArrowLeft, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function BlockedUsers() {
  return (
    <div className="min-h-screen bg-background">
      <div className="bg-primary text-primary-foreground p-6 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link href="/driver/account">
            <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10" data-testid="button-back">
              <ArrowLeft className="h-6 w-6" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Blocked Users</h1>
        </div>
      </div>

      <div className="p-6 max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Blocked Riders</CardTitle>
            <CardDescription>Riders you've blocked won't be matched with you</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <UserX className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-semibold mb-2">No Blocked Users</h3>
              <p className="text-sm text-muted-foreground">
                You haven't blocked any riders yet
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
