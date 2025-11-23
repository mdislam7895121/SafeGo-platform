import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Upload, Trash2, Image as ImageIcon, Tag, AlertCircle, ArrowUp, ArrowDown } from "lucide-react";

interface RestaurantMedia {
  id: string;
  restaurantId: string;
  filePath: string;
  fileUrl: string | null;
  fileType: string;
  category: "food" | "ambience" | "team" | "kitchen" | "other";
  displayOrder: number;
  isHidden: boolean;
  isFlagged: boolean;
  createdAt: string;
}

const categoryLabels = {
  food: "Food",
  ambience: "Ambience",
  team: "Team",
  kitchen: "Kitchen",
  other: "Other",
};

const categoryColors = {
  food: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  ambience: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  team: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  kitchen: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  other: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

export default function RestaurantGalleryPage() {
  const { toast } = useToast();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [editMediaId, setEditMediaId] = useState<string | null>(null);
  const [deleteMediaId, setDeleteMediaId] = useState<string | null>(null);
  
  // Upload form state
  const [uploadUrl, setUploadUrl] = useState("");
  const [uploadCategory, setUploadCategory] = useState<string>("food");
  
  // Edit form state
  const [editCategory, setEditCategory] = useState<string>("food");

  // Fetch restaurant profile to check permissions
  const { data: profile, isLoading: profileLoading, error: profileError } = useQuery<{ ownerRole: string; canViewAnalytics: boolean }>({
    queryKey: ["/api/restaurant/profile"],
  });

  // Strict permission checks - default to deny
  const isOwner = profile?.ownerRole === "OWNER";
  const canViewGallery = isOwner || profile?.canViewAnalytics === true;
  const canManageGallery = isOwner; // Only OWNER can upload/edit/delete

  // Fetch gallery
  const { data: media = [], isLoading } = useQuery<RestaurantMedia[]>({
    queryKey: ["/api/restaurant/gallery"],
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest<RestaurantMedia>("/api/restaurant/gallery/upload", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/gallery"] });
      setUploadDialogOpen(false);
      setUploadUrl("");
      setUploadCategory("food");
      toast({
        title: "Media Uploaded",
        description: "Your image has been added to the gallery.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload media",
        variant: "destructive",
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return await apiRequest<RestaurantMedia>(`/api/restaurant/gallery/${id}`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/gallery"] });
      setEditMediaId(null);
      toast({
        title: "Media Updated",
        description: "Category has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update media",
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/restaurant/gallery/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/gallery"] });
      setDeleteMediaId(null);
      toast({
        title: "Media Deleted",
        description: "The image has been removed from your gallery.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete media",
        variant: "destructive",
      });
    },
  });

  const handleUpload = () => {
    if (!uploadUrl) {
      toast({
        title: "URL Required",
        description: "Please enter an image URL",
        variant: "destructive",
      });
      return;
    }

    uploadMutation.mutate({
      filePath: uploadUrl,
      fileUrl: uploadUrl,
      fileType: "image",
      category: uploadCategory,
    });
  };

  const handleUpdateCategory = () => {
    if (editMediaId) {
      updateMutation.mutate({
        id: editMediaId,
        data: { category: editCategory },
      });
    }
  };

  const handleDelete = () => {
    if (deleteMediaId) {
      deleteMutation.mutate(deleteMediaId);
    }
  };

  const moveMedia = async (mediaId: string, direction: "up" | "down") => {
    const currentIndex = activeMedia.findIndex((m) => m.id === mediaId);
    if (currentIndex === -1) return;

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= activeMedia.length) return;

    const currentItem = activeMedia[currentIndex];
    const targetItem = activeMedia[targetIndex];

    // Swap display orders
    await Promise.all([
      updateMutation.mutateAsync({
        id: currentItem.id,
        data: { displayOrder: targetItem.displayOrder },
      }),
      updateMutation.mutateAsync({
        id: targetItem.id,
        data: { displayOrder: currentItem.displayOrder },
      }),
    ]);
  };

  const openEditDialog = (mediaItem: RestaurantMedia) => {
    setEditMediaId(mediaItem.id);
    setEditCategory(mediaItem.category);
  };

  // Show loading while profile or gallery is loading
  if (isLoading || profileLoading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array(6).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      </div>
    );
  }

  // Handle profile fetch errors
  if (profileError) {
    return (
      <div className="p-6">
        <Card className="border-destructive">
          <CardContent className="p-6">
            <h3 className="font-semibold text-destructive mb-2">Profile Error</h3>
            <p className="text-sm">Failed to load your permissions. Please refresh the page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Deny access if staff without canViewAnalytics
  if (!canViewGallery) {
    return (
      <div className="p-6">
        <Card className="border-destructive">
          <CardContent className="p-6">
            <h3 className="font-semibold text-destructive mb-2">Access Denied</h3>
            <p className="text-sm">You don't have permission to view the gallery. Contact the restaurant owner.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeMedia = media.filter((m) => !m.isHidden);
  const hiddenMedia = media.filter((m) => m.isHidden);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Media Gallery</h1>
          <p className="text-muted-foreground">
            {canManageGallery ? `Manage your restaurant's photos (${activeMedia.length}/50)` : "View restaurant photos"}
          </p>
        </div>
        {canManageGallery && (
          <Button
            onClick={() => setUploadDialogOpen(true)}
            disabled={media.length >= 50}
            data-testid="button-upload-media"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload Photo
          </Button>
        )}
      </div>

      {media.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <ImageIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No photos yet</h3>
              <p className="text-muted-foreground mb-4">
                Upload photos to showcase your restaurant to customers
              </p>
              {canManageGallery ? (
                <Button onClick={() => setUploadDialogOpen(true)} data-testid="button-upload-first">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Your First Photo
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Contact the owner to upload photos
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Active Photos */}
          {activeMedia.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Active Photos</CardTitle>
                <CardDescription>
                  These photos are visible to customers
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activeMedia.map((item) => (
                    <div
                      key={item.id}
                      className="relative group rounded-lg overflow-hidden border"
                      data-testid={`media-item-${item.id}`}
                    >
                      <img
                        src={item.fileUrl || item.filePath}
                        alt={`Gallery ${item.category}`}
                        className="w-full h-48 object-cover"
                        data-testid={`img-media-${item.id}`}
                      />
                      <div className="absolute top-2 left-2">
                        <Badge className={categoryColors[item.category]} data-testid={`badge-category-${item.id}`}>
                          {categoryLabels[item.category]}
                        </Badge>
                      </div>
                      {item.isFlagged && (
                        <div className="absolute top-2 right-2">
                          <Badge variant="destructive" data-testid={`badge-flagged-${item.id}`}>
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Flagged
                          </Badge>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                        {canManageGallery && (
                          <div className="flex gap-2 mb-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => moveMedia(item.id, "up")}
                              disabled={activeMedia.indexOf(item) === 0}
                              data-testid={`button-move-up-${item.id}`}
                            >
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => moveMedia(item.id, "down")}
                              disabled={activeMedia.indexOf(item) === activeMedia.length - 1}
                              data-testid={`button-move-down-${item.id}`}
                            >
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                        {canManageGallery && (
                          <>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => openEditDialog(item)}
                              data-testid={`button-edit-${item.id}`}
                            >
                              <Tag className="h-4 w-4 mr-1" />
                              Tag
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => setDeleteMediaId(item.id)}
                              data-testid={`button-delete-${item.id}`}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Delete
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Hidden Photos (Admin-moderated) */}
          {hiddenMedia.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Hidden Photos</CardTitle>
                <CardDescription>
                  These photos were hidden by administration
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {hiddenMedia.map((item) => (
                    <div
                      key={item.id}
                      className="relative rounded-lg overflow-hidden border opacity-50"
                      data-testid={`hidden-media-${item.id}`}
                    >
                      <img
                        src={item.fileUrl || item.filePath}
                        alt={`Hidden ${item.category}`}
                        className="w-full h-48 object-cover"
                      />
                      <div className="absolute top-2 left-2">
                        <Badge variant="secondary">Hidden by Admin</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Photo</DialogTitle>
            <DialogDescription>
              Add a new photo to your restaurant gallery
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="imageUrl">Image URL</Label>
              <Input
                id="imageUrl"
                type="url"
                placeholder="https://example.com/image.jpg"
                value={uploadUrl}
                onChange={(e) => setUploadUrl(e.target.value)}
                data-testid="input-upload-url"
              />
              {uploadUrl && (
                <div className="mt-2">
                  <img
                    src={uploadUrl}
                    alt="Preview"
                    className="h-32 w-full object-cover rounded-md border"
                    onError={() => {
                      toast({
                        title: "Invalid Image",
                        description: "Unable to load image from URL",
                        variant: "destructive",
                      });
                    }}
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={uploadCategory} onValueChange={setUploadCategory}>
                <SelectTrigger data-testid="select-upload-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="food">Food</SelectItem>
                  <SelectItem value="ambience">Ambience</SelectItem>
                  <SelectItem value="team">Team</SelectItem>
                  <SelectItem value="kitchen">Kitchen</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUploadDialogOpen(false)}
              data-testid="button-cancel-upload"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={uploadMutation.isPending || !uploadUrl}
              data-testid="button-confirm-upload"
            >
              {uploadMutation.isPending ? "Uploading..." : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Category Dialog */}
      <Dialog open={!!editMediaId} onOpenChange={(open) => !open && setEditMediaId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Category</DialogTitle>
            <DialogDescription>
              Update the category tag for this photo
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-2">
            <Label htmlFor="editCategory">Category</Label>
            <Select value={editCategory} onValueChange={setEditCategory}>
              <SelectTrigger data-testid="select-edit-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="food">Food</SelectItem>
                <SelectItem value="ambience">Ambience</SelectItem>
                <SelectItem value="team">Team</SelectItem>
                <SelectItem value="kitchen">Kitchen</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditMediaId(null)}
              data-testid="button-cancel-edit"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateCategory}
              disabled={updateMutation.isPending}
              data-testid="button-confirm-edit"
            >
              {updateMutation.isPending ? "Updating..." : "Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteMediaId} onOpenChange={(open) => !open && setDeleteMediaId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Photo</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this photo? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteMediaId(null)}
              data-testid="button-cancel-delete"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
