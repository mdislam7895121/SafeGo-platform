import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Megaphone, Bell, Send, Users, Filter, Clock, CheckCircle, Eye, Trash2, Plus } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Announcement {
  id: string;
  title: string;
  content: string;
  type: string;
  priority: string;
  targetAudience: string[];
  targetCountries: string[];
  status: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  expiresAt: string | null;
  createdBy: string;
  createdByName: string;
  viewCount: number;
  acknowledgedCount: number;
  createdAt: string;
}

interface AnnouncementsResponse {
  announcements: Announcement[];
  stats: {
    total: number;
    active: number;
    scheduled: number;
    expired: number;
    totalViews: number;
  };
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

const AUDIENCE_OPTIONS = [
  { value: "all", label: "All Users" },
  { value: "customers", label: "Customers" },
  { value: "drivers", label: "Drivers" },
  { value: "restaurants", label: "Restaurants" },
  { value: "admins", label: "Admins" },
];

const COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "BD", name: "Bangladesh" },
  { code: "IN", name: "India" },
  { code: "UK", name: "United Kingdom" },
];

export default function CommunicationHub() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    content: "",
    type: "info",
    priority: "normal",
    targetAudience: [] as string[],
    targetCountries: [] as string[],
    scheduledAt: "",
    expiresAt: "",
  });

  const { data, isLoading, refetch } = useQuery<AnnouncementsResponse>({
    queryKey: ["/api/admin/phase4/announcements", activeTab, searchQuery, currentPage],
  });

  const createAnnouncementMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("/api/admin/phase4/announcements", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({ title: "Announcement created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/phase4/announcements"] });
      setShowCreateDialog(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "Failed to create announcement", variant: "destructive" });
    },
  });

  const deleteAnnouncementMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/admin/phase4/announcements/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      toast({ title: "Announcement deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/phase4/announcements"] });
    },
    onError: () => {
      toast({ title: "Failed to delete announcement", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      content: "",
      type: "info",
      priority: "normal",
      targetAudience: [],
      targetCountries: [],
      scheduledAt: "",
      expiresAt: "",
    });
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "info":
        return <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">Info</Badge>;
      case "warning":
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">Warning</Badge>;
      case "alert":
        return <Badge variant="destructive">Alert</Badge>;
      case "maintenance":
        return <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-300">Maintenance</Badge>;
      case "promotion":
        return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">Promotion</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="outline">Draft</Badge>;
      case "scheduled":
        return <Badge className="bg-purple-500"><Clock className="h-3 w-3 mr-1" />Scheduled</Badge>;
      case "active":
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Active</Badge>;
      case "expired":
        return <Badge variant="secondary">Expired</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleAudienceChange = (value: string, checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      targetAudience: checked
        ? [...prev.targetAudience, value]
        : prev.targetAudience.filter((v) => v !== value),
    }));
  };

  const handleCountryChange = (value: string, checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      targetCountries: checked
        ? [...prev.targetCountries, value]
        : prev.targetCountries.filter((v) => v !== value),
    }));
  };

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
            <h1 className="text-2xl font-bold">Admin Communication Hub</h1>
            <p className="text-sm opacity-90">Broadcast announcements and notifications</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{data?.stats?.total || 0}</p>
                </div>
                <Megaphone className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active</p>
                  <p className="text-2xl font-bold text-green-500">{data?.stats?.active || 0}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Scheduled</p>
                  <p className="text-2xl font-bold text-purple-500">{data?.stats?.scheduled || 0}</p>
                </div>
                <Clock className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Expired</p>
                  <p className="text-2xl font-bold">{data?.stats?.expired || 0}</p>
                </div>
                <Bell className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Views</p>
                  <p className="text-2xl font-bold">{data?.stats?.totalViews || 0}</p>
                </div>
                <Eye className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center justify-between">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
              <TabsTrigger value="draft">Drafts</TabsTrigger>
              <TabsTrigger value="expired">Expired</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-announcement">
            <Plus className="h-4 w-4 mr-2" />
            New Announcement
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <Input
                placeholder="Search announcements..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-sm"
                data-testid="input-search"
              />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : !data?.announcements?.length ? (
              <div className="text-center py-12">
                <Megaphone className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No announcements found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {data.announcements.map((announcement) => (
                  <Card key={announcement.id} className="hover-elevate" data-testid={`card-announcement-${announcement.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-lg">{announcement.title}</span>
                            {getTypeBadge(announcement.type)}
                            {getStatusBadge(announcement.status)}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">{announcement.content}</p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {announcement.targetAudience.join(", ")}
                            </span>
                            <span className="flex items-center gap-1">
                              <Eye className="h-3 w-3" />
                              {announcement.viewCount} views
                            </span>
                            <span>
                              by {announcement.createdByName} on {format(new Date(announcement.createdAt), "MMM dd, yyyy")}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2 ml-4">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setSelectedAnnouncement(announcement);
                              setShowPreviewDialog(true);
                            }}
                            data-testid={`button-preview-${announcement.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteAnnouncementMutation.mutate(announcement.id)}
                            data-testid={`button-delete-${announcement.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Announcement</DialogTitle>
            <DialogDescription>
              Broadcast a message to your users.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 p-1">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  placeholder="Announcement title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  data-testid="input-title"
                />
              </div>
              <div className="space-y-2">
                <Label>Content</Label>
                <Textarea
                  placeholder="Announcement content..."
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="min-h-[100px]"
                  data-testid="textarea-content"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                    <SelectTrigger data-testid="select-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">Info</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="alert">Alert</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="promotion">Promotion</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                    <SelectTrigger data-testid="select-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Target Audience</Label>
                <div className="flex flex-wrap gap-4">
                  {AUDIENCE_OPTIONS.map((option) => (
                    <div key={option.value} className="flex items-center gap-2">
                      <Checkbox
                        id={`audience-${option.value}`}
                        checked={formData.targetAudience.includes(option.value)}
                        onCheckedChange={(checked) => handleAudienceChange(option.value, checked as boolean)}
                        data-testid={`checkbox-audience-${option.value}`}
                      />
                      <Label htmlFor={`audience-${option.value}`}>{option.label}</Label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Target Countries</Label>
                <div className="flex flex-wrap gap-4">
                  {COUNTRIES.map((country) => (
                    <div key={country.code} className="flex items-center gap-2">
                      <Checkbox
                        id={`country-${country.code}`}
                        checked={formData.targetCountries.includes(country.code)}
                        onCheckedChange={(checked) => handleCountryChange(country.code, checked as boolean)}
                        data-testid={`checkbox-country-${country.code}`}
                      />
                      <Label htmlFor={`country-${country.code}`}>{country.name}</Label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Schedule (optional)</Label>
                  <Input
                    type="datetime-local"
                    value={formData.scheduledAt}
                    onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                    data-testid="input-scheduled"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Expires (optional)</Label>
                  <Input
                    type="datetime-local"
                    value={formData.expiresAt}
                    onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                    data-testid="input-expires"
                  />
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button
              onClick={() => createAnnouncementMutation.mutate(formData)}
              disabled={createAnnouncementMutation.isPending || !formData.title || !formData.content}
              data-testid="button-submit-announcement"
            >
              {createAnnouncementMutation.isPending ? "Creating..." : formData.scheduledAt ? "Schedule" : "Publish Now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Announcement Preview</DialogTitle>
          </DialogHeader>
          {selectedAnnouncement && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {getTypeBadge(selectedAnnouncement.type)}
                {getStatusBadge(selectedAnnouncement.status)}
              </div>
              <h3 className="text-lg font-bold">{selectedAnnouncement.title}</h3>
              <p className="text-muted-foreground">{selectedAnnouncement.content}</p>
              <div className="text-sm text-muted-foreground">
                <p>Target: {selectedAnnouncement.targetAudience.join(", ")}</p>
                <p>Countries: {selectedAnnouncement.targetCountries.join(", ") || "All"}</p>
                <p>Views: {selectedAnnouncement.viewCount} | Acknowledged: {selectedAnnouncement.acknowledgedCount}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
