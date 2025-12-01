import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Users, User, Shield, Ban } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { format } from "date-fns";

interface UserProfile {
  id: string;
  email: string;
  role: string;
  countryCode: string;
  isBlocked: boolean;
  createdAt: string;
  driverProfile?: {
    verificationStatus: string;
    isVerified: boolean;
  } | null;
  customerProfile?: {
    verificationStatus: string;
    isVerified: boolean;
  } | null;
  restaurantProfile?: {
    restaurantName: string;
    verificationStatus: string;
    isVerified: boolean;
  } | null;
}

interface UsersResponse {
  users: UserProfile[];
}

export default function AdminUsers() {
  const [, navigate] = useLocation();
  const [roleFilter, setRoleFilter] = useState<string>("all");

  // Build query params
  const queryParams = new URLSearchParams();
  if (roleFilter !== "all") queryParams.append("role", roleFilter);

  const queryString = queryParams.toString();
  const fullUrl = `/api/admin/users${queryString ? `?${queryString}` : ''}`;

  const { data, isLoading } = useQuery<UsersResponse>({
    queryKey: [fullUrl],
    refetchInterval: 30000, // Auto-refresh every 30 seconds for memory efficiency
  });

  const getRoleBadge = (role: string) => {
    const roleColors = {
      customer: "bg-blue-500",
      driver: "bg-purple-500",
      restaurant: "bg-orange-500",
      admin: "bg-red-500",
    };

    return (
      <Badge className={roleColors[role as keyof typeof roleColors] || "bg-gray-500"}>
        {role.charAt(0).toUpperCase() + role.slice(1)}
      </Badge>
    );
  };

  const getVerificationBadge = (user: UserProfile) => {
    if (user.role === "driver" && user.driverProfile) {
      return user.driverProfile.isVerified ? (
        <Badge className="bg-green-500">Verified</Badge>
      ) : (
        <Badge variant="secondary">Pending KYC</Badge>
      );
    }
    if (user.role === "customer" && user.customerProfile) {
      return user.customerProfile.isVerified ? (
        <Badge className="bg-green-500">Verified</Badge>
      ) : (
        <Badge variant="secondary">Pending KYC</Badge>
      );
    }
    if (user.role === "restaurant" && user.restaurantProfile) {
      return user.restaurantProfile.isVerified ? (
        <Badge className="bg-green-500">Verified</Badge>
      ) : (
        <Badge variant="secondary">Pending KYC</Badge>
      );
    }
    return null;
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
            <h1 className="text-2xl font-bold">User Management</h1>
            <p className="text-sm opacity-90">View all platform users</p>
          </div>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-4">
              <Users className="h-6 w-6 text-primary" />
              <div className="flex-1">
                <p className="font-semibold">Total Users</p>
                <p className="text-sm text-muted-foreground">
                  {data?.users.length ?? 0} users registered
                </p>
              </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Filter by Role
                </label>
                <Select
                  value={roleFilter}
                  onValueChange={setRoleFilter}
                >
                  <SelectTrigger data-testid="select-role-filter">
                    <SelectValue placeholder="All Roles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="driver">Driver</SelectItem>
                    <SelectItem value="restaurant">Restaurant</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="p-6 space-y-4">
        {/* Users List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-16 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : data?.users && data.users.length > 0 ? (
          <div className="space-y-3">
            {data.users.map((user) => (
              <Card key={user.id} className="hover-elevate" data-testid={`card-user-${user.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <User className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        <p className="font-semibold truncate" data-testid={`text-email-${user.id}`}>
                          {user.email}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {getRoleBadge(user.role)}
                        {getVerificationBadge(user)}
                        {user.isBlocked && (
                          <Badge variant="destructive">
                            <Ban className="h-3 w-3 mr-1" />
                            Blocked
                          </Badge>
                        )}
                        <Badge variant="outline">
                          <Shield className="h-3 w-3 mr-1" />
                          {user.countryCode}
                        </Badge>
                      </div>

                      {user.role === "restaurant" && user.restaurantProfile && (
                        <p className="text-sm text-muted-foreground mt-2">
                          Restaurant: {user.restaurantProfile.restaurantName}
                        </p>
                      )}

                      <p className="text-xs text-muted-foreground mt-2">
                        Joined {format(new Date(user.createdAt), "MMM d, yyyy")}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No users found</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
