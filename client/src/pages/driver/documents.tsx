import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { Link, useLocation } from "wouter";
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
  Lock,
  Building,
  User,
  EyeOff,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
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
  description?: string;
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

interface DriverProfile {
  usaCity?: string;
  state?: string;
  countryCode?: string;
  ssnLast4?: string;
  ssnVerified?: boolean;
  profilePhotoUrl?: string;
}

const STATUS_CONFIG: Record<string, { icon: React.ComponentType<any>; color: string; label: string; bgColor: string }> = {
  NOT_SUBMITTED: { icon: Upload, color: "text-gray-600", label: "Not Submitted", bgColor: "bg-gray-50 dark:bg-gray-900" },
  PENDING: { icon: Clock, color: "text-yellow-600", label: "Pending", bgColor: "bg-yellow-50 dark:bg-yellow-950" },
  UNDER_REVIEW: { icon: Clock, color: "text-blue-600", label: "Under Review", bgColor: "bg-blue-50 dark:bg-blue-950" },
  APPROVED: { icon: CheckCircle2, color: "text-green-600", label: "Approved", bgColor: "bg-green-50 dark:bg-green-950" },
  REJECTED: { icon: XCircle, color: "text-red-600", label: "Rejected", bgColor: "bg-red-50 dark:bg-red-950" },
  NEEDS_UPDATE: { icon: AlertTriangle, color: "text-orange-600", label: "Needs Update", bgColor: "bg-orange-50 dark:bg-orange-950" },
  EXPIRING_SOON: { icon: AlertTriangle, color: "text-orange-600", label: "Expiring Soon", bgColor: "bg-orange-50 dark:bg-orange-950" },
  EXPIRED: { icon: XCircle, color: "text-red-600", label: "Expired", bgColor: "bg-red-50 dark:bg-red-950" },
  VERIFIED: { icon: CheckCircle2, color: "text-green-600", label: "Verified", bgColor: "bg-green-50 dark:bg-green-950" },
};

const DOCUMENT_ICONS: Record<string, React.ComponentType<any>> = {
  profile_photo: Camera,
  driver_license: CreditCard,
  driver_license_front: CreditCard,
  driver_license_back: CreditCard,
  tlc_license: Building,
  nid: CreditCard,
  insurance: Shield,
  vehicle_insurance: Shield,
  registration: Car,
  vehicle_registration: Car,
  vehicle_inspection: FileCheck,
  ssn: Lock,
};

const DEFAULT_DOCUMENTS: DocumentInfo[] = [
  {
    id: "driver_license_front",
    type: "driver_license_front",
    label: "Driver License (Front)",
    description: "Upload the front side of your driver license showing your photo and details.",
    status: "NOT_SUBMITTED",
    fileUrl: null,
    expiresAt: null,
    rejectionReason: null,
    required: true,
  },
  {
    id: "driver_license_back",
    type: "driver_license_back",
    label: "Driver License (Back)",
    description: "Upload the back side of your driver license with barcode.",
    status: "NOT_SUBMITTED",
    fileUrl: null,
    expiresAt: null,
    rejectionReason: null,
    required: true,
  },
  {
    id: "vehicle_registration",
    type: "vehicle_registration",
    label: "Vehicle Registration",
    description: "Upload your current vehicle registration document.",
    status: "NOT_SUBMITTED",
    fileUrl: null,
    expiresAt: null,
    rejectionReason: null,
    required: true,
  },
  {
    id: "vehicle_insurance",
    type: "vehicle_insurance",
    label: "Vehicle Insurance",
    description: "Upload proof of valid vehicle insurance coverage.",
    status: "NOT_SUBMITTED",
    fileUrl: null,
    expiresAt: null,
    rejectionReason: null,
    required: true,
  },
  {
    id: "profile_photo",
    type: "profile_photo",
    label: "Profile Picture",
    description: "Upload a clear photo of yourself for passengers to identify you.",
    status: "NOT_SUBMITTED",
    fileUrl: null,
    expiresAt: null,
    rejectionReason: null,
    required: true,
  },
];

