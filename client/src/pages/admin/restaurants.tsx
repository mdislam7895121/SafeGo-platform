import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Search, Filter, UtensilsCrossed, Eye, Columns, Check } from "lucide-react";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery } from "@tanstack/react-query";

const COLUMN_STORAGE_KEY = "safego-restaurant-columns";

interface ColumnConfig {
  id: string;
  label: string;
  priority: "high" | "medium" | "low";
  defaultVisible: boolean;
}

const COLUMNS: ColumnConfig[] = [
  { id: "restaurant", label: "Restaurant", priority: "high", defaultVisible: true },
  { id: "email", label: "Email", priority: "high", defaultVisible: true },
  { id: "country", label: "Country", priority: "high", defaultVisible: true },
  { id: "kyc", label: "KYC", priority: "high", defaultVisible: true },
  { id: "status", label: "Status", priority: "high", defaultVisible: true },
  { id: "pending", label: "Commission Pending", priority: "medium", defaultVisible: true },
  { id: "balance", label: "Wallet Balance", priority: "medium", defaultVisible: true },
  { id: "orders", label: "Orders", priority: "medium", defaultVisible: true },
  { id: "actions", label: "Actions", priority: "high", defaultVisible: true },
];

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
  
  // Column visibility state with localStorage persistence
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(COLUMN_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error("Failed to load column preferences", e);
    }
    // Default: all columns visible
    return COLUMNS.reduce((acc, col) => ({ ...acc, [col.id]: col.defaultVisible }), {});
  });

  // Persist column visibility to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(visibleColumns));
    } catch (e) {
      console.error("Failed to save column preferences", e);
    }
  }, [visibleColumns]);

  const toggleColumn = (columnId: string) => {
    // Don't allow hiding restaurant or actions columns
    if (columnId === "restaurant" || columnId === "actions") return;
    setVisibleColumns(prev => ({ ...prev, [columnId]: !prev[columnId] }));
  };

  const isColumnVisible = (columnId: string) => visibleColumns[columnId] !== false;

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
        <Card className="premium-glow-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Search & Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3 flex-wrap">
              <div className="flex-1 min-w-[200px] relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-search"
                />
              </div>
              
              {/* Column Visibility Toggle */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="default" className="gap-2" data-testid="button-columns">
                    <Columns className="h-4 w-4" />
                    Columns
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-3" align="end">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground mb-2">Toggle Columns</p>
                    {COLUMNS.map((col) => (
                      <div 
                        key={col.id} 
                        className={`flex items-center gap-2 p-2 rounded-md ${col.id === "restaurant" || col.id === "actions" ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover-elevate"}`}
                        onClick={() => toggleColumn(col.id)}
                        data-testid={`toggle-column-${col.id}`}
                      >
                        <Checkbox 
                          checked={isColumnVisible(col.id)} 
                          disabled={col.id === "restaurant" || col.id === "actions"}
                          className="pointer-events-none"
                        />
                        <span className="text-sm flex-1">{col.label}</span>
                        {col.priority === "high" && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Required</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
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
        <Card className="premium-glow-card overflow-hidden">
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span className="flex items-center gap-2">
                <UtensilsCrossed className="h-5 w-5" />
                Restaurants ({isLoading ? "..." : restaurants?.length || 0})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-3 p-6">
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
              <div 
                className="overflow-x-auto overflow-y-visible"
                style={{ maxWidth: "100%" }}
                data-testid="table-scroll-container"
              >
                <table 
                  className="w-full border-collapse"
                  style={{ tableLayout: "auto", minWidth: "max-content" }}
                >
                  <thead>
                    <tr className="border-b bg-muted/30">
                      {/* Sticky Restaurant Column */}
                      {isColumnVisible("restaurant") && (
                        <th 
                          className="text-left p-3 font-semibold whitespace-nowrap sticky left-0 z-10 bg-card dark:bg-[#1C1C1E] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]"
                          style={{ minWidth: "200px" }}
                        >
                          Restaurant
                        </th>
                      )}
                      {isColumnVisible("email") && (
                        <th className="text-left p-3 font-semibold whitespace-nowrap" style={{ minWidth: "180px" }}>Email</th>
                      )}
                      {isColumnVisible("country") && (
                        <th className="text-left p-3 font-semibold whitespace-nowrap" style={{ minWidth: "100px" }}>Country</th>
                      )}
                      {isColumnVisible("kyc") && (
                        <th className="text-left p-3 font-semibold whitespace-nowrap" style={{ minWidth: "100px" }}>KYC</th>
                      )}
                      {isColumnVisible("status") && (
                        <th className="text-left p-3 font-semibold whitespace-nowrap" style={{ minWidth: "100px" }}>Status</th>
                      )}
                      {isColumnVisible("pending") && (
                        <th className="text-right p-3 font-semibold whitespace-nowrap" style={{ minWidth: "140px" }}>Commission Pending</th>
                      )}
                      {isColumnVisible("balance") && (
                        <th className="text-right p-3 font-semibold whitespace-nowrap" style={{ minWidth: "120px" }}>Wallet Balance</th>
                      )}
                      {isColumnVisible("orders") && (
                        <th className="text-left p-3 font-semibold whitespace-nowrap" style={{ minWidth: "80px" }}>Orders</th>
                      )}
                      {isColumnVisible("actions") && (
                        <th className="text-left p-3 font-semibold whitespace-nowrap" style={{ minWidth: "100px" }}>Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {restaurants.map((restaurant) => (
                      <tr 
                        key={restaurant.id} 
                        className="border-b transition-colors hover:bg-muted/50"
                        data-testid={`row-restaurant-${restaurant.id}`}
                      >
                        {/* Sticky Restaurant Column */}
                        {isColumnVisible("restaurant") && (
                          <td 
                            className="p-3 sticky left-0 z-10 bg-card dark:bg-[#1C1C1E] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]"
                          >
                            <div className="min-w-[180px]">
                              <p className="font-medium truncate" data-testid={`text-name-${restaurant.id}`}>
                                {restaurant.restaurantName}
                              </p>
                              <p className="text-sm text-muted-foreground truncate max-w-[180px]">
                                {restaurant.address}
                              </p>
                            </div>
                          </td>
                        )}
                        {isColumnVisible("email") && (
                          <td className="p-3">
                            <p className="text-sm whitespace-nowrap" data-testid={`text-email-${restaurant.id}`}>
                              {restaurant.email}
                            </p>
                          </td>
                        )}
                        {isColumnVisible("country") && (
                          <td className="p-3">
                            <Badge variant="outline" data-testid={`badge-country-${restaurant.id}`}>
                              {restaurant.country}
                            </Badge>
                          </td>
                        )}
                        {isColumnVisible("kyc") && (
                          <td className="p-3" data-testid={`badge-kyc-${restaurant.id}`}>
                            {getKYCBadge(restaurant.verificationStatus)}
                          </td>
                        )}
                        {isColumnVisible("status") && (
                          <td className="p-3">
                            {getStatusBadge(restaurant)}
                          </td>
                        )}
                        {isColumnVisible("pending") && (
                          <td className="p-3 text-right">
                            <p className={`text-sm font-medium whitespace-nowrap ${restaurant.negativeBalance > 0 ? 'text-orange-600' : 'text-muted-foreground'}`} data-testid={`text-pending-${restaurant.id}`}>
                              ${Number(restaurant.negativeBalance || 0).toFixed(2)}
                            </p>
                          </td>
                        )}
                        {isColumnVisible("balance") && (
                          <td className="p-3 text-right">
                            <p className="text-sm text-green-600 font-medium whitespace-nowrap" data-testid={`text-balance-${restaurant.id}`}>
                              ${Number(restaurant.balance || 0).toFixed(2)}
                            </p>
                          </td>
                        )}
                        {isColumnVisible("orders") && (
                          <td className="p-3">
                            <p className="text-sm" data-testid={`text-orders-${restaurant.id}`}>
                              {restaurant.totalOrders}
                            </p>
                          </td>
                        )}
                        {isColumnVisible("actions") && (
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
                        )}
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
