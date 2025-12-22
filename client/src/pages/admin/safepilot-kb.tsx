import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, FileText, RefreshCw, Search, Filter, Eye, Edit, ToggleLeft, ChartBar } from "lucide-react";

interface KBDocument {
  id: string;
  title: string;
  tags: string[];
  countryScope: string;
  roleScope: string;
  serviceScope: string;
  source: string;
  version: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AuditStats {
  totalQueries: number;
  totalAnswers: number;
  kbUploads: number;
  flaggedMessages: number;
  uniqueUsers: number;
}

export default function SafePilotKBPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({
    countryScope: "",
    roleScope: "",
    serviceScope: "",
    isActive: "",
    source: "",
  });
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<KBDocument | null>(null);
  const [uploadForm, setUploadForm] = useState({
    title: "",
    body: "",
    tags: "",
    countryScope: "GLOBAL",
    roleScope: "ALL",
    serviceScope: "ALL",
    source: "admin_upload",
  });

  const buildQueryString = () => {
    const params = new URLSearchParams();
    if (filters.countryScope) params.append("countryScope", filters.countryScope);
    if (filters.roleScope) params.append("roleScope", filters.roleScope);
    if (filters.serviceScope) params.append("serviceScope", filters.serviceScope);
    if (filters.isActive) params.append("isActive", filters.isActive);
    if (filters.source) params.append("source", filters.source);
    return params.toString();
  };

