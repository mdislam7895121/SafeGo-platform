import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { 
  FileText, 
  Upload, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle,
  Eye,
  RefreshCw,
  Camera,
  Car,
  Shield,
  CreditCard,
  FileCheck,
  ChevronRight,
  X,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface DocumentInfo {
  id: string;
  type: string;
  label: string;
  status: string;
  fileUrl: string | null;
  expiresAt: string | null;
  rejectionReason: string | null;
  required: boolean;
  uploadedAt?: string;
}

interface DocumentSummary {
  driverId: string;
  countryCode: string;
  documents: DocumentInfo[];
  overallStatus: "incomplete" | "pending_review" | "approved" | "rejected" | "needs_update";
  completedCount: number;
  requiredCount: number;
  pendingCount: number;
  rejectedCount: number;
}

const STATUS_CONFIG: Record<string, { icon: React.ComponentType<any>; color: string; label: string; bgColor: string }> = {
  PENDING: { icon: Clock, color: "text-yellow-600", label: "Pending", bgColor: "bg-yellow-50 dark:bg-yellow-950" },
  UNDER_REVIEW: { icon: Clock, color: "text-blue-600", label: "Under Review", bgColor: "bg-blue-50 dark:bg-blue-950" },
  APPROVED: { icon: CheckCircle2, color: "text-green-600", label: "Approved", bgColor: "bg-green-50 dark:bg-green-950" },
  REJECTED: { icon: XCircle, color: "text-red-600", label: "Rejected", bgColor: "bg-red-50 dark:bg-red-950" },
  NEEDS_UPDATE: { icon: AlertTriangle, color: "text-orange-600", label: "Needs Update", bgColor: "bg-orange-50 dark:bg-orange-950" },
  EXPIRING_SOON: { icon: AlertTriangle, color: "text-orange-600", label: "Expiring Soon", bgColor: "bg-orange-50 dark:bg-orange-950" },
  EXPIRED: { icon: XCircle, color: "text-red-600", label: "Expired", bgColor: "bg-red-50 dark:bg-red-950" },
};

const DOCUMENT_ICONS: Record<string, React.ComponentType<any>> = {
  profile_photo: Camera,
  driver_license: CreditCard,
  tlc_license: CreditCard,
  nid: CreditCard,
  insurance: Shield,
  registration: Car,
  vehicle_inspection: FileCheck,
};

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;
  const Icon = config.icon;
  
  return (
    <Badge 
      variant="outline" 
      className={`${config.color} ${config.bgColor} border-0`}
      data-testid={`badge-status-${status.toLowerCase()}`}
    >
      <Icon className="w-3 h-3 mr-1" />
      {config.label}
    </Badge>
  );
}

