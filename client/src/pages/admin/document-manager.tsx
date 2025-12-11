import { useState } from "react";
import { FileText, Folder, Upload, Download, Trash2, Search, Filter, Eye, Lock, Clock, Share2, Plus } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Document {
  id: string;
  name: string;
  type: string;
  category: string;
  size: number;
  mimeType: string;
  version: number;
  status: string;
  accessLevel: string;
  uploadedBy: string;
  uploadedByName: string;
  tags: string[];
  metadata: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
}

interface DocumentsResponse {
  documents: Document[];
  categories: { name: string; count: number }[];
  stats: {
    total: number;
    totalSize: number;
    byCategory: Record<string, number>;
    recentUploads: number;
  };
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export default function DocumentManager() {
  const { toast } = useToast();
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);

  const [uploadForm, setUploadForm] = useState({
    name: "",
    category: "general",
    accessLevel: "internal",
    tags: "",
    description: "",
  });

  const { data, isLoading, refetch } = useQuery<DocumentsResponse>({
    queryKey: ["/api/admin/phase4/documents", categoryFilter, typeFilter, searchQuery, currentPage],
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/admin/phase4/documents/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      toast({ title: "Document deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/phase4/documents"] });
    },
    onError: () => {
      toast({ title: "Failed to delete document", variant: "destructive" });
    },
  });

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "legal":
        return <FileText className="h-4 w-4 text-purple-500" />;
      case "compliance":
        return <Lock className="h-4 w-4 text-blue-500" />;
      case "policy":
        return <FileText className="h-4 w-4 text-green-500" />;
      case "training":
        return <FileText className="h-4 w-4 text-orange-500" />;
      default:
        return <FileText className="h-4 w-4 text-gray-500" />;
    }
  };

  const getAccessBadge = (level: string) => {
    switch (level) {
      case "public":
        return <Badge variant="outline" className="bg-green-100 text-green-800">Public</Badge>;
      case "internal":
        return <Badge variant="outline" className="bg-blue-100 text-blue-800">Internal</Badge>;
      case "confidential":
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800"><Lock className="h-3 w-3 mr-1" />Confidential</Badge>;
      case "restricted":
        return <Badge variant="destructive"><Lock className="h-3 w-3 mr-1" />Restricted</Badge>;
      default:
        return <Badge variant="outline">{level}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background pb-6">
      <PageHeader
        title="Document Manager"
        description="Manage policies, legal documents, and compliance files"
        icon={FileText}
        backButton={{ label: "Back to Dashboard", href: "/admin" }}
      />

      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Documents</p>
                  <p className="text-2xl font-bold">{data?.stats?.total || 0}</p>
                </div>
                <FileText className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Size</p>
                  <p className="text-2xl font-bold">{formatFileSize(data?.stats?.totalSize || 0)}</p>
                </div>
                <Folder className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Categories</p>
                  <p className="text-2xl font-bold">{data?.categories?.length || 0}</p>
                </div>
                <Folder className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Recent Uploads</p>
                  <p className="text-2xl font-bold">{data?.stats?.recentUploads || 0}</p>
                </div>
                <Upload className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Folder className="h-5 w-5" />
                Categories
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Button
                  variant={categoryFilter === "all" ? "secondary" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => setCategoryFilter("all")}
                  data-testid="button-category-all"
                >
                  All Documents
                  <Badge variant="outline" className="ml-auto">{data?.stats?.total || 0}</Badge>
                </Button>
                {data?.categories?.map((cat) => (
                  <Button
                    key={cat.name}
                    variant={categoryFilter === cat.name ? "secondary" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => setCategoryFilter(cat.name)}
                    data-testid={`button-category-${cat.name}`}
                  >
                    {getCategoryIcon(cat.name)}
                    <span className="ml-2 capitalize">{cat.name}</span>
                    <Badge variant="outline" className="ml-auto">{cat.count}</Badge>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-3">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Documents
                </CardTitle>
                <Button onClick={() => setShowUploadDialog(true)} data-testid="button-upload">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </Button>
              </div>
              <div className="flex gap-4 mt-4">
                <Input
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="max-w-sm"
                  data-testid="input-search"
                />
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[150px]" data-testid="select-type">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="doc">Word</SelectItem>
                    <SelectItem value="xls">Excel</SelectItem>
                    <SelectItem value="image">Images</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : !data?.documents?.length ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No documents found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {data.documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center gap-4 p-3 border rounded-lg hover-elevate"
                      data-testid={`row-document-${doc.id}`}
                    >
                      {getCategoryIcon(doc.category)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{doc.name}</span>
                          {getAccessBadge(doc.accessLevel)}
                          {doc.version > 1 && (
                            <Badge variant="outline" className="text-xs">v{doc.version}</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>{formatFileSize(doc.size)}</span>
                          <span className="capitalize">{doc.category}</span>
                          <span>{format(new Date(doc.updatedAt), "MMM dd, yyyy")}</span>
                          <span>by {doc.uploadedByName}</span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setSelectedDocument(doc);
                            setShowPreviewDialog(true);
                          }}
                          data-testid={`button-view-${doc.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          data-testid={`button-download-${doc.id}`}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          data-testid={`button-share-${doc.id}`}
                        >
                          <Share2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteDocumentMutation.mutate(doc.id)}
                          data-testid={`button-delete-${doc.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>
              Upload a new document to the system.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Drag and drop a file here, or click to select
              </p>
              <Input type="file" className="mt-4" data-testid="input-file" />
            </div>
            <div className="space-y-2">
              <Label>Document Name</Label>
              <Input
                placeholder="Document name"
                value={uploadForm.name}
                onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })}
                data-testid="input-name"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={uploadForm.category}
                  onValueChange={(v) => setUploadForm({ ...uploadForm, category: v })}
                >
                  <SelectTrigger data-testid="select-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="legal">Legal</SelectItem>
                    <SelectItem value="compliance">Compliance</SelectItem>
                    <SelectItem value="policy">Policy</SelectItem>
                    <SelectItem value="training">Training</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Access Level</Label>
                <Select
                  value={uploadForm.accessLevel}
                  onValueChange={(v) => setUploadForm({ ...uploadForm, accessLevel: v })}
                >
                  <SelectTrigger data-testid="select-access">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="internal">Internal</SelectItem>
                    <SelectItem value="confidential">Confidential</SelectItem>
                    <SelectItem value="restricted">Restricted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tags (comma separated)</Label>
              <Input
                placeholder="tag1, tag2, tag3"
                value={uploadForm.tags}
                onChange={(e) => setUploadForm({ ...uploadForm, tags: e.target.value })}
                data-testid="input-tags"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Document description..."
                value={uploadForm.description}
                onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                data-testid="textarea-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)}>Cancel</Button>
            <Button data-testid="button-upload-submit">
              <Upload className="h-4 w-4 mr-2" />
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Document Details</DialogTitle>
          </DialogHeader>
          {selectedDocument && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 p-1">
                <div className="flex items-center gap-4">
                  {getCategoryIcon(selectedDocument.category)}
                  <div>
                    <h3 className="font-bold text-lg">{selectedDocument.name}</h3>
                    <p className="text-sm text-muted-foreground">{selectedDocument.mimeType}</p>
                  </div>
                  {getAccessBadge(selectedDocument.accessLevel)}
                </div>
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                  <div>
                    <Label className="text-muted-foreground">Size</Label>
                    <p>{formatFileSize(selectedDocument.size)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Version</Label>
                    <p>{selectedDocument.version}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Category</Label>
                    <p className="capitalize">{selectedDocument.category}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <p className="capitalize">{selectedDocument.status}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Uploaded By</Label>
                    <p>{selectedDocument.uploadedByName}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Uploaded At</Label>
                    <p>{format(new Date(selectedDocument.createdAt), "MMM dd, yyyy HH:mm")}</p>
                  </div>
                </div>
                {selectedDocument.tags?.length > 0 && (
                  <div>
                    <Label className="text-muted-foreground">Tags</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedDocument.tags.map((tag) => (
                        <Badge key={tag} variant="secondary">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>Close</Button>
            <Button data-testid="button-download-preview">
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
