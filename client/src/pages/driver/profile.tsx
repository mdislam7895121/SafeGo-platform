import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User } from "lucide-react";

export default function DriverProfile() {
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-6 w-6" />
            Driver Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <User className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-xl font-semibold mb-2">Driver Profile UI Under Reconstruction</h3>
            <p className="text-muted-foreground">
              The new Uber-style driver profile experience is being built.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