function DocumentCard({ 
  doc, 
  onUpload, 
  onPreview 
}: { 
  doc: DocumentInfo;
  onUpload: (docType: string) => void;
  onPreview: (fileUrl: string, label: string) => void;
}) {
  const Icon = DOCUMENT_ICONS[doc.type] || FileText;
  const hasFile = !!doc.fileUrl;
  const isRejected = doc.status === "REJECTED";
  const needsUpload = !hasFile || isRejected || doc.status === "NEEDS_UPDATE";

  return (
    <Card 
      className={`hover-elevate ${isRejected ? "border-red-200 dark:border-red-800" : ""}`}
      data-testid={`card-document-${doc.type}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-lg ${hasFile && !isRejected ? "bg-primary/10" : "bg-muted"}`}>
            <Icon className={`w-5 h-5 ${hasFile && !isRejected ? "text-primary" : "text-muted-foreground"}`} />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <h3 className="font-medium text-foreground truncate">
                {doc.label}
              </h3>
              <StatusBadge status={doc.status} />
            </div>
            
            {doc.required && (
              <span className="text-xs text-muted-foreground">Required</span>
            )}
            
            {doc.expiresAt && (
              <p className="text-xs text-muted-foreground mt-1">
                Expires: {new Date(doc.expiresAt).toLocaleDateString()}
              </p>
            )}
            
            {isRejected && doc.rejectionReason && (
              <div className="mt-2 p-2 bg-red-50 dark:bg-red-950 rounded-md">
                <p className="text-xs text-red-700 dark:text-red-300">
                  <strong>Reason:</strong> {doc.rejectionReason}
                </p>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex gap-2 mt-4">
          {hasFile && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => onPreview(doc.fileUrl!, doc.label)}
              data-testid={`button-preview-${doc.type}`}
            >
              <Eye className="w-4 h-4 mr-1" />
              View
            </Button>
          )}
          
          {needsUpload && (
            <Button 
              size="sm"
              onClick={() => onUpload(doc.type)}
              variant={isRejected ? "destructive" : "default"}
              data-testid={`button-upload-${doc.type}`}
            >
              {isRejected ? <RefreshCw className="w-4 h-4 mr-1" /> : <Upload className="w-4 h-4 mr-1" />}
              {hasFile ? "Re-upload" : "Upload"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function UploadDialog({
  isOpen,
  onClose,
  documentType,
  documentLabel,
  onUpload,
  isUploading,
}: {
  isOpen: boolean;
  onClose: () => void;
  documentType: string;
  documentLabel: string;
  onUpload: (file: File, expiresAt?: string) => void;
  isUploading: boolean;
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [expiresAt, setExpiresAt] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const requiresExpiry = ["driver_license", "tlc_license", "insurance", "registration", "vehicle_inspection"].includes(documentType);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert("File size must be less than 10MB");
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleSubmit = () => {
    if (!selectedFile) return;
    onUpload(selectedFile, requiresExpiry ? expiresAt : undefined);
  };

  const handleClose = () => {
    setSelectedFile(null);
    setExpiresAt("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload {documentLabel}</DialogTitle>
          <DialogDescription>
            Select a file to upload. Accepted formats: JPG, PNG, PDF (max 10MB)
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file-upload">Document File</Label>
            <input
              ref={fileInputRef}
              type="file"
              id="file-upload"
              accept="image/*,.pdf"
              onChange={handleFileChange}
              className="hidden"
              data-testid="input-file-upload"
            />
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
            >
              {selectedFile ? (
                <div className="flex items-center justify-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  <span className="text-sm font-medium">{selectedFile.name}</span>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Click to select a file
                  </p>
                </>
              )}
            </div>
          </div>
          
          {requiresExpiry && (
            <div className="space-y-2">
              <Label htmlFor="expires-at">Expiration Date (Optional)</Label>
              <Input
                id="expires-at"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                data-testid="input-expires-at"
              />
            </div>
          )}
        </div>
        
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={handleClose} disabled={isUploading}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!selectedFile || isUploading}
            data-testid="button-submit-upload"
          >
            {isUploading ? (
              <>
                <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-1" />
                Upload
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PreviewDialog({
  isOpen,
  onClose,
  fileUrl,
  label,
}: {
  isOpen: boolean;
  onClose: () => void;
  fileUrl: string;
  label: string;
}) {
  const isPdf = fileUrl.toLowerCase().endsWith(".pdf");

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
        </DialogHeader>
        
        <div className="flex items-center justify-center bg-muted rounded-lg overflow-hidden min-h-[400px]">
          {isPdf ? (
            <iframe
              src={fileUrl}
              className="w-full h-[600px]"
              title={label}
            />
          ) : (
            <img
              src={fileUrl}
              alt={label}
              className="max-w-full max-h-[600px] object-contain"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function DriverDocuments() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadDocType, setUploadDocType] = useState("");
  const [uploadDocLabel, setUploadDocLabel] = useState("");
  
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewLabel, setPreviewLabel] = useState("");

  const { data: summaryData, isLoading, error } = useQuery<{ success: boolean; data: DocumentSummary }>({
    queryKey: ["/api/driver/documents/summary"],
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ docType, file, expiresAt }: { docType: string; file: File; expiresAt?: string }) => {
      const formData = new FormData();
      formData.append("document", file);
      if (expiresAt) {
        formData.append("expiresAt", expiresAt);
      }
      
      const response = await fetch(`/api/driver/documents/upload/${docType}`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Upload failed");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Document Uploaded",
        description: "Your document has been uploaded and is pending review.",
      });
      setUploadDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/driver/documents/summary"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleOpenUpload = (docType: string) => {
    const doc = summaryData?.data?.documents.find(d => d.type === docType);
    setUploadDocType(docType);
    setUploadDocLabel(doc?.label || docType.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()));
    setUploadDialogOpen(true);
  };

  const handleUpload = (file: File, expiresAt?: string) => {
    uploadMutation.mutate({ docType: uploadDocType, file, expiresAt });
  };

  const handlePreview = (fileUrl: string, label: string) => {
    setPreviewUrl(fileUrl);
    setPreviewLabel(label);
    setPreviewOpen(true);
  };

  if (isLoading) {
    return (
      <div className="container max-w-4xl mx-auto p-4 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !summaryData?.success) {
    return (
      <div className="container max-w-4xl mx-auto p-4">
        <Card>
          <CardContent className="p-8 text-center">
            <XCircle className="w-12 h-12 mx-auto text-destructive mb-4" />
            <h2 className="text-lg font-semibold mb-2">Unable to Load Documents</h2>
            <p className="text-muted-foreground mb-4">
              Please make sure you have completed your driver profile setup first.
            </p>
            <Button onClick={() => navigate("/driver/kyc-documents")}>
              Go to KYC Setup
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const summary = summaryData.data;
  const progressPercent = summary.requiredCount > 0 
    ? Math.round((summary.completedCount / summary.requiredCount) * 100) 
    : 0;

  const requiredDocs = summary.documents.filter(d => d.required);
  const optionalDocs = summary.documents.filter(d => !d.required);

  return (
    <div className="container max-w-4xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">
            Document Center
          </h1>
          <p className="text-muted-foreground">
            Manage and track your driver documents
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => navigate("/driver/dashboard")}
          data-testid="button-back-dashboard"
        >
          <ChevronRight className="w-4 h-4 mr-1 rotate-180" />
          Back
        </Button>
      </div>

      <Card data-testid="card-progress-summary">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Verification Progress</CardTitle>
            <StatusBadge status={summary.overallStatus === "approved" ? "APPROVED" : 
              summary.overallStatus === "rejected" ? "REJECTED" : 
              summary.overallStatus === "pending_review" ? "UNDER_REVIEW" : "PENDING"} 
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Progress value={progressPercent} className="h-2" />
            
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {summary.completedCount} of {summary.requiredCount} required documents approved
              </span>
              <span className="font-medium">{progressPercent}%</span>
            </div>
            
            <div className="flex gap-4 flex-wrap">
              {summary.pendingCount > 0 && (
                <div className="flex items-center gap-1 text-sm">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span>{summary.pendingCount} pending review</span>
                </div>
              )}
              {summary.rejectedCount > 0 && (
                <div className="flex items-center gap-1 text-sm">
                  <XCircle className="w-4 h-4 text-red-600" />
                  <span className="text-red-600 font-medium">{summary.rejectedCount} rejected</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {requiredDocs.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Required Documents</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {requiredDocs.map(doc => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                onUpload={handleOpenUpload}
                onPreview={handlePreview}
              />
            ))}
          </div>
        </div>
      )}

      {optionalDocs.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Additional Documents</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {optionalDocs.map(doc => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                onUpload={handleOpenUpload}
                onPreview={handlePreview}
              />
            ))}
          </div>
        </div>
      )}

      <UploadDialog
        isOpen={uploadDialogOpen}
        onClose={() => setUploadDialogOpen(false)}
        documentType={uploadDocType}
        documentLabel={uploadDocLabel}
        onUpload={handleUpload}
        isUploading={uploadMutation.isPending}
      />

      <PreviewDialog
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        fileUrl={previewUrl}
        label={previewLabel}
      />
    </div>
  );
}
