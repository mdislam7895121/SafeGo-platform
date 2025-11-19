import { useState } from "react";
import { Upload, X, FileText, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface FileUploadProps {
  label: string;
  accept?: string;
  maxSizeMB?: number;
  currentFileUrl?: string | null;
  onUpload: (file: File) => Promise<{ url: string }>;
  onDelete?: () => Promise<void>;
  disabled?: boolean;
  description?: string;
  testId?: string;
}

export function FileUpload({
  label,
  accept = "image/*",
  maxSizeMB = 5,
  currentFileUrl,
  onUpload,
  onDelete,
  disabled = false,
  description,
  testId = "file-upload",
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxSizeMB) {
      toast({
        title: "File too large",
        description: `File size must be less than ${maxSizeMB}MB`,
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      await onUpload(file);
      toast({
        title: "Upload successful",
        description: `${label} uploaded successfully`,
      });
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload file",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      // Reset input
      e.target.value = "";
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;

    setDeleting(true);
    try {
      await onDelete();
      toast({
        title: "File deleted",
        description: `${label} deleted successfully`,
      });
    } catch (error: any) {
      toast({
        title: "Delete failed",
        description: error.message || "Failed to delete file",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const isImage = accept.includes("image");

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}

      {currentFileUrl ? (
        <Card className="p-4">
          <div className="flex items-start gap-4">
            {isImage ? (
              <img
                src={currentFileUrl}
                alt={label}
                className="w-32 h-32 object-cover rounded-md border"
                data-testid={`${testId}-image`}
              />
            ) : (
              <div className="w-32 h-32 flex items-center justify-center bg-muted rounded-md border">
                <FileText className="h-12 w-12 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 space-y-2">
              <p className="text-sm text-muted-foreground">Current file</p>
              <a
                href={currentFileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline"
                data-testid={`${testId}-view-link`}
              >
                View file
              </a>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => document.getElementById(`${testId}-input`)?.click()}
                  disabled={disabled || uploading}
                  data-testid={`${testId}-replace`}
                >
                  {uploading ? "Uploading..." : "Replace"}
                </Button>
                {onDelete && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={disabled || deleting}
                    data-testid={`${testId}-delete`}
                  >
                    {deleting ? "Deleting..." : <X className="h-4 w-4" />}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <Button
          variant="outline"
          className="w-full h-32 border-dashed"
          onClick={() => document.getElementById(`${testId}-input`)?.click()}
          disabled={disabled || uploading}
          data-testid={`${testId}-button`}
        >
          <div className="flex flex-col items-center gap-2">
            {isImage ? (
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
            ) : (
              <FileText className="h-8 w-8 text-muted-foreground" />
            )}
            <p className="text-sm text-muted-foreground">
              {uploading ? "Uploading..." : `Click to upload ${label.toLowerCase()}`}
            </p>
            <p className="text-xs text-muted-foreground">
              Max {maxSizeMB}MB
            </p>
          </div>
        </Button>
      )}

      <input
        id={`${testId}-input`}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled || uploading}
      />
    </div>
  );
}
