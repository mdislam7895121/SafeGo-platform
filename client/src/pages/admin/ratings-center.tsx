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
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

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

const RATING_COLORS = ["#ef4444", "#f97316", "#eab308", "#84cc16", "#22c55e"];

export default function RatingsCenter() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [typeFilter, setTypeFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  const [selectedRating, setSelectedRating] = useState<Rating | null>(null);
  const [showDetailSheet, setShowDetailSheet] = useState(false);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [actionType, setActionType] = useState<string>("");
  const [actionReason, setActionReason] = useState("");

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
            <h1 className="text-2xl font-bold">Ratings & Review Center</h1>
            <p className="text-sm opacity-90">Manage driver ratings and restaurant reviews</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
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
    </div>
  );
}
