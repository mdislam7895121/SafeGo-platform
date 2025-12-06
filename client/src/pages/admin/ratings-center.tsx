import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Star,
  ArrowLeft,
  Filter,
  Flag,
  Eye,
  EyeOff,
  CheckCircle,
  AlertTriangle,
  Car,
  Utensils,
  TrendingUp,
  TrendingDown,
  BarChart3,
  MessageSquare,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from "recharts";
import { Label } from "@/components/ui/label";
import { Calendar, Gavel, RefreshCw, Info } from "lucide-react";

interface Rating {
  id: string;
  type: "driver" | "restaurant";
  ratingType: string;
  entityId: string;
  entityName: string;
  raterId: string;
  raterName: string;
  rating: number;
  feedback: string | null;
  createdAt: string;
  isFlagged: boolean;
  flagReason: string | null;
  isHidden?: boolean;
  hideReason?: string | null;
  severity: string;
}

interface RatingsResponse {
  ratings: Rating[];
  distribution: {
    driver: { rating: number; count: number }[];
    restaurant: { rating: number; count: number }[];
  };
  summary: {
    totalDriverRatings: number;
    totalRestaurantReviews: number;
    avgDriverRating: number;
    avgRestaurantRating: number;
    flaggedReviews: number;
    lowRatings: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

interface Complaint {
  id: string;
  ticketCode: string;
  subject: string;
  status: string;
  severity: string;
  createdAt: string;
}

interface TrendData {
  date: string;
  driverAvg: number;
  restaurantAvg: number;
  driverCount: number;
  restaurantCount: number;
}

interface TrendsResponse {
  trends: TrendData[];
  period: number;
}

interface RatingDispute {
  id: string;
  ticketCode: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  rideId: string | null;
  driverName: string;
  originalRating: number;
  disputeReason: string;
  status: string;
  severity: string;
  createdAt: string;
  resolvedAt: string | null;
  resolutionType: string | null;
}

interface DisputesResponse {
  disputes: RatingDispute[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const RATING_COLORS = ["#ef4444", "#f97316", "#eab308", "#84cc16", "#22c55e"];

export default function RatingsCenter() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("overview");
  const [typeFilter, setTypeFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [trendPeriod, setTrendPeriod] = useState<"7d" | "30d">("7d");

  const [selectedRating, setSelectedRating] = useState<Rating | null>(null);
  const [showDetailSheet, setShowDetailSheet] = useState(false);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [actionType, setActionType] = useState<string>("");
  const [actionReason, setActionReason] = useState("");

  const [disputeFilter, setDisputeFilter] = useState("all");
  const [disputePage, setDisputePage] = useState(1);
  const [selectedDispute, setSelectedDispute] = useState<RatingDispute | null>(null);
  const [showDisputeDialog, setShowDisputeDialog] = useState(false);
  const [disputeAction, setDisputeAction] = useState<string>("");
  const [disputeReason, setDisputeReason] = useState("");
  const [newRating, setNewRating] = useState<number | undefined>();

  const buildQueryUrl = () => {
    const params = new URLSearchParams();
    params.append("page", currentPage.toString());
    params.append("limit", "20");
    if (typeFilter !== "all") params.append("type", typeFilter);
    if (ratingFilter !== "all") params.append("rating", ratingFilter);
    if (severityFilter !== "all") params.append("severity", severityFilter);
    const queryString = params.toString();
    return `/api/admin/phase4/ratings${queryString ? `?${queryString}` : ""}`;
  };

  const queryUrl = buildQueryUrl();

  const { data, isLoading } = useQuery<RatingsResponse>({
    queryKey: [queryUrl],
  });

  const { data: linkedComplaints } = useQuery<{ complaints: Complaint[] }>({
    queryKey: [`/api/admin/phase4/ratings/${selectedRating?.id}/complaints`],
    enabled: !!selectedRating,
  });

  const { data: trendsData, isLoading: trendsLoading } = useQuery<TrendsResponse>({
    queryKey: [`/api/admin/phase4/ratings/trends?period=${trendPeriod}`],
  });

  const disputeQueryUrl = `/api/admin/phase4/ratings/disputes?status=${disputeFilter}&page=${disputePage}&limit=10`;
  const { data: disputesData, isLoading: disputesLoading } = useQuery<DisputesResponse>({
    queryKey: [disputeQueryUrl],
  });

  const updateRatingMutation = useMutation({
    mutationFn: async ({ id, action, reason }: { id: string; action: string; reason?: string }) => {
      return apiRequest(`/api/admin/phase4/ratings/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action, reason }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("/api/admin/phase4/ratings"),
      });
      toast({ title: "Rating updated", description: "The action has been applied successfully." });
      closeActionDialog();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update rating", variant: "destructive" });
    },
  });

  const resolveDisputeMutation = useMutation({
    mutationFn: async ({ id, action, reason, newRating }: { id: string; action: string; reason: string; newRating?: number }) => {
      return apiRequest(`/api/admin/phase4/ratings/disputes/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action, reason, newRating }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("/api/admin/phase4/ratings"),
      });
      toast({ title: "Dispute updated", description: "The dispute has been processed successfully." });
      closeDisputeDialog();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update dispute", variant: "destructive" });
    },
  });

  const openDisputeDialog = (dispute: RatingDispute, action: string) => {
    setSelectedDispute(dispute);
    setDisputeAction(action);
    setDisputeReason("");
    setNewRating(undefined);
    setShowDisputeDialog(true);
  };

  const closeDisputeDialog = () => {
    setShowDisputeDialog(false);
    setSelectedDispute(null);
    setDisputeAction("");
    setDisputeReason("");
    setNewRating(undefined);
  };

  const handleDisputeAction = () => {
    if (!selectedDispute) return;
    resolveDisputeMutation.mutate({
      id: selectedDispute.id,
      action: disputeAction,
      reason: disputeReason,
      newRating: disputeAction === "resolve" ? newRating : undefined,
    });
  };

  const openDetailSheet = (rating: Rating) => {
    setSelectedRating(rating);
    setShowDetailSheet(true);
  };

  const closeDetailSheet = () => {
    setShowDetailSheet(false);
    setSelectedRating(null);
  };

  const openActionDialog = (rating: Rating, action: string) => {
    setSelectedRating(rating);
    setActionType(action);
    setActionReason("");
    setShowActionDialog(true);
  };

  const closeActionDialog = () => {
    setShowActionDialog(false);
    setActionType("");
    setActionReason("");
  };

  const handleAction = () => {
    if (!selectedRating) return;
    updateRatingMutation.mutate({
      id: selectedRating.id,
      action: actionType,
      reason: actionReason || undefined,
    });
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${star <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
          />
        ))}
      </div>
    );
  };

  const getSeverityBadge = (severity: string, isFlagged: boolean) => {
    if (isFlagged) return <Badge variant="destructive">Flagged</Badge>;
    switch (severity) {
      case "low_rating":
        return <Badge className="bg-orange-500">Low Rating</Badge>;
      case "suspicious":
        return <Badge className="bg-red-500">Suspicious</Badge>;
      default:
        return <Badge variant="secondary">Normal</Badge>;
    }
  };

  const chartData = useMemo(() => {
    if (!data?.distribution) return { driver: [], restaurant: [] };
    return {
      driver: data.distribution.driver.map((d) => ({
        name: `${d.rating} Star`,
        value: d.count,
        rating: d.rating,
      })),
      restaurant: data.distribution.restaurant.map((d) => ({
        name: `${d.rating} Star`,
        value: d.count,
        rating: d.rating,
      })),
    };
  }, [data?.distribution]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <Skeleton className="h-8 w-64 mb-6" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* Header - Premium Minimal Design */}
      <div className="border-b border-black/[0.06] dark:border-white/[0.06] bg-gradient-to-r from-primary/5 via-primary/3 to-transparent dark:from-primary/10 dark:via-primary/5 dark:to-transparent sticky top-0 z-10 backdrop-blur-sm">
        <div className="px-4 sm:px-6 py-3">
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
              <Star className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-semibold text-foreground">Ratings & Review Center</h1>
              <p className="text-[11px] text-muted-foreground">Manage driver ratings and restaurant reviews</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <Car className="h-6 w-6 mx-auto text-blue-500 mb-1" />
                <p className="text-xl font-bold">{data?.summary?.totalDriverRatings || 0}</p>
                <p className="text-xs text-muted-foreground">Driver Ratings</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <Utensils className="h-6 w-6 mx-auto text-orange-500 mb-1" />
                <p className="text-xl font-bold">{data?.summary?.totalRestaurantReviews || 0}</p>
                <p className="text-xs text-muted-foreground">Restaurant Reviews</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <TrendingUp className="h-6 w-6 mx-auto text-green-500 mb-1" />
                <p className="text-xl font-bold">{data?.summary?.avgDriverRating?.toFixed(2) || "0.00"}</p>
                <p className="text-xs text-muted-foreground">Avg Driver Rating</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <TrendingUp className="h-6 w-6 mx-auto text-purple-500 mb-1" />
                <p className="text-xl font-bold">{data?.summary?.avgRestaurantRating?.toFixed(2) || "0.00"}</p>
                <p className="text-xs text-muted-foreground">Avg Restaurant Rating</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <Flag className="h-6 w-6 mx-auto text-red-500 mb-1" />
                <p className="text-xl font-bold">{data?.summary?.flaggedReviews || 0}</p>
                <p className="text-xs text-muted-foreground">Flagged</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <TrendingDown className="h-6 w-6 mx-auto text-amber-500 mb-1" />
                <p className="text-xl font-bold">{data?.summary?.lowRatings || 0}</p>
                <p className="text-xs text-muted-foreground">Low Ratings (1-2)</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-flex">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="trends" data-testid="tab-trends">Trends</TabsTrigger>
            <TabsTrigger value="disputes" data-testid="tab-disputes">Disputes</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Driver Rating Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={chartData.driver}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" name="Count">
                        {chartData.driver.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={RATING_COLORS[entry.rating - 1]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Restaurant Rating Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={chartData.restaurant}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" name="Count">
                        {chartData.restaurant.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={RATING_COLORS[entry.rating - 1]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Filter className="h-5 w-5" />
                All Ratings & Reviews
              </CardTitle>
              <div className="flex flex-wrap gap-2">
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[140px]" data-testid="select-type-filter">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="driver">Driver</SelectItem>
                    <SelectItem value="restaurant">Restaurant</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={ratingFilter} onValueChange={setRatingFilter}>
                  <SelectTrigger className="w-[140px]" data-testid="select-rating-filter">
                    <SelectValue placeholder="Rating" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Ratings</SelectItem>
                    <SelectItem value="5">5 Stars</SelectItem>
                    <SelectItem value="4">4 Stars</SelectItem>
                    <SelectItem value="3">3 Stars</SelectItem>
                    <SelectItem value="2">2 Stars</SelectItem>
                    <SelectItem value="1">1 Star</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={severityFilter} onValueChange={setSeverityFilter}>
                  <SelectTrigger className="w-[140px]" data-testid="select-severity-filter">
                    <SelectValue placeholder="Severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="flagged">Flagged</SelectItem>
                    <SelectItem value="suspicious">Suspicious</SelectItem>
                    <SelectItem value="verified">Verified</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              <div className="space-y-3">
                {data?.ratings?.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No ratings found matching your filters</p>
                  </div>
                ) : (
                  data?.ratings?.map((rating) => (
                    <Card
                      key={rating.id}
                      className="hover-elevate cursor-pointer"
                      onClick={() => openDetailSheet(rating)}
                      data-testid={`card-rating-${rating.id}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div
                              className={`p-2 rounded-lg ${rating.type === "driver" ? "bg-blue-100 dark:bg-blue-900" : "bg-orange-100 dark:bg-orange-900"}`}
                            >
                              {rating.type === "driver" ? (
                                <Car className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                              ) : (
                                <Utensils className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                {renderStars(rating.rating)}
                                {getSeverityBadge(rating.severity, rating.isFlagged)}
                                {rating.isHidden && (
                                  <Badge variant="outline" className="text-gray-500">
                                    <EyeOff className="h-3 w-3 mr-1" />
                                    Hidden
                                  </Badge>
                                )}
                              </div>
                              <p className="font-medium">{rating.entityName}</p>
                              <p className="text-sm text-muted-foreground">
                                by {rating.raterName} • {new Date(rating.createdAt).toLocaleDateString()}
                              </p>
                              {rating.feedback && (
                                <p className="text-sm mt-1 line-clamp-2">{rating.feedback}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {!rating.isFlagged ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openActionDialog(rating, "flag");
                                }}
                                data-testid={`button-flag-${rating.id}`}
                              >
                                <Flag className="h-4 w-4 mr-1" />
                                Flag
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openActionDialog(rating, "verify");
                                }}
                                data-testid={`button-verify-${rating.id}`}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Verify
                              </Button>
                            )}
                            {rating.type === "restaurant" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openActionDialog(rating, rating.isHidden ? "unhide" : "hide");
                                }}
                                data-testid={`button-visibility-${rating.id}`}
                              >
                                {rating.isHidden ? (
                                  <>
                                    <Eye className="h-4 w-4 mr-1" />
                                    Show
                                  </>
                                ) : (
                                  <>
                                    <EyeOff className="h-4 w-4 mr-1" />
                                    Hide
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>

            {data?.pagination && data.pagination.total > 20 && (
              <div className="flex justify-center gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  data-testid="button-prev-page"
                >
                  Previous
                </Button>
                <span className="px-4 py-2 text-sm">
                  Page {currentPage} of {Math.ceil(data.pagination.total / 20)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => p + 1)}
                  disabled={currentPage >= Math.ceil(data.pagination.total / 20)}
                  data-testid="button-next-page"
                >
                  Next
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="trends" className="space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Rating Trends
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant={trendPeriod === "7d" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTrendPeriod("7d")}
                      data-testid="button-7d-trend"
                    >
                      7 Days
                    </Button>
                    <Button
                      variant={trendPeriod === "30d" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTrendPeriod("30d")}
                      data-testid="button-30d-trend"
                    >
                      30 Days
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {trendsLoading ? (
                  <Skeleton className="h-64" />
                ) : trendsData?.trends && trendsData.trends.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={trendsData.trends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tickFormatter={(d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })} />
                      <YAxis domain={[0, 5]} />
                      <Tooltip
                        labelFormatter={(d) => new Date(d).toLocaleDateString()}
                        formatter={(value: number, name: string) => [value.toFixed(2), name]}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="driverAvg" name="Driver Avg" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="restaurantAvg" name="Restaurant Avg" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                    <BarChart3 className="h-12 w-12 mb-2 opacity-50" />
                    <p>No trend data available</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Car className="h-4 w-4 text-blue-500" />
                    Driver Ratings Volume
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {trendsData?.trends.reduce((sum, t) => sum + t.driverCount, 0) || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">ratings in {trendPeriod}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Utensils className="h-4 w-4 text-orange-500" />
                    Restaurant Reviews Volume
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {trendsData?.trends.reduce((sum, t) => sum + t.restaurantCount, 0) || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">reviews in {trendPeriod}</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="disputes" className="space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Gavel className="h-5 w-5" />
                    Rating Disputes
                  </CardTitle>
                  <Select value={disputeFilter} onValueChange={setDisputeFilter}>
                    <SelectTrigger className="w-[160px]" data-testid="select-dispute-status">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="pending_info">Pending Info</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {disputesLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-20" />
                    ))}
                  </div>
                ) : disputesData?.disputes && disputesData.disputes.length > 0 ? (
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-3">
                      {disputesData.disputes.map((dispute) => (
                        <Card key={dispute.id} className="hover-elevate">
                          <CardContent className="p-4">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-mono text-sm text-primary">{dispute.ticketCode}</span>
                                  <Badge variant={dispute.status === "resolved" ? "secondary" : dispute.status === "open" ? "destructive" : "outline"}>
                                    {dispute.status}
                                  </Badge>
                                </div>
                                <p className="text-sm font-medium">{dispute.customerName}</p>
                                <p className="text-xs text-muted-foreground">Driver: {dispute.driverName}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs">Original Rating:</span>
                                  {renderStars(dispute.originalRating)}
                                </div>
                                <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{dispute.disputeReason}</p>
                              </div>
                              <div className="flex gap-2">
                                {dispute.status !== "resolved" && (
                                  <>
                                    <Button
                                      size="sm"
                                      onClick={() => openDisputeDialog(dispute, "resolve")}
                                      data-testid={`button-resolve-${dispute.id}`}
                                    >
                                      <CheckCircle className="h-4 w-4 mr-1" />
                                      Resolve
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => openDisputeDialog(dispute, "reject")}
                                      data-testid={`button-reject-${dispute.id}`}
                                    >
                                      Reject
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => openDisputeDialog(dispute, "request_info")}
                                      data-testid={`button-request-info-${dispute.id}`}
                                    >
                                      <Info className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                    <Gavel className="h-12 w-12 mb-2 opacity-50" />
                    <p>No rating disputes found</p>
                  </div>
                )}

                {disputesData?.pagination && disputesData.pagination.totalPages > 1 && (
                  <div className="flex justify-center gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDisputePage((p) => Math.max(1, p - 1))}
                      disabled={disputePage === 1}
                      data-testid="button-dispute-prev"
                    >
                      Previous
                    </Button>
                    <span className="px-4 py-2 text-sm">
                      Page {disputePage} of {disputesData.pagination.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDisputePage((p) => p + 1)}
                      disabled={disputePage >= disputesData.pagination.totalPages}
                      data-testid="button-dispute-next"
                    >
                      Next
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Sheet open={showDetailSheet} onOpenChange={(open) => !open && closeDetailSheet()}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {selectedRating?.type === "driver" ? (
                <Car className="h-5 w-5 text-blue-500" />
              ) : (
                <Utensils className="h-5 w-5 text-orange-500" />
              )}
              Rating Details
            </SheetTitle>
            <SheetDescription>
              {selectedRating?.type === "driver" ? "Driver" : "Restaurant"} rating from{" "}
              {selectedRating ? new Date(selectedRating.createdAt).toLocaleDateString() : ""}
            </SheetDescription>
          </SheetHeader>

          {selectedRating && (
            <div className="mt-6 space-y-6">
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Rating</h4>
                <div className="flex items-center gap-3">
                  {renderStars(selectedRating.rating)}
                  <span className="text-2xl font-bold">{selectedRating.rating}/5</span>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">
                  {selectedRating.type === "driver" ? "Driver" : "Restaurant"}
                </h4>
                <p className="font-medium">{selectedRating.entityName}</p>
              </div>

              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Reviewer</h4>
                <p>{selectedRating.raterName}</p>
              </div>

              {selectedRating.feedback && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Feedback</h4>
                  <p className="text-sm bg-muted p-3 rounded-lg">{selectedRating.feedback}</p>
                </div>
              )}

              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Status</h4>
                <div className="flex flex-wrap gap-2">
                  {getSeverityBadge(selectedRating.severity, selectedRating.isFlagged)}
                  {selectedRating.isHidden && (
                    <Badge variant="outline">
                      <EyeOff className="h-3 w-3 mr-1" />
                      Hidden
                    </Badge>
                  )}
                </div>
              </div>

              {selectedRating.flagReason && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Flag Reason</h4>
                  <p className="text-sm text-red-600">{selectedRating.flagReason}</p>
                </div>
              )}

              {linkedComplaints?.complaints && linkedComplaints.complaints.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Linked Complaints</h4>
                  <div className="space-y-2">
                    {linkedComplaints.complaints.map((complaint) => (
                      <Card key={complaint.id} className="p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">{complaint.ticketCode}</p>
                            <p className="text-xs text-muted-foreground">{complaint.subject}</p>
                          </div>
                          <Badge
                            variant={
                              complaint.severity === "critical"
                                ? "destructive"
                                : complaint.severity === "high"
                                  ? "default"
                                  : "secondary"
                            }
                          >
                            {complaint.severity}
                          </Badge>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-4 border-t">
                {!selectedRating.isFlagged ? (
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => openActionDialog(selectedRating, "flag")}
                    data-testid="button-detail-flag"
                  >
                    <Flag className="h-4 w-4 mr-2" />
                    Flag Review
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => openActionDialog(selectedRating, "verify")}
                    data-testid="button-detail-verify"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Verify & Unflag
                  </Button>
                )}
                {selectedRating.type === "restaurant" && (
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => openActionDialog(selectedRating, selectedRating.isHidden ? "unhide" : "hide")}
                    data-testid="button-detail-visibility"
                  >
                    {selectedRating.isHidden ? (
                      <>
                        <Eye className="h-4 w-4 mr-2" />
                        Show Review
                      </>
                    ) : (
                      <>
                        <EyeOff className="h-4 w-4 mr-2" />
                        Hide Review
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={showActionDialog} onOpenChange={(open) => !open && closeActionDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {actionType === "flag" && <Flag className="h-5 w-5 text-red-500" />}
              {actionType === "verify" && <CheckCircle className="h-5 w-5 text-green-500" />}
              {actionType === "hide" && <EyeOff className="h-5 w-5 text-gray-500" />}
              {actionType === "unhide" && <Eye className="h-5 w-5 text-blue-500" />}
              {actionType === "flag" && "Flag Review"}
              {actionType === "verify" && "Verify Review"}
              {actionType === "hide" && "Hide Review"}
              {actionType === "unhide" && "Show Review"}
            </DialogTitle>
            <DialogDescription>
              {actionType === "flag" && "Flag this review for further investigation."}
              {actionType === "verify" && "Mark this review as verified and remove the flag."}
              {actionType === "hide" && "Hide this review from public display."}
              {actionType === "unhide" && "Make this review visible to the public."}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">
              Reason {actionType === "flag" || actionType === "hide" ? "(required)" : "(optional)"}
            </label>
            <Textarea
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              placeholder={`Enter reason for ${actionType}...`}
              className="min-h-[100px]"
              data-testid="input-action-reason"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeActionDialog} data-testid="button-cancel-action">
              Cancel
            </Button>
            <Button
              onClick={handleAction}
              disabled={
                updateRatingMutation.isPending ||
                ((actionType === "flag" || actionType === "hide") && !actionReason.trim())
              }
              variant={actionType === "flag" ? "destructive" : "default"}
              data-testid="button-confirm-action"
            >
              {updateRatingMutation.isPending ? "Processing..." : `Confirm ${actionType}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDisputeDialog} onOpenChange={(open) => !open && closeDisputeDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gavel className="h-5 w-5" />
              {disputeAction === "resolve" && "Resolve Dispute"}
              {disputeAction === "reject" && "Reject Dispute"}
              {disputeAction === "request_info" && "Request More Information"}
            </DialogTitle>
            <DialogDescription>
              {disputeAction === "resolve" && "Approve this rating dispute and optionally update the rating."}
              {disputeAction === "reject" && "Reject this rating dispute with a reason."}
              {disputeAction === "request_info" && "Request additional information from the customer."}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {selectedDispute && (
              <div className="bg-muted p-3 rounded-lg text-sm">
                <p className="font-medium">{selectedDispute.ticketCode}</p>
                <p className="text-muted-foreground">Customer: {selectedDispute.customerName}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span>Current Rating:</span>
                  {renderStars(selectedDispute.originalRating)}
                </div>
              </div>
            )}

            {disputeAction === "resolve" && (
              <div>
                <Label className="text-sm font-medium mb-2 block">New Rating (optional)</Label>
                <Select
                  value={newRating?.toString() || ""}
                  onValueChange={(v) => setNewRating(v ? parseInt(v) : undefined)}
                >
                  <SelectTrigger data-testid="select-new-rating">
                    <SelectValue placeholder="Keep original rating" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Keep original rating</SelectItem>
                    <SelectItem value="5">5 Stars</SelectItem>
                    <SelectItem value="4">4 Stars</SelectItem>
                    <SelectItem value="3">3 Stars</SelectItem>
                    <SelectItem value="2">2 Stars</SelectItem>
                    <SelectItem value="1">1 Star</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label className="text-sm font-medium mb-2 block">
                {disputeAction === "resolve" ? "Resolution Notes" : disputeAction === "reject" ? "Rejection Reason" : "Information Requested"}
              </Label>
              <Textarea
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                placeholder={
                  disputeAction === "resolve"
                    ? "Enter resolution notes..."
                    : disputeAction === "reject"
                      ? "Enter reason for rejection..."
                      : "What information do you need?"
                }
                className="min-h-[100px]"
                data-testid="input-dispute-reason"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDisputeDialog} data-testid="button-cancel-dispute">
              Cancel
            </Button>
            <Button
              onClick={handleDisputeAction}
              disabled={resolveDisputeMutation.isPending || !disputeReason.trim()}
              variant={disputeAction === "reject" ? "destructive" : "default"}
              data-testid="button-confirm-dispute"
            >
              {resolveDisputeMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {disputeAction === "resolve" && "Approve & Resolve"}
                  {disputeAction === "reject" && "Reject Dispute"}
                  {disputeAction === "request_info" && "Send Request"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
