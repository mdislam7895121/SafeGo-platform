import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, Car } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function DriverVehicle() {
  const { toast } = useToast();
  const [vehicleType, setVehicleType] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");

  const { data: driverData } = useQuery({
    queryKey: ["/api/driver/home"],
  });

  const vehicle = (driverData as any)?.vehicle;

  const registerVehicleMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/driver/vehicle", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/home"] });
      toast({
        title: "Vehicle registered!",
        description: "You can now go online and accept rides",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateVehicleMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", "/api/driver/vehicle", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/home"] });
      toast({
        title: "Vehicle updated!",
        description: "Your vehicle information has been saved",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const data = {
      vehicleType,
      vehicleModel,
      vehiclePlate,
    };

    if (vehicle) {
      updateVehicleMutation.mutate(data);
    } else {
      registerVehicleMutation.mutate(data);
    }
  };

  return (
    <div className="bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-6 ">
        <div className="flex items-center gap-4">
          <Link href="/driver">
            <Button variant="ghost" size="icon" className="text-primary-foreground" data-testid="button-back">
              <ArrowLeft className="h-6 w-6" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">{vehicle ? "Edit Vehicle" : "Register Vehicle"}</h1>
        </div>
      </div>

      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Car className="h-5 w-5" />
              Vehicle Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="vehicleType">Vehicle Type</Label>
                <Select
                  value={vehicleType || vehicle?.vehicleType}
                  onValueChange={setVehicleType}
                  required
                >
                  <SelectTrigger id="vehicleType" data-testid="select-vehicle-type">
                    <SelectValue placeholder={vehicle?.vehicleType || "Select type"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bike">Bike</SelectItem>
                    <SelectItem value="sedan">Sedan</SelectItem>
                    <SelectItem value="suv">SUV</SelectItem>
                    <SelectItem value="van">Van</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="vehicleModel">Vehicle Model</Label>
                <Input
                  id="vehicleModel"
                  placeholder="Toyota Corolla 2020"
                  defaultValue={vehicle?.vehicleModel}
                  onChange={(e) => setVehicleModel(e.target.value)}
                  required
                  data-testid="input-vehicle-model"
                />
              </div>

              <div>
                <Label htmlFor="vehiclePlate">License Plate</Label>
                <Input
                  id="vehiclePlate"
                  placeholder="DHK-1234"
                  defaultValue={vehicle?.vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value)}
                  required
                  data-testid="input-vehicle-plate"
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={registerVehicleMutation.isPending || updateVehicleMutation.isPending}
                data-testid="button-submit"
              >
                {registerVehicleMutation.isPending || updateVehicleMutation.isPending
                  ? "Saving..."
                  : vehicle
                  ? "Update Vehicle"
                  : "Register Vehicle"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
