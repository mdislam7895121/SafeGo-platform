import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { 
  ArrowLeft, FileText, Download, Clock, Check, AlertTriangle, 
  X, Shield, User, Scale, BarChart3, Search, Filter, Plus,
  Eye, Loader2, Calendar, Globe, Lock, ChevronDown
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

type ComplianceExportStatus = "QUEUED" | "PROCESSING" | "READY" | "DOWNLOADED" | "EXPIRED" | "FAILED" | "CANCELLED";
type ComplianceExportCategory = "USER_REQUEST" | "REGULATOR_COURT" | "BULK_ANALYTICS";
type ComplianceExportScope = "SINGLE_USER" | "CASE_CENTRIC" | "TIME_WINDOW" | "CUSTOM";
type AnonymizationLevel = "NONE" | "PARTIAL" | "FULL";

interface ComplianceExport {
  id: string;
  category: ComplianceExportCategory;
  scope: ComplianceExportScope;
  title: string;
  description: string | null;
  reason: string;
  status: ComplianceExportStatus;
  countryCode: string | null;
  anonymizationLevel: AnonymizationLevel;
  targetUserId: string | null;
  targetUserEmail: string | null;
  caseId: string | null;
  startDate: string | null;
  endDate: string | null;
  includedEntities: string[];
  excludedFields: string[];
  requestedAt: string;
  requestedBy: string;
  requestedByEmail: string;
  completedAt: string | null;
  expiresAt: string | null;
  fileSize: number | null;
  fileHash: string | null;
  downloadCount: number;
  recordCount: number | null;
}

interface ExportEntity {
  id: string;
  label: string;
  description: string;
}

interface RetentionPolicy {
  id: string;
  countryCode: string;
  rideDataRetentionDays: number;
  paymentDataRetentionDays: number;
  kycDataRetentionDays: number;
  auditLogRetentionDays: number;
  complaintRetentionDays: number;
  allowUserDeletionRequest: boolean;
  softDeleteOnly: boolean;
  archivedDataAccessible: boolean;
  legalBasis: string | null;
}

const statusConfig: Record<ComplianceExportStatus, { label: string; color: string; icon: any }> = {
  QUEUED: { label: "Queued", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300", icon: Clock },
  PROCESSING: { label: "Processing", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300", icon: Loader2 },
  READY: { label: "Ready", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300", icon: Check },
  DOWNLOADED: { label: "Downloaded", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300", icon: Download },
  EXPIRED: { label: "Expired", color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300", icon: Clock },
  FAILED: { label: "Failed", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300", icon: X },
  CANCELLED: { label: "Cancelled", color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300", icon: X },
};

const categoryConfig: Record<ComplianceExportCategory, { label: string; icon: any; description: string }> = {
  USER_REQUEST: { 
    label: "User Requests", 
    icon: User, 
    description: "GDPR/CCPA data access requests from users"
  },
  REGULATOR_COURT: { 
    label: "Regulator & Court", 
    icon: Scale, 
    description: "Legal requests, court orders, regulatory investigations"
  },
  BULK_ANALYTICS: { 
    label: "Bulk Analytics", 
    icon: BarChart3, 
    description: "Aggregated analytics for internal audits"
  },
};

const scopeConfig: Record<ComplianceExportScope, { label: string; description: string }> = {
  SINGLE_USER: { label: "Single User", description: "Export data for a specific user" },
  CASE_CENTRIC: { label: "Case-Centric", description: "Export data related to a specific case/incident" },
  TIME_WINDOW: { label: "Time Window", description: "Export data within a date range" },
  CUSTOM: { label: "Custom", description: "Custom export with specific criteria" },
};

function StatusBadge({ status }: { status: ComplianceExportStatus }) {
  const config = statusConfig[status];
  const Icon = config.icon;
  return (
    <Badge className={`${config.color} gap-1`} data-testid={`status-badge-${status.toLowerCase()}`}>
      <Icon className={`h-3 w-3 ${status === "PROCESSING" ? "animate-spin" : ""}`} />
      {config.label}
    </Badge>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function CreateExportDialog({ 
  open, 
  onOpenChange,
  defaultCategory 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  defaultCategory: ComplianceExportCategory;
}) {
  const { toast } = useToast();
  const [category, setCategory] = useState<ComplianceExportCategory>(defaultCategory);
  const [scope, setScope] = useState<ComplianceExportScope>("SINGLE_USER");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [reason, setReason] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [anonymizationLevel, setAnonymizationLevel] = useState<AnonymizationLevel>("NONE");
  const [targetUserId, setTargetUserId] = useState("");
  const [targetUserEmail, setTargetUserEmail] = useState("");
  const [caseId, setCaseId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedEntities, setSelectedEntities] = useState<string[]>([]);

  const { data: entitiesData } = useQuery<{ entities: ExportEntity[] }>({
    queryKey: ["/api/admin/compliance-exports/entities"],
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("/api/admin/compliance-exports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: "Export Created",
        description: "Your compliance export has been queued for processing.",
      });
      queryClient.invalidateQueries({ 
        queryKey: ["/api/admin/compliance-exports"],
        exact: false,
      });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create export",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  const resetForm = useCallback(() => {
    setTitle("");
    setDescription("");
    setReason("");
    setCountryCode("");
    setAnonymizationLevel("NONE");
    setTargetUserId("");
    setTargetUserEmail("");
    setCaseId("");
    setStartDate("");
    setEndDate("");
    setSelectedEntities([]);
  }, []);

  const handleSubmit = () => {
    if (!title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    if (reason.length < 10) {
      toast({ title: "Please provide a detailed reason (at least 10 characters)", variant: "destructive" });
      return;
    }

    createMutation.mutate({
      category,
      scope,
      title,
      description,
      reason,
      countryCode: countryCode || undefined,
      anonymizationLevel,
      targetUserId: targetUserId || undefined,
      targetUserEmail: targetUserEmail || undefined,
      caseId: caseId || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      includedEntities: selectedEntities,
      excludedFields: [],
    });
  };

  const toggleEntity = (entityId: string) => {
    setSelectedEntities(prev => 
      prev.includes(entityId) 
        ? prev.filter(e => e !== entityId)
        : [...prev, entityId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Create Compliance Export
          </DialogTitle>
          <DialogDescription>
            Create a new data export for compliance, legal, or regulatory purposes
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as ComplianceExportCategory)}>
                  <SelectTrigger id="category" data-testid="select-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USER_REQUEST">User Request (GDPR/CCPA)</SelectItem>
                    <SelectItem value="REGULATOR_COURT">Regulator / Court Order</SelectItem>
                    <SelectItem value="BULK_ANALYTICS">Internal Audit / Analytics</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="scope">Scope</Label>
                <Select value={scope} onValueChange={(v) => setScope(v as ComplianceExportScope)}>
                  <SelectTrigger id="scope" data-testid="select-scope">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SINGLE_USER">Single User</SelectItem>
                    <SelectItem value="CASE_CENTRIC">Case-Centric</SelectItem>
                    <SelectItem value="TIME_WINDOW">Time Window</SelectItem>
                    <SelectItem value="CUSTOM">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="e.g., GDPR Data Request - John Smith"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                data-testid="input-title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason (Required)</Label>
              <Textarea
                id="reason"
                placeholder="Provide a detailed reason for this export request..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                data-testid="textarea-reason"
              />
              <p className="text-xs text-muted-foreground">
                This will be logged for audit purposes. Minimum 10 characters.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Additional notes..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                data-testid="textarea-description"
              />
            </div>

            {scope === "SINGLE_USER" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="targetUserId">User ID</Label>
                  <Input
                    id="targetUserId"
                    placeholder="User UUID"
                    value={targetUserId}
                    onChange={(e) => setTargetUserId(e.target.value)}
                    data-testid="input-target-user-id"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="targetUserEmail">Or User Email</Label>
                  <Input
                    id="targetUserEmail"
                    type="email"
                    placeholder="user@example.com"
                    value={targetUserEmail}
                    onChange={(e) => setTargetUserEmail(e.target.value)}
                    data-testid="input-target-user-email"
                  />
                </div>
              </div>
            )}

            {scope === "CASE_CENTRIC" && (
              <div className="space-y-2">
                <Label htmlFor="caseId">Case/Incident ID</Label>
                <Input
                  id="caseId"
                  placeholder="Complaint or incident ID"
                  value={caseId}
                  onChange={(e) => setCaseId(e.target.value)}
                  data-testid="input-case-id"
                />
              </div>
            )}

            {scope === "TIME_WINDOW" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    data-testid="input-start-date"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    data-testid="input-end-date"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="countryCode">Country Filter</Label>
                <Select value={countryCode} onValueChange={setCountryCode}>
                  <SelectTrigger id="countryCode" data-testid="select-country">
                    <SelectValue placeholder="All countries" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Countries</SelectItem>
                    <SelectItem value="US">United States</SelectItem>
                    <SelectItem value="BD">Bangladesh</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="anonymization">Anonymization Level</Label>
                <Select value={anonymizationLevel} onValueChange={(v) => setAnonymizationLevel(v as AnonymizationLevel)}>
                  <SelectTrigger id="anonymization" data-testid="select-anonymization">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">None (Full Data)</SelectItem>
                    <SelectItem value="PARTIAL">Partial (Masked PII)</SelectItem>
                    <SelectItem value="FULL">Full (Hashed)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <Label>Include Data Entities</Label>
              <p className="text-xs text-muted-foreground">
                Leave empty to include all available entities
              </p>
              <div className="grid grid-cols-2 gap-2">
                {entitiesData?.entities.map((entity) => (
                  <div
                    key={entity.id}
                    className="flex items-center space-x-2 p-2 rounded border hover-elevate cursor-pointer"
                    onClick={() => toggleEntity(entity.id)}
                    data-testid={`entity-checkbox-${entity.id}`}
                  >
                    <Checkbox
                      checked={selectedEntities.includes(entity.id)}
                      onCheckedChange={() => toggleEntity(entity.id)}
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium">{entity.label}</div>
                      <div className="text-xs text-muted-foreground">{entity.description}</div>
                    </div>
                  </div>
                )) || (
                  <>
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
        
        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel">
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={createMutation.isPending}
            data-testid="button-create-export"
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Create Export
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExportDetailsDialog({ 
  exportData, 
  open, 
  onOpenChange 
}: { 
  exportData: ComplianceExport | null; 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();

  const downloadMutation = useMutation({
    mutationFn: async (exportId: string) => {
      const response = await fetch(`/api/admin/compliance-exports/${exportId}/download`, {
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Download failed");
      }
      return response.blob();
    },
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `compliance-export-${exportData?.id}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Download Started",
        description: "Your export file is being downloaded.",
      });
      queryClient.invalidateQueries({ 
        queryKey: ["/api/admin/compliance-exports"],
        exact: false,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Download Failed",
        description: error.message || "Failed to download export",
        variant: "destructive",
      });
    },
  });

  if (!exportData) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Export Details
          </DialogTitle>
          <DialogDescription>
            {exportData.title}
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 py-4">
            <div className="flex items-center justify-between">
              <StatusBadge status={exportData.status} />
              <Badge variant="outline" className="gap-1">
                <Globe className="h-3 w-3" />
                {exportData.countryCode || "All Countries"}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Category:</span>
                <div className="font-medium">{categoryConfig[exportData.category].label}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Scope:</span>
                <div className="font-medium">{scopeConfig[exportData.scope].label}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Requested By:</span>
                <div className="font-medium">{exportData.requestedByEmail}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Requested At:</span>
                <div className="font-medium">
                  {format(new Date(exportData.requestedAt), "MMM d, yyyy HH:mm")}
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <h4 className="font-medium">Reason</h4>
              <div className="text-sm bg-muted p-3 rounded">{exportData.reason}</div>
            </div>

            {exportData.description && (
              <div className="space-y-2">
                <h4 className="font-medium">Description</h4>
                <div className="text-sm text-muted-foreground">{exportData.description}</div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Anonymization:</span>
                <div className="font-medium flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  {exportData.anonymizationLevel}
                </div>
              </div>
              {exportData.recordCount && (
                <div>
                  <span className="text-muted-foreground">Records:</span>
                  <div className="font-medium">{exportData.recordCount.toLocaleString()}</div>
                </div>
              )}
              {exportData.fileSize && (
                <div>
                  <span className="text-muted-foreground">File Size:</span>
                  <div className="font-medium">{formatBytes(exportData.fileSize)}</div>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Downloads:</span>
                <div className="font-medium">{exportData.downloadCount}</div>
              </div>
            </div>

            {exportData.expiresAt && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                Expires: {format(new Date(exportData.expiresAt), "MMM d, yyyy HH:mm")}
              </div>
            )}

            {exportData.includedEntities.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Included Entities</h4>
                <div className="flex flex-wrap gap-2">
                  {exportData.includedEntities.map((entity) => (
                    <Badge key={entity} variant="secondary">{entity}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
        
        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-close-details">
            Close
          </Button>
          {(exportData.status === "READY" || exportData.status === "DOWNLOADED") && (
            <Button
              onClick={() => downloadMutation.mutate(exportData.id)}
              disabled={downloadMutation.isPending}
              data-testid="button-download-export"
            >
              {downloadMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Downloading...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExportList({ 
  category, 
  onViewDetails,
  onCreateNew 
}: { 
  category: ComplianceExportCategory;
  onViewDetails: (exp: ComplianceExport) => void;
  onCreateNew: () => void;
}) {
  const [statusFilter, setStatusFilter] = useState<ComplianceExportStatus | "">("");
  const [searchQuery, setSearchQuery] = useState("");

  const queryKey = ["/api/admin/compliance-exports", { category, status: statusFilter || undefined }];

  const { data, isLoading } = useQuery<{ exports: ComplianceExport[]; total: number }>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("category", category);
      if (statusFilter) params.set("status", statusFilter);
      const response = await fetch(`/api/admin/compliance-exports?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch exports");
      return response.json();
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (exportId: string) => {
      return apiRequest(`/api/admin/compliance-exports/${exportId}/cancel`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ["/api/admin/compliance-exports", { category }],
        exact: false,
      });
    },
  });

  const filteredExports = data?.exports.filter((exp) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        exp.title.toLowerCase().includes(query) ||
        exp.requestedByEmail.toLowerCase().includes(query) ||
        exp.id.toLowerCase().includes(query)
      );
    }
    return true;
  }) || [];

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by title, email, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-exports"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2" data-testid="button-filter-status">
              <Filter className="h-4 w-4" />
              {statusFilter ? statusConfig[statusFilter].label : "All Status"}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setStatusFilter("")}>All Status</DropdownMenuItem>
            <DropdownMenuSeparator />
            {Object.entries(statusConfig).map(([key, config]) => (
              <DropdownMenuItem key={key} onClick={() => setStatusFilter(key as ComplianceExportStatus)}>
                {config.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button onClick={onCreateNew} data-testid="button-new-export">
          <Plus className="mr-2 h-4 w-4" />
          New Export
        </Button>
      </div>

      {filteredExports.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No exports found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create a new export request to get started
            </p>
            <Button onClick={onCreateNew} data-testid="button-create-first-export">
              <Plus className="mr-2 h-4 w-4" />
              Create Export
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredExports.map((exp) => (
            <Card key={exp.id} className="hover-elevate" data-testid={`export-card-${exp.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium truncate">{exp.title}</h3>
                      <StatusBadge status={exp.status} />
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {scopeConfig[exp.scope].label} 
                      {exp.targetUserEmail && ` - ${exp.targetUserEmail}`}
                      {exp.caseId && ` - Case: ${exp.caseId}`}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>By: {exp.requestedByEmail}</span>
                      <span>{format(new Date(exp.requestedAt), "MMM d, yyyy HH:mm")}</span>
                      {exp.recordCount && <span>{exp.recordCount} records</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onViewDetails(exp)}
                      data-testid={`button-view-${exp.id}`}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {exp.status === "QUEUED" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => cancelMutation.mutate(exp.id)}
                        disabled={cancelMutation.isPending}
                        data-testid={`button-cancel-${exp.id}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function RetentionPoliciesTab() {
  const { toast } = useToast();
  
  const { data, isLoading } = useQuery<{ policies: RetentionPolicy[] }>({
    queryKey: ["/api/admin/compliance-exports/retention-policies"],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ countryCode, data }: { countryCode: string; data: any }) => {
      return apiRequest(`/api/admin/compliance-exports/retention-policies/${countryCode}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: "Policy Updated",
        description: "Retention policy has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/compliance-exports/retention-policies"] });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update policy",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const policies = data?.policies || [];
  const defaultPolicies = [
    { countryCode: "US", label: "United States" },
    { countryCode: "BD", label: "Bangladesh" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-muted-foreground">
        <AlertTriangle className="h-4 w-4" />
        <span className="text-sm">
          Retention policies define how long data is kept and user deletion rights per country
        </span>
      </div>

      {defaultPolicies.map((country) => {
        const policy = policies.find((p) => p.countryCode === country.countryCode);
        
        return (
          <Card key={country.countryCode} data-testid={`policy-card-${country.countryCode}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                {country.label}
              </CardTitle>
              <CardDescription>
                Configure data retention periods and user rights for {country.label}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Ride Data (days)</Label>
                  <Input
                    type="number"
                    defaultValue={policy?.rideDataRetentionDays || 365}
                    onChange={(e) => {
                      updateMutation.mutate({
                        countryCode: country.countryCode,
                        data: { rideDataRetentionDays: parseInt(e.target.value) },
                      });
                    }}
                    data-testid={`input-ride-retention-${country.countryCode}`}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Payment Data (days)</Label>
                  <Input
                    type="number"
                    defaultValue={policy?.paymentDataRetentionDays || 2555}
                    onChange={(e) => {
                      updateMutation.mutate({
                        countryCode: country.countryCode,
                        data: { paymentDataRetentionDays: parseInt(e.target.value) },
                      });
                    }}
                    data-testid={`input-payment-retention-${country.countryCode}`}
                  />
                </div>
                <div className="space-y-2">
                  <Label>KYC Data (days)</Label>
                  <Input
                    type="number"
                    defaultValue={policy?.kycDataRetentionDays || 2555}
                    onChange={(e) => {
                      updateMutation.mutate({
                        countryCode: country.countryCode,
                        data: { kycDataRetentionDays: parseInt(e.target.value) },
                      });
                    }}
                    data-testid={`input-kyc-retention-${country.countryCode}`}
                  />
                </div>
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div>
                  <Label>Allow User Deletion Requests</Label>
                  <p className="text-xs text-muted-foreground">
                    Users can request account deletion (GDPR Art. 17)
                  </p>
                </div>
                <Switch
                  checked={policy?.allowUserDeletionRequest ?? true}
                  onCheckedChange={(checked) => {
                    updateMutation.mutate({
                      countryCode: country.countryCode,
                      data: { allowUserDeletionRequest: checked },
                    });
                  }}
                  data-testid={`switch-deletion-${country.countryCode}`}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label>Soft Delete Only</Label>
                  <p className="text-xs text-muted-foreground">
                    Mark data as deleted but retain for legal compliance
                  </p>
                </div>
                <Switch
                  checked={policy?.softDeleteOnly ?? true}
                  onCheckedChange={(checked) => {
                    updateMutation.mutate({
                      countryCode: country.countryCode,
                      data: { softDeleteOnly: checked },
                    });
                  }}
                  data-testid={`switch-soft-delete-${country.countryCode}`}
                />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default function ComplianceExportCenter() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<ComplianceExportCategory>("USER_REQUEST");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedExport, setSelectedExport] = useState<ComplianceExport | null>(null);

  const handleViewDetails = (exp: ComplianceExport) => {
    setSelectedExport(exp);
    setDetailsDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/admin")}
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Shield className="h-6 w-6" />
                Legal & Compliance Data Export Center
              </h1>
              <p className="text-sm text-muted-foreground">
                GDPR/CCPA data access, regulatory requests, and audit exports
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-6">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ComplianceExportCategory)}>
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="USER_REQUEST" className="gap-2" data-testid="tab-user-request">
              <User className="h-4 w-4" />
              User Requests
            </TabsTrigger>
            <TabsTrigger value="REGULATOR_COURT" className="gap-2" data-testid="tab-regulator">
              <Scale className="h-4 w-4" />
              Regulator & Court
            </TabsTrigger>
            <TabsTrigger value="BULK_ANALYTICS" className="gap-2" data-testid="tab-analytics">
              <BarChart3 className="h-4 w-4" />
              Bulk Analytics
            </TabsTrigger>
            <TabsTrigger value="RETENTION" className="gap-2" data-testid="tab-retention">
              <Clock className="h-4 w-4" />
              Retention Policies
            </TabsTrigger>
          </TabsList>

          <TabsContent value="USER_REQUEST">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  {categoryConfig.USER_REQUEST.label}
                </CardTitle>
                <CardDescription>
                  {categoryConfig.USER_REQUEST.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ExportList
                  category="USER_REQUEST"
                  onViewDetails={handleViewDetails}
                  onCreateNew={() => setCreateDialogOpen(true)}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="REGULATOR_COURT">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scale className="h-5 w-5" />
                  {categoryConfig.REGULATOR_COURT.label}
                </CardTitle>
                <CardDescription>
                  {categoryConfig.REGULATOR_COURT.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ExportList
                  category="REGULATOR_COURT"
                  onViewDetails={handleViewDetails}
                  onCreateNew={() => setCreateDialogOpen(true)}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="BULK_ANALYTICS">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  {categoryConfig.BULK_ANALYTICS.label}
                </CardTitle>
                <CardDescription>
                  {categoryConfig.BULK_ANALYTICS.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ExportList
                  category="BULK_ANALYTICS"
                  onViewDetails={handleViewDetails}
                  onCreateNew={() => setCreateDialogOpen(true)}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="RETENTION">
            <RetentionPoliciesTab />
          </TabsContent>
        </Tabs>
      </div>

      <CreateExportDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        defaultCategory={activeTab === "RETENTION" ? "USER_REQUEST" : activeTab}
      />

      <ExportDetailsDialog
        exportData={selectedExport}
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
      />
    </div>
  );
}
