import { useState } from "react";
import { Link, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Package,
  Clock,
  Calendar,
  Search,
  Plus,
  ChevronRight,
  MapPin,
  Truck,
  Box,
} from "lucide-react";

interface Parcel {
  id: string;
  status: string;
  pickupAddress: string;
  dropoffAddress: string;
  recipientName: string;
  recipientPhone: string;
  packageSize: string;
  price: number;
  trackingCode?: string;
  estimatedDelivery?: string;
  courierName?: string;
  createdAt: string;
  deliveredAt?: string;
}

function ParcelCard({ parcel }: { parcel: Parcel }) {
  const statusColors: Record<string, string> = {
    created: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400",
    picked_up: "bg-blue-500/20 text-blue-700 dark:text-blue-400",
    in_transit: "bg-purple-500/20 text-purple-700 dark:text-purple-400",
    delivered: "bg-muted text-muted-foreground",
    canceled: "bg-red-500/20 text-red-700 dark:text-red-400",
  };

  return (
    <Card className="hover-elevate" data-testid={`parcel-card-${parcel.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <Package className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="font-medium">{parcel.recipientName}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(parcel.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <Badge className={statusColors[parcel.status] || "bg-muted"}>
            {parcel.status.replace(/_/g, ' ')}
          </Badge>
        </div>

        <div className="flex items-start gap-3 mb-3">
          <div className="mt-1.5">
            <div className="h-2 w-2 rounded-full bg-blue-500" />
            <div className="w-px h-4 bg-border mx-auto" />
            <div className="h-2 w-2 rounded-full bg-green-500" />
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <p className="text-sm truncate">{parcel.pickupAddress}</p>
            <p className="text-sm text-muted-foreground truncate">{parcel.dropoffAddress}</p>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4 text-muted-foreground">
            <span className="font-medium text-foreground">${parcel.price.toFixed(2)}</span>
            <Badge variant="outline">{parcel.packageSize}</Badge>
          </div>
          <Link href={`/rider/parcels/${parcel.id}`}>
            <Button variant="ghost" size="sm" data-testid={`button-track-parcel-${parcel.id}`}>
              Track
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>

        {parcel.trackingCode && (
          <div className="mt-3 pt-3 border-t flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Tracking:</span>
            <code className="bg-muted px-2 py-1 rounded text-xs">
              {parcel.trackingCode}
            </code>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function RiderParcels() {
  const searchParams = useSearch();
  const isNewParcel = searchParams.includes("start=new");
  const [activeTab, setActiveTab] = useState<string>(isNewParcel ? "new" : "active");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: parcelsData, isLoading } = useQuery<{
    active: Parcel[];
    past: Parcel[];
  }>({
    queryKey: ["/api/customer/parcels"],
  });

  const activeParcels = parcelsData?.active || [];
  const pastParcels = parcelsData?.past || [];

  const filteredPastParcels = pastParcels.filter((parcel) =>
    parcel.recipientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    parcel.trackingCode?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-parcels-title">
            Parcels
          </h1>
          <p className="text-muted-foreground">
            Send and track your packages
          </p>
        </div>
        <Link href="/rider/parcels?start=new">
          <Button data-testid="button-new-parcel">
            <Plus className="h-4 w-4 mr-2" />
            Send Parcel
          </Button>
        </Link>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="active" data-testid="tab-active-parcels">
            <Truck className="h-4 w-4 mr-2" />
            In Transit
            {activeParcels.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeParcels.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="past" data-testid="tab-past-parcels">
            <Calendar className="h-4 w-4 mr-2" />
            History
          </TabsTrigger>
          <TabsTrigger value="new" data-testid="tab-new-parcel">
            <Plus className="h-4 w-4 mr-2" />
            Send New
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-24 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : activeParcels.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Truck className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium mb-2">No parcels in transit</h3>
                <p className="text-muted-foreground mb-4">
                  Send a package to someone today
                </p>
                <Link href="/rider/parcels?start=new">
                  <Button data-testid="button-send-parcel-empty-state">
                    <Plus className="h-4 w-4 mr-2" />
                    Send a Parcel
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {activeParcels.map((parcel) => (
                <ParcelCard key={parcel.id} parcel={parcel} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="past" className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by recipient or tracking code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-parcels"
            />
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-24 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredPastParcels.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium mb-2">No delivery history</h3>
                <p className="text-muted-foreground">
                  Your past deliveries will appear here
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredPastParcels.map((parcel) => (
                <ParcelCard key={parcel.id} parcel={parcel} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="new" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Box className="h-5 w-5 text-green-500" />
                Send a Package
              </CardTitle>
              <CardDescription>
                Enter delivery details to get a quote
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pickup">Pickup Address</Label>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-blue-500" />
                    <Input
                      id="pickup"
                      placeholder="Enter pickup location"
                      data-testid="input-parcel-pickup"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dropoff">Delivery Address</Label>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-green-500" />
                    <Input
                      id="dropoff"
                      placeholder="Enter delivery location"
                      data-testid="input-parcel-dropoff"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="recipient">Recipient Name</Label>
                  <Input
                    id="recipient"
                    placeholder="Enter recipient's name"
                    data-testid="input-parcel-recipient"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Recipient Phone</Label>
                  <Input
                    id="phone"
                    placeholder="Enter phone number"
                    data-testid="input-parcel-phone"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Package Size</Label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "small", label: "Small", desc: "Fits in a bag" },
                    { id: "medium", label: "Medium", desc: "Up to 10kg" },
                    { id: "large", label: "Large", desc: "Up to 25kg" },
                  ].map((size) => (
                    <Button
                      key={size.id}
                      variant="outline"
                      className="h-auto py-3 flex flex-col items-center"
                      data-testid={`button-size-${size.id}`}
                    >
                      <span className="font-medium">{size.label}</span>
                      <span className="text-xs text-muted-foreground">{size.desc}</span>
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Delivery Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Any special instructions for the courier..."
                  data-testid="input-parcel-notes"
                />
              </div>

              <Button className="w-full" size="lg" data-testid="button-get-quote">
                <Package className="h-4 w-4 mr-2" />
                Get Quote
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
