import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft, Smile } from "lucide-react";

export default function DriverProfileCompliments() {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link href="/driver/profile/public">
        <Button variant="ghost" size="sm" className="mb-4" data-testid="button-back">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Public Profile
        </Button>
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smile className="h-5 w-5" />
            All Compliments
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="text-center py-12">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Smile className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Detailed Compliments View</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              This page will show all compliments you have received from riders over time. Coming soon.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
