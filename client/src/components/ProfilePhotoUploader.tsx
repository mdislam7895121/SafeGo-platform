import { useState, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Camera, Trash2, Loader2, Upload, User, AlertCircle } from "lucide-react";
import { uploadWithAuth, apiRequest } from "@/lib/queryClient";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

interface ProfilePhotoUploaderProps {
  currentPhotoUrl?: string | null;
  currentThumbnailUrl?: string | null;
  userName: string;
  role: "customer" | "driver" | "restaurant" | "admin";
  size?: "sm" | "md" | "lg" | "xl";
  onPhotoUpdated?: () => void;
}

const sizeClasses = {
  sm: "h-12 w-12",
  md: "h-16 w-16",
  lg: "h-24 w-24",
  xl: "h-32 w-32",
};

const iconSizes = {
  sm: "h-3 w-3",
  md: "h-4 w-4",
  lg: "h-5 w-5",
  xl: "h-6 w-6",
};

export function ProfilePhotoUploader({
  currentPhotoUrl,
  currentThumbnailUrl,
  userName,
  role,
  size = "lg",
  onPhotoUpdated,
}: ProfilePhotoUploaderProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { data: photoData, refetch: refetchPhoto } = useQuery({
    queryKey: ["/api/profile/my-photo"],
    enabled: !currentPhotoUrl,
  });

  const displayPhotoUrl = currentPhotoUrl || (photoData as any)?.profile_photo_url;
  const displayThumbnailUrl = currentThumbnailUrl || (photoData as any)?.profile_photo_thumbnail;

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      return uploadWithAuth("/api/profile/upload-photo", formData);
    },
    onSuccess: (data) => {
      toast({
        title: "Photo updated",
        description: data.message || "Your profile picture has been updated.",
      });
      setShowUploadDialog(false);
      setPreviewUrl(null);
      setSelectedFile(null);
      setUploadError(null);
      refetchPhoto();
      queryClient.invalidateQueries({ queryKey: ["/api/profile/my-photo"] });
      queryClient.invalidateQueries({ queryKey: [`/api/${role}/home`] });
      queryClient.invalidateQueries({ queryKey: [`/api/${role}/profile`] });
      onPhotoUpdated?.();
    },
    onError: (error: Error) => {
      setUploadError(error.message);
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/profile/remove-photo", { method: "DELETE" });
    },
    onSuccess: (data) => {
      toast({
        title: "Photo removed",
        description: data.message || "Your profile picture has been removed.",
      });
      setShowDeleteConfirm(false);
      refetchPhoto();
      queryClient.invalidateQueries({ queryKey: ["/api/profile/my-photo"] });
      queryClient.invalidateQueries({ queryKey: [`/api/${role}/home`] });
      queryClient.invalidateQueries({ queryKey: [`/api/${role}/profile`] });
      onPhotoUpdated?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      setUploadError("Invalid file type. Only JPEG, PNG, and WebP images are allowed.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError("File too large. Maximum size is 5MB.");
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
    setShowUploadDialog(true);
  };

  const handleUpload = () => {
    if (selectedFile) {
      uploadMutation.mutate(selectedFile);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <>
      <div className="relative inline-block group">
        <Avatar
          className={`${sizeClasses[size]} cursor-pointer border-2 border-border hover:border-primary transition-colors`}
          onClick={handleAvatarClick}
          data-testid="avatar-profile-photo"
        >
          <AvatarImage
            src={displayThumbnailUrl || displayPhotoUrl || undefined}
            alt={userName}
          />
          <AvatarFallback className="bg-muted">
            {userName ? getInitials(userName) : <User className={iconSizes[size]} />}
          </AvatarFallback>
        </Avatar>

        <div
          className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
          onClick={handleAvatarClick}
        >
          <Camera className={`${iconSizes[size]} text-white`} />
        </div>

        {displayPhotoUrl && (
          <Button
            variant="destructive"
            size="icon"
            className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              setShowDeleteConfirm(true);
            }}
            data-testid="button-delete-photo"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          className="hidden"
          onChange={handleFileSelect}
          data-testid="input-photo-file"
        />
      </div>

      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Profile Photo</DialogTitle>
            <DialogDescription>
              Preview your new profile picture before uploading.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-4 py-4">
            {previewUrl && (
              <div className="relative">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-48 h-48 rounded-full object-cover border-4 border-border"
                />
              </div>
            )}

            {uploadError && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="h-4 w-4" />
                <span>{uploadError}</span>
              </div>
            )}
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowUploadDialog(false);
                setPreviewUrl(null);
                setSelectedFile(null);
                setUploadError(null);
              }}
              data-testid="button-cancel-upload"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={uploadMutation.isPending || !selectedFile}
              data-testid="button-confirm-upload"
            >
              {uploadMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Photo
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Profile Photo?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove your profile photo? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Removing...
                </>
              ) : (
                "Remove Photo"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