const TLC_DOCUMENT: DocumentInfo = {
  id: "tlc_license",
  type: "tlc_license",
  label: "TLC License",
  description: "Upload your NYC Taxi and Limousine Commission license (required for NYC drivers).",
  status: "NOT_SUBMITTED",
  fileUrl: null,
  expiresAt: null,
  rejectionReason: null,
  required: true,
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
  onUpload: (docType: string, label: string) => void;
  onPreview: (fileUrl: string, label: string) => void;
}) {
  const Icon = DOCUMENT_ICONS[doc.type] || FileText;
  const hasFile = !!doc.fileUrl;
  const isRejected = doc.status === "REJECTED";
  const isNotSubmitted = doc.status === "NOT_SUBMITTED";
  const needsUpload = isNotSubmitted || isRejected || doc.status === "NEEDS_UPDATE";
  const isExpiringSoon = doc.expiresAt && new Date(doc.expiresAt) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  return (
    <Card 
      className={`hover-elevate transition-all ${isRejected ? "border-red-200 dark:border-red-800" : ""}`}
      data-testid={`card-document-${doc.type}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-lg flex-shrink-0 ${
            hasFile && !isRejected && !isNotSubmitted 
              ? "bg-primary/10" 
              : isRejected 
                ? "bg-red-100 dark:bg-red-950" 
                : "bg-muted"
          }`}>
            <Icon className={`w-5 h-5 ${
              hasFile && !isRejected && !isNotSubmitted 
                ? "text-primary" 
                : isRejected 
                  ? "text-red-600" 
                  : "text-muted-foreground"
            }`} />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className="font-medium text-foreground">
                {doc.label}
              </h3>
              <StatusBadge status={doc.status} />
            </div>
            
            {doc.description && (
              <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                {doc.description}
              </p>
            )}
            
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {doc.required && (
                <span className="bg-primary/10 text-primary px-2 py-0.5 rounded">Required</span>
              )}
              {doc.expiresAt && (
                <span className={`px-2 py-0.5 rounded ${
                  isExpiringSoon 
                    ? "bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-400" 
                    : "bg-muted"
                }`}>
                  Expires: {new Date(doc.expiresAt).toLocaleDateString()}
                </span>
              )}
              {doc.uploadedAt && (
                <span>
                  Uploaded: {new Date(doc.uploadedAt).toLocaleDateString()}
                </span>
              )}
            </div>
            
            {isRejected && doc.rejectionReason && (
              <div className="mt-3 p-2 bg-red-50 dark:bg-red-950 rounded-md border border-red-200 dark:border-red-800">
                <p className="text-xs text-red-700 dark:text-red-300">
                  <strong>Rejection reason:</strong> {doc.rejectionReason}
                </p>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex gap-2 mt-4 pt-3 border-t">
          {hasFile && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => onPreview(doc.fileUrl!, doc.label)}
              data-testid={`button-view-${doc.type}`}
            >
              <Eye className="w-4 h-4 mr-1" />
              View File
            </Button>
          )}
          
          <Button 
            size="sm"
            onClick={() => onUpload(doc.type, doc.label)}
            variant={isRejected ? "destructive" : needsUpload ? "default" : "outline"}
            data-testid={`button-upload-${doc.type}`}
          >
            {isRejected ? (
              <>
                <RefreshCw className="w-4 h-4 mr-1" />
                Re-upload
              </>
            ) : hasFile ? (
              <>
                <Upload className="w-4 h-4 mr-1" />
                Update
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-1" />
                Upload
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SSNCard({ ssnLast4, verified }: { ssnLast4?: string; verified?: boolean }) {
  const [showSSN, setShowSSN] = useState(false);
  
  return (
    <Card className="hover-elevate" data-testid="card-document-ssn">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-lg flex-shrink-0 ${
            verified ? "bg-green-100 dark:bg-green-950" : "bg-muted"
          }`}>
            <Lock className={`w-5 h-5 ${verified ? "text-green-600" : "text-muted-foreground"}`} />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className="font-medium text-foreground">
                SSN Verification
              </h3>
              <StatusBadge status={verified ? "VERIFIED" : ssnLast4 ? "PENDING" : "NOT_SUBMITTED"} />
            </div>
            
            <p className="text-sm text-muted-foreground mb-3">
              Your Social Security Number for background check and tax purposes.
            </p>
            
            {ssnLast4 ? (
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm bg-muted px-3 py-1.5 rounded-md">
                  {showSSN ? `***-**-${ssnLast4}` : "***-**-****"}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setShowSSN(!showSSN)}
                  data-testid="button-toggle-ssn"
                >
                  {showSSN ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-yellow-600 dark:text-yellow-400">
                SSN not yet provided
              </p>
            )}
          </div>
        </div>
        
        <div className="flex gap-2 mt-4 pt-3 border-t">
          <Link href="/driver/profile">
            <Button variant="outline" size="sm" data-testid="button-update-ssn">
              <User className="w-4 h-4 mr-1" />
              {ssnLast4 ? "Update in Profile" : "Add in Profile"}
            </Button>
          </Link>
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const requiresExpiry = [
    "driver_license", "driver_license_front", "driver_license_back", 
    "tlc_license", "insurance", "vehicle_insurance", 
    "registration", "vehicle_registration", "vehicle_inspection"
  ].includes(documentType);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert("File size must be less than 10MB");
        return;
      }
      setSelectedFile(file);
      
      if (file.type.startsWith("image/")) {
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
      } else {
        setPreviewUrl(null);
      }
    }
  };

  const handleSubmit = () => {
    if (!selectedFile) return;
    onUpload(selectedFile, requiresExpiry ? expiresAt : undefined);
  };

  const handleClose = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setExpiresAt("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload {documentLabel}</DialogTitle>
          <DialogDescription>
            Select a clear, readable image or PDF file (max 10MB)
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
                <div className="space-y-3">
                  {previewUrl && (
                    <img 
                      src={previewUrl} 
                      alt="Preview" 
                      className="max-h-40 mx-auto rounded-lg object-contain"
                    />
                  )}
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    <span className="text-sm font-medium truncate max-w-[200px]">{selectedFile.name}</span>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                        setPreviewUrl(null);
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground mb-1">
                    Click to select a file
                  </p>
                  <p className="text-xs text-muted-foreground">
                    JPG, PNG, or PDF
                  </p>
                </>
              )}
            </div>
          </div>
          
          {requiresExpiry && (
            <div className="space-y-2">
              <Label htmlFor="expires-at">Expiration Date</Label>
              <Input
                id="expires-at"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                data-testid="input-expires-at"
              />
              <p className="text-xs text-muted-foreground">
                Enter the document expiration date if applicable
              </p>
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

  const { data: driverData } = useQuery({
    queryKey: ["/api/driver/home"],
  });

  const { data: summaryData, isLoading } = useQuery<{ success: boolean; data: DocumentSummary }>({
    queryKey: ["/api/driver/documents/summary"],
  });

  const profile = (driverData as any)?.profile as DriverProfile | undefined;
  
  const nycCities = ["New York", "NYC", "Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"];
  const isNYC = profile?.usaCity ? nycCities.some(city => 
    profile.usaCity?.toLowerCase().includes(city.toLowerCase())
  ) : false;
  const countryCode = profile?.countryCode || "US";

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

  const handleOpenUpload = (docType: string, label: string) => {
    setUploadDocType(docType);
    setUploadDocLabel(label);
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

  const backendDocs = summaryData?.data?.documents || [];
  const defaultDocTypes = DEFAULT_DOCUMENTS.map(d => d.type);
  
  const mergedDocs = DEFAULT_DOCUMENTS.map(defaultDoc => {
    const backendDoc = backendDocs.find(d => d.type === defaultDoc.type);
    return backendDoc ? { ...defaultDoc, ...backendDoc } : defaultDoc;
  });
  
  const additionalBackendDocs = backendDocs.filter(d => 
    !defaultDocTypes.includes(d.type) && d.type !== "tlc_license"
  );
  
  const backendTLC = backendDocs.find(d => d.type === "tlc_license");
  const tlcDocument = backendTLC ? { ...TLC_DOCUMENT, ...backendTLC } : TLC_DOCUMENT;
  
  const allDocuments = isNYC 
    ? [...mergedDocs, tlcDocument, ...additionalBackendDocs] 
    : [...mergedDocs, ...additionalBackendDocs];
  
  const approvedCount = allDocuments.filter(d => d.status === "APPROVED").length;
  const totalRequired = allDocuments.filter(d => d.required).length;
  const progressPercent = totalRequired > 0 ? Math.round((approvedCount / totalRequired) * 100) : 0;
  const pendingCount = allDocuments.filter(d => d.status === "PENDING" || d.status === "UNDER_REVIEW").length;
  const rejectedCount = allDocuments.filter(d => d.status === "REJECTED").length;

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-32 w-full" />
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">
          Driver Documents
        </h1>
        <p className="text-muted-foreground mt-1">
          Upload and manage all required documents to activate your SafeGo driver account
        </p>
      </div>

      <Card data-testid="card-progress-summary">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-lg">Verification Progress</CardTitle>
            <StatusBadge status={
              progressPercent === 100 ? "APPROVED" : 
              rejectedCount > 0 ? "REJECTED" : 
              pendingCount > 0 ? "UNDER_REVIEW" : "PENDING"
            } />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Progress value={progressPercent} className="h-2" data-testid="progress-documents" />
            
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {approvedCount} of {totalRequired} required documents approved
              </span>
              <span className="font-medium">{progressPercent}%</span>
            </div>
            
            <div className="flex gap-4 flex-wrap">
              {pendingCount > 0 && (
                <div className="flex items-center gap-1 text-sm">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span>{pendingCount} pending review</span>
                </div>
              )}
              {rejectedCount > 0 && (
                <div className="flex items-center gap-1 text-sm">
                  <XCircle className="w-4 h-4 text-red-600" />
                  <span className="text-red-600 font-medium">{rejectedCount} rejected</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Required Documents</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {allDocuments.filter(d => d.required).map(doc => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              onUpload={handleOpenUpload}
              onPreview={handlePreview}
            />
          ))}
        </div>
      </div>

      {countryCode === "US" && (
        <>
          <Separator />
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Identity Verification</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <SSNCard ssnLast4={profile?.ssnLast4} verified={profile?.ssnVerified} />
            </div>
          </div>
        </>
      )}

      {allDocuments.filter(d => !d.required).length > 0 && (
        <>
          <Separator />
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Additional Documents</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {allDocuments.filter(d => !d.required).map(doc => (
                <DocumentCard
                  key={doc.id}
                  doc={doc}
                  onUpload={handleOpenUpload}
                  onPreview={handlePreview}
                />
              ))}
            </div>
          </div>
        </>
      )}

      <div className="text-center py-4">
        <p className="text-sm text-muted-foreground">
          Need help with documents?{" "}
          <Link href="/driver/support-help-center" className="text-primary hover:underline">
            Contact Support
          </Link>
        </p>
      </div>

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
