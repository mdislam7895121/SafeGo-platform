import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Users, Search, Filter, ShoppingBag, Car, Package, UserCheck, UserX, Clock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Customer {
  id: string;
  userId: string;
  email: string;
  country: string;
  verificationStatus: string;
  isVerified: boolean;
  isSuspended: boolean;
  suspensionReason?: string;
  suspendedAt?: string;
  isBlocked: boolean;
  createdAt: string;
  totalRides: number;
  completedRides: number;
  totalFoodOrders: number;
  completedFoodOrders: number;
  totalParcels: number;
  completedParcels: number;
}

export default function AdminCustomers() {
  const [, setLocation] = useLocation();
  const [searchEmail, setSearchEmail] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Build query params
  const queryParams = new URLSearchParams();
  if (searchEmail) queryParams.append("search", searchEmail);
  if (statusFilter !== "all") queryParams.append("status", statusFilter);

  const queryString = queryParams.toString();
  const fullUrl = `/api/admin/customers${queryString ? `?${queryString}` : ''}`;

  // Fetch customers
  const { data: customers, isLoading } = useQuery<Customer[]>({
    queryKey: [fullUrl],
    refetchInterval: 30000, // Auto-refresh every 30 seconds for memory efficiency
  });

  const getKycStatusBadge = (status: string, isVerified: boolean) => {
    if (isVerified) {
      return <Badge variant="default" className="bg-green-600 hover:bg-green-700" data-testid="badge-kyc-verified">Verified</Badge>;
    }
    if (status === "pending") {
      return <Badge variant="secondary" data-testid="badge-kyc-pending">Pending</Badge>;
    }
    if (status === "rejected") {
      return <Badge variant="destructive" data-testid="badge-kyc-rejected">Rejected</Badge>;
    }
    return <Badge variant="outline" data-testid="badge-kyc-status">{status}</Badge>;
  };

  const getAccountStatusBadge = (customer: Customer) => {
    if (customer.isBlocked) {
      return <Badge variant="destructive" data-testid={`badge-blocked-${customer.id}`}>Blocked</Badge>;
    }
    if (customer.isSuspended) {
      return <Badge variant="secondary" data-testid={`badge-suspended-${customer.id}`}>Suspended</Badge>;
    }
    return <Badge variant="default" className="bg-green-600 hover:bg-green-700" data-testid={`badge-active-${customer.id}`}>Active</Badge>;
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-6 lg:p-8 pt-4 sm:pt-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight" data-testid="heading-customer-management">Customer Management</h2>
          <p className="text-sm text-muted-foreground">
            Manage all customer accounts, KYC status, and usage statistics
          </p>
        </div>
        <div className="flex items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLocation("/admin")}
            data-testid="button-back-dashboard"
            className="min-h-[44px] sm:min-h-9"
          >
            Back to Dashboard
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
          <CardDescription>Search and filter customer accounts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search by Email</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-3 sm:top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Enter customer email..."
                  className="pl-8 min-h-[44px] sm:min-h-9"
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                  data-testid="input-search-email"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Account Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger data-testid="select-status-filter" className="min-h-[44px] sm:min-h-9">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" data-testid="option-all">All Statuses</SelectItem>
                  <SelectItem value="active" data-testid="option-active">Active</SelectItem>
                  <SelectItem value="suspended" data-testid="option-suspended">Suspended</SelectItem>
                  <SelectItem value="blocked" data-testid="option-blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customer List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Customer Accounts
          </CardTitle>
          <CardDescription>
            {customers && `${customers.length} customer${customers.length !== 1 ? 's' : ''} found`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-24 sm:h-12 w-full" />
              ))}
            </div>
          ) : customers && customers.length > 0 ? (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Country</TableHead>
                      <TableHead>KYC Status</TableHead>
                      <TableHead>Account Status</TableHead>
                      <TableHead className="text-center">Usage Stats</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.map((customer) => (
                      <TableRow key={customer.id} data-testid={`row-customer-${customer.id}`}>
                        <TableCell className="font-medium" data-testid={`text-email-${customer.id}`}>
                          {customer.email}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" data-testid={`badge-country-${customer.id}`}>{customer.country}</Badge>
                        </TableCell>
                        <TableCell>
                          {getKycStatusBadge(customer.verificationStatus, customer.isVerified)}
                        </TableCell>
                        <TableCell>
                          {getAccountStatusBadge(customer)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1 text-sm">
                            <div className="flex items-center gap-2" data-testid={`text-rides-${customer.id}`}>
                              <Car className="h-3 w-3" />
                              <span>{customer.completedRides}/{customer.totalRides} rides</span>
                            </div>
                            <div className="flex items-center gap-2" data-testid={`text-food-${customer.id}`}>
                              <ShoppingBag className="h-3 w-3" />
                              <span>{customer.completedFoodOrders}/{customer.totalFoodOrders} food orders</span>
                            </div>
                            <div className="flex items-center gap-2" data-testid={`text-parcels-${customer.id}`}>
                              <Package className="h-3 w-3" />
                              <span>{customer.completedParcels}/{customer.totalParcels} parcels</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setLocation(`/admin/customers/${customer.id}`)}
                            data-testid={`button-manage-${customer.id}`}
                          >
                            Manage
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3">
                {customers.map((customer) => (
                  <Card key={customer.id} className="hover-elevate" data-testid={`card-customer-${customer.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate" data-testid={`text-email-${customer.id}`}>
                            {customer.email}
                          </p>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            <Badge variant="outline" data-testid={`badge-country-${customer.id}`} className="text-xs">
                              {customer.country}
                            </Badge>
                            {getKycStatusBadge(customer.verificationStatus, customer.isVerified)}
                            {getAccountStatusBadge(customer)}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setLocation(`/admin/customers/${customer.id}`)}
                          data-testid={`button-manage-${customer.id}`}
                          className="min-h-[40px] min-w-[40px] shrink-0"
                        >
                          Manage
                        </Button>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs border-t pt-3">
                        <div className="flex items-center gap-1.5" data-testid={`text-rides-${customer.id}`}>
                          <Car className="h-3 w-3 text-muted-foreground" />
                          <span>{customer.completedRides}/{customer.totalRides}</span>
                        </div>
                        <div className="flex items-center gap-1.5" data-testid={`text-food-${customer.id}`}>
                          <ShoppingBag className="h-3 w-3 text-muted-foreground" />
                          <span>{customer.completedFoodOrders}/{customer.totalFoodOrders}</span>
                        </div>
                        <div className="flex items-center gap-1.5" data-testid={`text-parcels-${customer.id}`}>
                          <Package className="h-3 w-3 text-muted-foreground" />
                          <span>{customer.completedParcels}/{customer.totalParcels}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-no-customers">
              No customers found matching your filters.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