  const { data: documentsData, isLoading: docsLoading } = useQuery({
    queryKey: ["/api/safepilot/kb/list", filters],
    queryFn: async () => {
      const qs = buildQueryString();
      const res = await fetch(`/api/safepilot/kb/list${qs ? `?${qs}` : ""}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch documents");
      return res.json();
    },
  });

  const { data: statsData } = useQuery({
    queryKey: ["/api/safepilot/audit/stats"],
    queryFn: async () => {
      const res = await fetch("/api/safepilot/audit/stats?days=30", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (data: typeof uploadForm) => {
      const res = await fetch("/api/safepilot/kb/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...data,
          tags: data.tags.split(",").map((t) => t.trim()).filter(Boolean),
        }),
      });
      if (!res.ok) throw new Error("Failed to upload document");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Document uploaded successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/safepilot/kb/list"] });
      setIsUploadOpen(false);
      setUploadForm({
        title: "",
        body: "",
        tags: "",
        countryScope: "GLOBAL",
        roleScope: "ALL",
        serviceScope: "ALL",
        source: "admin_upload",
      });
    },
    onError: () => {
      toast({ title: "Failed to upload document", variant: "destructive" });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/safepilot/kb/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error("Failed to update document");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Document status updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/safepilot/kb/list"] });
    },
    onError: () => {
      toast({ title: "Failed to update document", variant: "destructive" });
    },
  });

  const reembedMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const res = await fetch("/api/safepilot/kb/reembed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ documentId }),
      });
      if (!res.ok) throw new Error("Failed to reembed document");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Document re-embedded successfully" });
    },
    onError: () => {
      toast({ title: "Failed to re-embed document", variant: "destructive" });
    },
  });

  const documents: KBDocument[] = documentsData?.documents || [];
  const stats: AuditStats = statsData?.stats || {
    totalQueries: 0,
    totalAnswers: 0,
    kbUploads: 0,
    flaggedMessages: 0,
    uniqueUsers: 0,
  };

  const filteredDocs = documents.filter((doc) =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getScopeBadgeColor = (scope: string) => {
    switch (scope) {
      case "GLOBAL":
      case "ALL":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "BD":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "US":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      case "CUSTOMER":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "DRIVER":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
      case "RESTAURANT":
        return "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200";
      case "ADMIN":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">SafePilot Knowledge Base</h1>
          <p className="text-slate-600 dark:text-slate-400">
            Manage AI assistant knowledge documents for RAG-based responses
          </p>
        </div>
        <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Document
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Upload Knowledge Document</DialogTitle>
              <DialogDescription>
                Add a new document to the SafePilot knowledge base. The content will be embedded for semantic search.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Title</Label>
                <Input
                  value={uploadForm.title}
                  onChange={(e) => setUploadForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Document title..."
                />
              </div>
              <div>
                <Label>Content</Label>
                <Textarea
                  value={uploadForm.body}
                  onChange={(e) => setUploadForm((f) => ({ ...f, body: e.target.value }))}
                  placeholder="Document content..."
                  rows={8}
                />
              </div>
              <div>
                <Label>Tags (comma-separated)</Label>
                <Input
                  value={uploadForm.tags}
                  onChange={(e) => setUploadForm((f) => ({ ...f, tags: e.target.value }))}
                  placeholder="kyc, verification, driver..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Country Scope</Label>
                  <Select
                    value={uploadForm.countryScope}
                    onValueChange={(v) => setUploadForm((f) => ({ ...f, countryScope: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GLOBAL">Global</SelectItem>
                      <SelectItem value="BD">Bangladesh</SelectItem>
                      <SelectItem value="US">United States</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Role Scope</Label>
                  <Select
                    value={uploadForm.roleScope}
                    onValueChange={(v) => setUploadForm((f) => ({ ...f, roleScope: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Roles</SelectItem>
                      <SelectItem value="CUSTOMER">Customer</SelectItem>
                      <SelectItem value="DRIVER">Driver</SelectItem>
                      <SelectItem value="RESTAURANT">Restaurant</SelectItem>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Service Scope</Label>
                  <Select
                    value={uploadForm.serviceScope}
                    onValueChange={(v) => setUploadForm((f) => ({ ...f, serviceScope: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Services</SelectItem>
                      <SelectItem value="RIDE">Ride-hailing</SelectItem>
                      <SelectItem value="FOOD">Food Delivery</SelectItem>
                      <SelectItem value="PARCEL">Parcel Delivery</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Source Type</Label>
                  <Select
                    value={uploadForm.source}
                    onValueChange={(v) => setUploadForm((f) => ({ ...f, source: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin_upload">Admin Upload</SelectItem>
                      <SelectItem value="policy">Policy</SelectItem>
                      <SelectItem value="faq">FAQ</SelectItem>
                      <SelectItem value="runbook">Runbook</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsUploadOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => uploadMutation.mutate(uploadForm)}
                disabled={uploadMutation.isPending || !uploadForm.title || !uploadForm.body}
              >
                {uploadMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Upload Document
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <ChartBar className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{stats.totalQueries}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Total Queries</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{documents.length}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">KB Documents</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-purple-600" />
              <div>
                <p className="text-2xl font-bold">{stats.totalAnswers}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">AI Responses</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Search className="w-5 h-5 text-orange-600" />
              <div>
                <p className="text-2xl font-bold">{stats.uniqueUsers}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Unique Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-red-600" />
              <div>
                <p className="text-2xl font-bold">{stats.flaggedMessages}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Flagged</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Knowledge Documents</CardTitle>
          <CardDescription>
            Documents used by SafePilot for RAG-based AI responses
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-sm"
              />
            </div>
            <Select
              value={filters.countryScope}
              onValueChange={(v) => setFilters((f) => ({ ...f, countryScope: v }))}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Country" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Countries</SelectItem>
                <SelectItem value="GLOBAL">Global</SelectItem>
                <SelectItem value="BD">Bangladesh</SelectItem>
                <SelectItem value="US">United States</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.roleScope}
              onValueChange={(v) => setFilters((f) => ({ ...f, roleScope: v }))}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Roles</SelectItem>
                <SelectItem value="ALL">All</SelectItem>
                <SelectItem value="CUSTOMER">Customer</SelectItem>
                <SelectItem value="DRIVER">Driver</SelectItem>
                <SelectItem value="RESTAURANT">Restaurant</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.isActive}
              onValueChange={(v) => setFilters((f) => ({ ...f, isActive: v }))}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All</SelectItem>
                <SelectItem value="true">Active</SelectItem>
                <SelectItem value="false">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {docsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="text-center py-8 text-slate-600 dark:text-slate-400">
              No documents found. Add your first knowledge document to get started.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-4 border rounded-lg bg-slate-50 dark:bg-slate-900"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium">{doc.title}</h3>
                      {!doc.isActive && (
                        <Badge variant="outline" className="text-red-600 border-red-600">
                          Inactive
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 mb-2">
                      <Badge className={getScopeBadgeColor(doc.countryScope)}>
                        {doc.countryScope}
                      </Badge>
                      <Badge className={getScopeBadgeColor(doc.roleScope)}>
                        {doc.roleScope}
                      </Badge>
                      <Badge className={getScopeBadgeColor(doc.serviceScope)}>
                        {doc.serviceScope}
                      </Badge>
                      <Badge variant="outline">{doc.source}</Badge>
                      <Badge variant="outline">v{doc.version}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {doc.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-xs px-2 py-0.5 bg-slate-200 dark:bg-slate-700 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => reembedMutation.mutate(doc.id)}
                      disabled={reembedMutation.isPending}
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleStatusMutation.mutate({ id: doc.id, isActive: !doc.isActive })}
                    >
                      <ToggleLeft className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
