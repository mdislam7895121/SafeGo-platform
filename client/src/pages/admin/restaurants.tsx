import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Search, Filter, UtensilsCrossed, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";

interface Restaurant {
  id: string;
  userId: string;
  email: string;
  restaurantName: string;
  address: string;
  country: string;
  verificationStatus: string;
  isVerified: boolean;
  rejectionReason: string | null;
  isSuspended: boolean;
  suspensionReason: string | null;
  suspendedAt: string | null;
  isBlocked: boolean;
  balance: number;
  negativeBalance: number;
  totalOrders: number;
  createdAt: string;
}

export default function AdminRestaurants() {
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Build query params
  const queryParams = new URLSearchParams();
  if (searchQuery) queryParams.append("search", searchQuery);
  if (statusFilter !== "all") queryParams.append("status", statusFilter);

  const queryString = queryParams.toString();
  const fullUrl = `/api/admin/restaurants${queryString ? `?${queryString}` : ''}`;

  const { data: restaurants, isLoading } = useQuery<Restaurant[]>({
    queryKey: [fullUrl],
    refetchInterval: 30000, // Auto-refresh every 30 seconds for memory efficiency
  });

  const getStatusBadge = (restaurant: Restaurant) => {
    if (restaurant.isBlocked) {
      return <Badge variant="destructive" data-testid={`badge-status-${restaurant.id}`}>Blocked</Badge>;
    }
    if (restaurant.isSuspended) {
      return <Badge className="bg-orange-500" data-testid={`badge-status-${restaurant.id}`}>Suspended</Badge>;
    }
    if (!restaurant.isVerified) {
      return <Badge variant="secondary" data-testid={`badge-status-${restaurant.id}`}>Pending KYC</Badge>;
    }
    return <Badge className="bg-green-500" data-testid={`badge-status-${restaurant.id}`}>Active</Badge>;
  };

  const getKYCBadge = (status: string) => {
    if (status === "approved") {
      return <Badge className="bg-green-500">Verified</Badge>;
    }
    if (status === "rejected") {
      return <Badge variant="destructive">Rejected</Badge>;
    }
    return <Badge variant="secondary">Pending</Badge>;
  };

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-6 rounded-b-3xl shadow-lg">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/admin")}
            className="text-primary-foreground hover:bg-primary-foreground/10"
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Restaurant Management</h1>
            <p className="text-sm opacity-90">View and manage all restaurants</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Search and Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Search & Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-search"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value)}>
                <SelectTrigger data-testid="select-status">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Restaurants List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span className="flex items-center gap-2">
                <UtensilsCrossed className="h-5 w-5" />
                Restaurants ({isLoading ? "..." : restaurants?.length || 0})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="border rounded-lg p-4">
                    <Skeleton className="h-6 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ))}
              </div>
            ) : !restaurants || restaurants.length === 0 ? (
              <div className="text-center py-12">
                <UtensilsCrossed className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No restaurants found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 font-semibold">Restaurant</th>
                      <th className="text-left p-3 font-semibold">Email</th>
                      <th className="text-left p-3 font-semibold">Country</th>
                      <th className="text-left p-3 font-semibold">KYC</th>
                      <th className="text-left p-3 font-semibold">Status</th>
                      <th className="text-right p-3 font-semibold">Commission Pending</th>
                      <th className="text-right p-3 font-semibold">Wallet Balance</th>
                      <th className="text-left p-3 font-semibold">Orders</th>
                      <th className="text-left p-3 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {restaurants.map((restaurant) => (
                      <tr 
                        key={restaurant.id} 
                        className="border-b hover-elevate"
                        data-testid={`row-restaurant-${restaurant.id}`}
                      >
                        <td className="p-3">
                          <div>
                            <p className="font-medium" data-testid={`text-name-${restaurant.id}`}>
                              {restaurant.restaurantName}
                            </p>
                            <p className="text-sm text-muted-foreground truncate max-w-xs">
                              {restaurant.address}
                            </p>
                          </div>
                        </td>
                        <td className="p-3">
                          <p className="text-sm" data-testid={`text-email-${restaurant.id}`}>
                            {restaurant.email}
                          </p>
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" data-testid={`badge-country-${restaurant.id}`}>
                            {restaurant.country}
                          </Badge>
                        </td>
                        <td className="p-3" data-testid={`badge-kyc-${restaurant.id}`}>
                          {getKYCBadge(restaurant.verificationStatus)}
                        </td>
                        <td className="p-3">
                          {getStatusBadge(restaurant)}
                        </td>
                        <td className="p-3 text-right">
                          <p className={`text-sm font-medium ${restaurant.negativeBalance > 0 ? 'text-orange-600' : 'text-muted-foreground'}`} data-testid={`text-pending-${restaurant.id}`}>
                            ${Number(restaurant.negativeBalance || 0).toFixed(2)}
                          </p>
                        </td>
                        <td className="p-3 text-right">
                          <p className="text-sm text-green-600 font-medium" data-testid={`text-balance-${restaurant.id}`}>
                            ${Number(restaurant.balance || 0).toFixed(2)}
                          </p>
                        </td>
                        <td className="p-3">
                          <p className="text-sm" data-testid={`text-orders-${restaurant.id}`}>
                            {restaurant.totalOrders}
                          </p>
                        </td>
                        <td className="p-3">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/admin/restaurants/${restaurant.id}`)}
                            data-testid={`button-manage-${restaurant.id}`}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Manage
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
