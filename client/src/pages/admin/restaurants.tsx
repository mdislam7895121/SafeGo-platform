import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Search, Filter, UtensilsCrossed, Eye, Columns, ChevronRight } from "lucide-react";
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

// Breakpoint detection hook
function useBreakpoint() {
  const [breakpoint, setBreakpoint] = useState<"mobile" | "tablet" | "laptop" | "desktop">("desktop");
  
  useEffect(() => {
    const updateBreakpoint = () => {
      const width = window.innerWidth;
      if (width < 768) {
        setBreakpoint("mobile");
      } else if (width < 1024) {
        setBreakpoint("tablet");
      } else if (width < 1280) {
        setBreakpoint("laptop");
      } else {
        setBreakpoint("desktop");
      }
    };
    
    updateBreakpoint();
    window.addEventListener("resize", updateBreakpoint);
    return () => window.removeEventListener("resize", updateBreakpoint);
  }, []);
  
  return breakpoint;
}

interface ColumnConfig {
  id: string;
  label: string;
  priority: "high" | "medium" | "low";
  defaultVisible: boolean;
  tabletVisible: boolean; // Whether column is shown by default on tablet
}

const COLUMNS: ColumnConfig[] = [
  { id: "restaurant", label: "Restaurant", priority: "high", defaultVisible: true, tabletVisible: true },
  { id: "email", label: "Email", priority: "high", defaultVisible: true, tabletVisible: true },
  { id: "country", label: "Country", priority: "high", defaultVisible: true, tabletVisible: true },
  { id: "kyc", label: "KYC", priority: "high", defaultVisible: true, tabletVisible: false },
  { id: "status", label: "Status", priority: "high", defaultVisible: true, tabletVisible: true },
  { id: "pending", label: "Commission Pending", priority: "medium", defaultVisible: true, tabletVisible: false },
  { id: "balance", label: "Wallet Balance", priority: "medium", defaultVisible: true, tabletVisible: false },
  { id: "orders", label: "Orders", priority: "medium", defaultVisible: true, tabletVisible: false },
  { id: "actions", label: "Actions", priority: "high", defaultVisible: true, tabletVisible: true },
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
  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === "mobile";
  const isTabletOrSmaller = breakpoint === "mobile" || breakpoint === "tablet";
  const isLaptop = breakpoint === "laptop";
  
  // Column visibility state with localStorage persistence
  const [userColumnPrefs, setUserColumnPrefs] = useState<Record<string, boolean>>(() => {
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
      localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(userColumnPrefs));
    } catch (e) {
      console.error("Failed to save column preferences", e);
    }
  }, [userColumnPrefs]);

  // Compute column visibility based on breakpoint and user preferences
  const getColumnVisibility = (columnId: string): boolean => {
    const col = COLUMNS.find(c => c.id === columnId);
    if (!col) return false;
    
    // User explicitly toggled off
    if (userColumnPrefs[columnId] === false) return false;
    
    // On tablet, auto-hide columns not marked as tabletVisible (unless user explicitly enabled)
    if (isTabletOrSmaller && !col.tabletVisible) {
      return userColumnPrefs[columnId] === true; // Only show if user explicitly enabled
    }
    
    return userColumnPrefs[columnId] !== false;
  };

  const toggleColumn = (columnId: string) => {
    // Don't allow hiding restaurant or actions columns
    if (columnId === "restaurant" || columnId === "actions") return;
    
    // Get current effective visibility (not just stored preference)
    const currentlyVisible = getColumnVisibility(columnId);
    
    // Toggle: if currently visible → hide (false), if currently hidden → show (true)
    setUserColumnPrefs(prev => ({ ...prev, [columnId]: !currentlyVisible }));
  };

  // Responsive column visibility - memoized version for render efficiency
  const isColumnVisible = useMemo(() => getColumnVisibility, [userColumnPrefs, isTabletOrSmaller]);

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

  // Responsive padding classes
  const containerPadding = isMobile ? "p-3" : isTabletOrSmaller ? "p-4" : "p-6";
  const headerPadding = isMobile ? "p-4" : isTabletOrSmaller ? "p-5" : "p-6";
  const cardPadding = isMobile ? "p-3" : isTabletOrSmaller ? "p-4" : "";

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* Header - Premium Minimal Design */}
      <div className="border-b border-black/[0.06] dark:border-white/[0.06] bg-gradient-to-r from-primary/5 via-primary/3 to-transparent dark:from-primary/10 dark:via-primary/5 dark:to-transparent">
        <div className={`${headerPadding}`}>
          <div className="mb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/admin")}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1.5"
              data-testid="button-back"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Back to Dashboard</span>
              <span className="sm:hidden">Back</span>
            </Button>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-primary/10 dark:bg-primary/20 rounded-md shrink-0">
              <UtensilsCrossed className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className={`font-semibold text-foreground ${isMobile ? "text-base" : "text-lg"}`}>Restaurant Management</h1>
              <p className="text-[11px] text-muted-foreground">View and manage all restaurants</p>
            </div>
          </div>
        </div>
      </div>

      <div className={`${containerPadding} space-y-4 md:space-y-6`}>
        {/* Search and Filters - Responsive */}
        <Card className="premium-glow-card">
          <CardHeader className={cardPadding}>
            <CardTitle className={`flex items-center gap-2 ${isMobile ? "text-base" : "text-lg"}`}>
              <Filter className={`${isMobile ? "h-4 w-4" : "h-5 w-5"}`} />
              Search & Filters
            </CardTitle>
          </CardHeader>
          <CardContent className={`space-y-3 md:space-y-4 ${cardPadding}`}>
            {/* Search row - stacks on mobile */}
            <div className={`flex gap-2 md:gap-3 ${isMobile ? "flex-col" : "flex-wrap"}`}>
              <div className={`relative ${isMobile ? "w-full" : "flex-1 min-w-[200px]"}`}>
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`pl-10 ${isMobile ? "text-sm" : ""}`}
                  data-testid="input-search"
                />
              </div>
              
              {/* Column Visibility Toggle - Always visible */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    size={isMobile ? "sm" : "default"} 
                    className={`gap-2 ${isMobile ? "w-full justify-center" : ""}`} 
                    data-testid="button-columns"
                  >
                    <Columns className="h-4 w-4" />
                    <span>Columns</span>
                    {isTabletOrSmaller && (
                      <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                        {COLUMNS.filter(c => isColumnVisible(c.id)).length}
                      </Badge>
                    )}
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
                        {!col.tabletVisible && isTabletOrSmaller && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0">Hidden</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Status filter */}
            <div className={`grid gap-2 md:gap-3 ${isMobile ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"}`}>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value)}>
                <SelectTrigger data-testid="select-status" className={isMobile ? "text-sm" : ""}>
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
          <CardHeader className={cardPadding}>
            <CardTitle className={`flex items-center justify-between ${isMobile ? "text-base" : "text-lg"}`}>
              <span className="flex items-center gap-2">
                <UtensilsCrossed className={`${isMobile ? "h-4 w-4" : "h-5 w-5"}`} />
                Restaurants ({isLoading ? "..." : restaurants?.length || 0})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className={`space-y-3 ${containerPadding}`}>
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
            ) : isMobile ? (
              /* Mobile Card View */
              <div className="divide-y">
                {restaurants.map((restaurant) => (
                  <div 
                    key={restaurant.id}
                    className="p-3 hover-elevate cursor-pointer transition-colors"
                    onClick={() => navigate(`/admin/restaurants/${restaurant.id}`)}
                    data-testid={`card-restaurant-${restaurant.id}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate" data-testid={`text-name-${restaurant.id}`}>
                          {restaurant.restaurantName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {restaurant.address}
                        </p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5" data-testid={`text-email-${restaurant.id}`}>
                          {restaurant.email}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0" data-testid={`badge-country-${restaurant.id}`}>
                        {restaurant.country}
                      </Badge>
                      {getKYCBadge(restaurant.verificationStatus)}
                      {getStatusBadge(restaurant)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Table View for Tablet+ */
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
                          className={`text-left font-semibold whitespace-nowrap sticky left-0 z-10 bg-card dark:bg-[#1C1C1E] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] ${isLaptop ? "p-2 text-sm" : "p-3"}`}
                          style={{ minWidth: isLaptop ? "160px" : "200px" }}
                        >
                          Restaurant
                        </th>
                      )}
                      {isColumnVisible("email") && (
                        <th className={`text-left font-semibold whitespace-nowrap ${isLaptop ? "p-2 text-sm" : "p-3"}`} style={{ minWidth: isLaptop ? "140px" : "180px" }}>Email</th>
                      )}
                      {isColumnVisible("country") && (
                        <th className={`text-left font-semibold whitespace-nowrap ${isLaptop ? "p-2 text-sm" : "p-3"}`} style={{ minWidth: "80px" }}>Country</th>
                      )}
                      {isColumnVisible("kyc") && (
                        <th className={`text-left font-semibold whitespace-nowrap ${isLaptop ? "p-2 text-sm" : "p-3"}`} style={{ minWidth: "80px" }}>KYC</th>
                      )}
                      {isColumnVisible("status") && (
                        <th className={`text-left font-semibold whitespace-nowrap ${isLaptop ? "p-2 text-sm" : "p-3"}`} style={{ minWidth: "80px" }}>Status</th>
                      )}
                      {isColumnVisible("pending") && (
                        <th className={`text-right font-semibold whitespace-nowrap ${isLaptop ? "p-2 text-sm" : "p-3"}`} style={{ minWidth: isLaptop ? "100px" : "140px" }}>
                          {isLaptop ? "Commission" : "Commission Pending"}
                        </th>
                      )}
                      {isColumnVisible("balance") && (
                        <th className={`text-right font-semibold whitespace-nowrap ${isLaptop ? "p-2 text-sm" : "p-3"}`} style={{ minWidth: isLaptop ? "90px" : "120px" }}>
                          {isLaptop ? "Balance" : "Wallet Balance"}
                        </th>
                      )}
                      {isColumnVisible("orders") && (
                        <th className={`text-left font-semibold whitespace-nowrap ${isLaptop ? "p-2 text-sm" : "p-3"}`} style={{ minWidth: "60px" }}>Orders</th>
                      )}
                      {isColumnVisible("actions") && (
                        <th className={`text-left font-semibold whitespace-nowrap ${isLaptop ? "p-2 text-sm" : "p-3"}`} style={{ minWidth: "80px" }}>Actions</th>
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
                            className={`sticky left-0 z-10 bg-card dark:bg-[#1C1C1E] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] ${isLaptop ? "p-2" : "p-3"}`}
                          >
                            <div style={{ maxWidth: isLaptop ? "140px" : "180px" }}>
                              <p className={`font-medium truncate ${isLaptop ? "text-sm" : ""}`} data-testid={`text-name-${restaurant.id}`}>
                                {restaurant.restaurantName}
                              </p>
                              <p className={`text-muted-foreground truncate ${isLaptop ? "text-xs" : "text-sm"}`}>
                                {restaurant.address}
                              </p>
                            </div>
                          </td>
                        )}
                        {isColumnVisible("email") && (
                          <td className={isLaptop ? "p-2" : "p-3"}>
                            <p 
                              className={`truncate ${isLaptop ? "text-xs" : "text-sm"}`} 
                              style={{ maxWidth: isLaptop ? "120px" : "160px" }}
                              data-testid={`text-email-${restaurant.id}`}
                              title={restaurant.email}
                            >
                              {restaurant.email}
                            </p>
                          </td>
                        )}
                        {isColumnVisible("country") && (
                          <td className={isLaptop ? "p-2" : "p-3"}>
                            <Badge variant="outline" className={isLaptop ? "text-xs px-1.5" : ""} data-testid={`badge-country-${restaurant.id}`}>
                              {restaurant.country}
                            </Badge>
                          </td>
                        )}
                        {isColumnVisible("kyc") && (
                          <td className={isLaptop ? "p-2" : "p-3"} data-testid={`badge-kyc-${restaurant.id}`}>
                            {getKYCBadge(restaurant.verificationStatus)}
                          </td>
                        )}
                        {isColumnVisible("status") && (
                          <td className={isLaptop ? "p-2" : "p-3"}>
                            {getStatusBadge(restaurant)}
                          </td>
                        )}
                        {isColumnVisible("pending") && (
                          <td className={`text-right ${isLaptop ? "p-2" : "p-3"}`}>
                            <p className={`font-medium whitespace-nowrap ${isLaptop ? "text-xs" : "text-sm"} ${restaurant.negativeBalance > 0 ? 'text-orange-600' : 'text-muted-foreground'}`} data-testid={`text-pending-${restaurant.id}`}>
                              ${Number(restaurant.negativeBalance || 0).toFixed(2)}
                            </p>
                          </td>
                        )}
                        {isColumnVisible("balance") && (
                          <td className={`text-right ${isLaptop ? "p-2" : "p-3"}`}>
                            <p className={`text-green-600 font-medium whitespace-nowrap ${isLaptop ? "text-xs" : "text-sm"}`} data-testid={`text-balance-${restaurant.id}`}>
                              ${Number(restaurant.balance || 0).toFixed(2)}
                            </p>
                          </td>
                        )}
                        {isColumnVisible("orders") && (
                          <td className={isLaptop ? "p-2" : "p-3"}>
                            <p className={isLaptop ? "text-xs" : "text-sm"} data-testid={`text-orders-${restaurant.id}`}>
                              {restaurant.totalOrders}
                            </p>
                          </td>
                        )}
                        {isColumnVisible("actions") && (
                          <td className={isLaptop ? "p-2" : "p-3"}>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate(`/admin/restaurants/${restaurant.id}`)}
                              className={isLaptop ? "text-xs h-7 px-2" : ""}
                              data-testid={`button-manage-${restaurant.id}`}
                            >
                              <Eye className={`mr-1 ${isLaptop ? "h-3 w-3" : "h-4 w-4"}`} />
                              {isLaptop ? "" : "Manage"}
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
