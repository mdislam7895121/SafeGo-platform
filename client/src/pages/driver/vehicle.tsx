import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Car } from "lucide-react";

export default function DriverVehicle() {
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Car className="h-6 w-6" />
            Vehicle Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <Car className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-xl font-semibold mb-2">Vehicle Management UI Under Reconstruction</h3>
            <p className="text-muted-foreground">
              The new vehicle management experience is being built.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
