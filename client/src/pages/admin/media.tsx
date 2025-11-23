import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { EyeOff, Eye, Flag, Filter, Image as ImageIcon, AlertCircle } from "lucide-react";

interface MediaItem {
  id: string;
  restaurantId: string;
  restaurantName: string;
  restaurantEmail: string;
  filePath: string;
  fileUrl: string | null;
  fileType: string;
  category: string;
  displayOrder: number;
  isHidden: boolean;
  hiddenByAdminId: string | null;
  hiddenAt: string | null;
  hideReason: string | null;
  isFlagged: boolean;
  flaggedByAdminId: string | null;
  flaggedAt: string | null;
  flagReason: string | null;
  createdAt: string;
}

interface MediaResponse {
  media: MediaItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const categoryLabels: Record<string, string> = {
  food: "Food",
  ambience: "Ambience",
  team: "Team",
  kitchen: "Kitchen",
  other: "Other",
};

export default function AdminMediaPage() {
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [filterHidden, setFilterHidden] = useState("all");
  const [filterFlagged, setFilterFlagged] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [moderationAction, setModerationAction] = useState<"hide" | "unhide" | "flag" | null>(null);
  const [reason, setReason] = useState("");

  // Fetch media
  const { data, isLoading } = useQuery<MediaResponse>({
    queryKey: ["/api/admin/media", selectedCategory, filterHidden, filterFlagged, currentPage],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "20",
      });
      if (selectedCategory !== "all") params.append("category", selectedCategory);
      if (filterHidden !== "all") params.append("isHidden", filterHidden);
      if (filterFlagged !== "all") params.append("isFlagged", filterFlagged);
      
      const response = await fetch(`/api/admin/media?${params}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch media");
      return response.json();
    },
  });

  const media = data?.media || [];
  const pagination = data?.pagination;

  // Hide mutation
  const hideMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      return await apiRequest(`/api/admin/media/${id}/hide`, "POST", { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/media"] });
      closeModerationDialog();
      toast({
        title: "Media Hidden",
        description: "The media has been hidden successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to hide media",
        variant: "destructive",
      });
    },
  });

  // Unhide mutation
  const unhideMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/admin/media/${id}/unhide`, "POST");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/media"] });
      closeModerationDialog();
      toast({
        title: "Media Restored",
        description: "The media has been restored successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to restore media",
        variant: "destructive",
      });
    },
  });

  // Flag mutation
  const flagMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      return await apiRequest(`/api/admin/media/${id}/flag`, "POST", { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/media"] });
      closeModerationDialog();
      toast({
        title: "Media Flagged",
        description: "The media has been flagged successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to flag media",
        variant: "destructive",
      });
    },
  });

  const openModerationDialog = (item: MediaItem, action: "hide" | "unhide" | "flag") => {
    setSelectedMedia(item);
    setModerationAction(action);
    setReason("");
  };

  const closeModerationDialog = () => {
    setSelectedMedia(null);
    setModerationAction(null);
    setReason("");
  };

  const handleModeration = () => {
    if (!selectedMedia || !moderationAction) return;

    if (moderationAction === "unhide") {
      unhideMutation.mutate(selectedMedia.id);
    } else if (moderationAction === "hide") {
      if (!reason.trim()) {
        toast({
          title: "Reason Required",
          description: "Please provide a reason for hiding this media",
          variant: "destructive",
        });
        return;
      }
      hideMutation.mutate({ id: selectedMedia.id, reason });
    } else if (moderationAction === "flag") {
      if (!reason.trim()) {
        toast({
          title: "Reason Required",
          description: "Please provide a reason for flagging this media",
          variant: "destructive",
        });
        return;
      }
      flagMutation.mutate({ id: selectedMedia.id, reason });
    }
  };

  const isSubmitting = hideMutation.isPending || unhideMutation.isPending || flagMutation.isPending;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Media Moderation</h1>
        <p className="text-muted-foreground">Manage restaurant media across the platform</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle>All Media</CardTitle>
            <div className="flex flex-wrap items-center gap-3">
              <Select
                value={selectedCategory}
                onValueChange={(value) => {
                  setSelectedCategory(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-40" data-testid="select-category-filter">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="food">Food</SelectItem>
                  <SelectItem value="ambience">Ambience</SelectItem>
                  <SelectItem value="team">Team</SelectItem>
                  <SelectItem value="kitchen">Kitchen</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filterHidden}
                onValueChange={(value) => {
                  setFilterHidden(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-40" data-testid="select-hidden-filter">
                  <SelectValue placeholder="Hidden Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Media</SelectItem>
                  <SelectItem value="hidden">Hidden Only</SelectItem>
                  <SelectItem value="visible">Visible Only</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filterFlagged}
                onValueChange={(value) => {
                  setFilterFlagged(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-40" data-testid="select-flagged-filter">
                  <SelectValue placeholder="Flagged Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Media</SelectItem>
                  <SelectItem value="flagged">Flagged Only</SelectItem>
                  <SelectItem value="unflagged">Unflagged Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array(6).fill(0).map((_, i) => (
                <Skeleton key={i} className="h-64 w-full" />
              ))}
            </div>
          ) : media.length === 0 ? (
            <div className="text-center py-12">
              <ImageIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No media found</h3>
              <p className="text-muted-foreground">
                {selectedCategory !== "all" || filterHidden !== "all" || filterFlagged !== "all"
                  ? "No media matches your filters"
                  : "No restaurant media yet"}
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {media.map((item) => (
                  <Card
                    key={item.id}
                    className={item.isHidden ? "opacity-60" : ""}
                    data-testid={`media-card-${item.id}`}
                  >
                    <div className="relative">
                      <img
                        src={item.fileUrl || item.filePath}
                        alt={`${item.restaurantName} ${item.category}`}
                        className="w-full h-48 object-cover rounded-t-lg"
                        data-testid={`img-${item.id}`}
                      />
                      <div className="absolute top-2 left-2 flex flex-col gap-2">
                        <Badge variant="secondary" data-testid={`badge-category-${item.id}`}>
                          {categoryLabels[item.category] || item.category}
                        </Badge>
                        {item.isHidden && (
                          <Badge variant="destructive" data-testid={`badge-hidden-${item.id}`}>
                            Hidden
                          </Badge>
                        )}
                        {item.isFlagged && (
                          <Badge variant="destructive" data-testid={`badge-flagged-${item.id}`}>
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Flagged
                          </Badge>
                        )}
                      </div>
                    </div>
                    <CardContent className="p-4 space-y-3">
                      <div>
                        <p className="font-semibold" data-testid={`text-restaurant-${item.id}`}>
                          {item.restaurantName}
                        </p>
                        <p className="text-sm text-muted-foreground" data-testid={`text-email-${item.id}`}>
                          {item.restaurantEmail}
                        </p>
                      </div>

                      {(item.hideReason || item.flagReason) && (
                        <div className="bg-muted p-2 rounded text-sm">
                          {item.hideReason && (
                            <p>
                              <span className="font-medium">Hide reason:</span> {item.hideReason}
                            </p>
                          )}
                          {item.flagReason && (
                            <p>
                              <span className="font-medium">Flag reason:</span> {item.flagReason}
                            </p>
                          )}
                        </div>
                      )}

                      <div className="flex gap-2">
                        {item.isHidden ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openModerationDialog(item, "unhide")}
                            className="flex-1"
                            data-testid={`button-unhide-${item.id}`}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Restore
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openModerationDialog(item, "hide")}
                            className="flex-1"
                            data-testid={`button-hide-${item.id}`}
                          >
                            <EyeOff className="h-4 w-4 mr-1" />
                            Hide
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openModerationDialog(item, "flag")}
                          className="flex-1"
                          data-testid={`button-flag-${item.id}`}
                        >
                          <Flag className="h-4 w-4 mr-1" />
                          Flag
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <p className="text-sm text-muted-foreground">
                    Showing {((pagination.page - 1) * pagination.limit) + 1} to{" "}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
                    {pagination.total} media items
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(currentPage - 1)}
                      data-testid="button-prev-page"
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      disabled={currentPage === pagination.totalPages}
                      onClick={() => setCurrentPage(currentPage + 1)}
                      data-testid="button-next-page"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Moderation Dialog */}
      {selectedMedia && moderationAction && (
        <Dialog open={!!selectedMedia} onOpenChange={(open) => !open && closeModerationDialog()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {moderationAction === "hide" ? "Hide Media" :
                 moderationAction === "unhide" ? "Restore Media" :
                 "Flag Media"}
              </DialogTitle>
              <DialogDescription>
                {moderationAction === "unhide"
                  ? "This media will become visible to customers again."
                  : `Provide a reason for ${moderationAction === "hide" ? "hiding" : "flagging"} this media.`}
              </DialogDescription>
            </DialogHeader>

            {moderationAction !== "unhide" && (
              <div className="space-y-2">
                <Label htmlFor="reason">Reason</Label>
                <Textarea
                  id="reason"
                  placeholder="Enter reason for moderation action..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="min-h-24"
                  data-testid="input-reason"
                />
              </div>
            )}

            <div className="bg-muted p-4 rounded-lg space-y-2">
              <p className="text-sm font-medium">Media Details:</p>
              <p className="text-sm text-muted-foreground">
                Restaurant: {selectedMedia.restaurantName}
              </p>
              <p className="text-sm text-muted-foreground">
                Email: {selectedMedia.restaurantEmail}
              </p>
              <p className="text-sm text-muted-foreground">
                Category: {categoryLabels[selectedMedia.category] || selectedMedia.category}
              </p>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={closeModerationDialog}
                disabled={isSubmitting}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                onClick={handleModeration}
                disabled={isSubmitting || (moderationAction !== "unhide" && !reason.trim())}
                data-testid="button-confirm"
              >
                {isSubmitting ? "Processing..." : 
                 moderationAction === "hide" ? "Hide Media" :
                 moderationAction === "unhide" ? "Restore Media" :
                 "Flag Media"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
