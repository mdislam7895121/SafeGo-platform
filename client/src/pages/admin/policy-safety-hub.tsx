import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  FileText,
  Plus,
  Clock,
  CheckCircle,
  Eye,
  Shield,
  AlertTriangle,
  Users,
  CreditCard,
  Ban,
  Book,
  HeartHandshake,
  Settings,
  Globe
} from "lucide-react";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type PolicyCategory = "terms" | "refund-policy" | "cancellation-policy" | "community-guidelines" | "code-of-conduct" | "safety-policy";

interface PolicyVersion {
  id: string;
  version: string;
  title: string;
  contentUrl?: string;
  content?: string;
  summary?: string;
  isActive: boolean;
  countryCode?: string;
  serviceType?: string;
  targetRole?: string;
  actor?: string;
  createdAt: string;
  createdBy?: string;
}

const policyCategories: { key: PolicyCategory; label: string; icon: React.ElementType; description: string }[] = [
  { key: "terms", label: "Terms & Conditions", icon: FileText, description: "User agreements and service terms" },
  { key: "refund-policy", label: "Refund Policy", icon: CreditCard, description: "Refund rules by service type" },
  { key: "cancellation-policy", label: "Cancellation Policy", icon: Ban, description: "Cancellation fees and rules" },
  { key: "community-guidelines", label: "Community Guidelines", icon: Users, description: "Behavior standards for all users" },
  { key: "code-of-conduct", label: "Code of Conduct", icon: HeartHandshake, description: "Partner professional conduct" },
  { key: "safety-policy", label: "Safety Policy", icon: Shield, description: "Safety rules and procedures" },
];

export default function PolicySafetyHub() {
  const [activeTab, setActiveTab] = useState<PolicyCategory>("terms");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newPolicy, setNewPolicy] = useState({
    version: "",
    title: "",
    contentUrl: "",
    content: "",
    summary: "",
    countryCode: "",
    serviceType: "",
    targetRole: "customer",
    actor: "customer",
  });
  const { toast } = useToast();

  const { data: termsData, isLoading: termsLoading } = useQuery<{ success: boolean; terms: PolicyVersion[] }>({
    queryKey: ["/api/policy-safety/terms"],
  });

  const { data: refundData, isLoading: refundLoading } = useQuery<{ success: boolean; policies: PolicyVersion[] }>({
    queryKey: ["/api/policy-safety/refund-policy"],
  });

  const { data: cancellationData, isLoading: cancellationLoading } = useQuery<{ success: boolean; policies: PolicyVersion[] }>({
    queryKey: ["/api/policy-safety/cancellation-policy"],
  });

  const { data: guidelinesData, isLoading: guidelinesLoading } = useQuery<{ success: boolean; guidelines: PolicyVersion[] }>({
    queryKey: ["/api/policy-safety/community-guidelines"],
  });

  const { data: codeOfConductData, isLoading: codeOfConductLoading } = useQuery<{ success: boolean; codes: PolicyVersion[] }>({
    queryKey: ["/api/policy-safety/code-of-conduct"],
  });

  const { data: safetyPolicyData, isLoading: safetyPolicyLoading } = useQuery<{ success: boolean; policies: PolicyVersion[] }>({
    queryKey: ["/api/policy-safety/safety-policy"],
  });

  const createMutation = useMutation({
    mutationFn: async (category: PolicyCategory) => {
      const payload: Record<string, any> = {
        version: newPolicy.version,
        title: newPolicy.title,
        contentUrl: newPolicy.contentUrl || undefined,
        content: newPolicy.content || undefined,
        summary: newPolicy.summary || undefined,
        countryCode: newPolicy.countryCode || undefined,
      };

      if (category === "refund-policy") {
        payload.serviceType = newPolicy.serviceType || undefined;
      }
      if (category === "cancellation-policy") {
        payload.actor = newPolicy.actor;
        payload.serviceType = newPolicy.serviceType || undefined;
      }
      if (category === "community-guidelines") {
        payload.targetRole = newPolicy.targetRole;
      }
      if (category === "code-of-conduct") {
        payload.targetRole = newPolicy.targetRole;
      }

      return apiRequest(`/api/policy-safety/${category}`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      toast({ title: "Policy Created", description: "New policy version has been created." });
      queryClient.invalidateQueries({ queryKey: [`/api/policy-safety/${activeTab}`] });
      setCreateDialogOpen(false);
      resetNewPolicy();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create policy.", variant: "destructive" });
    },
  });

  const activateMutation = useMutation({
    mutationFn: async ({ category, id }: { category: PolicyCategory; id: string }) => {
      return apiRequest(`/api/policy-safety/${category}/${id}/activate`, {
        method: "PATCH",
      });
    },
    onSuccess: () => {
      toast({ title: "Policy Activated", description: "Policy is now live." });
      queryClient.invalidateQueries({ queryKey: [`/api/policy-safety/${activeTab}`] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to activate policy.", variant: "destructive" });
    },
  });

  const resetNewPolicy = () => {
    setNewPolicy({
      version: "",
      title: "",
      contentUrl: "",
      content: "",
      summary: "",
      countryCode: "",
      serviceType: "",
      targetRole: "customer",
      actor: "customer",
    });
  };

  const getPolicies = (): PolicyVersion[] => {
    switch (activeTab) {
      case "terms":
        return termsData?.terms || [];
      case "refund-policy":
        return refundData?.policies || [];
      case "cancellation-policy":
        return cancellationData?.policies || [];
      case "community-guidelines":
        return guidelinesData?.guidelines || [];
      case "code-of-conduct":
        return codeOfConductData?.codes || [];
      case "safety-policy":
        return safetyPolicyData?.policies || [];
      default:
        return [];
    }
  };

  const isLoading = () => {
    switch (activeTab) {
      case "terms":
        return termsLoading;
      case "refund-policy":
        return refundLoading;
      case "cancellation-policy":
        return cancellationLoading;
      case "community-guidelines":
        return guidelinesLoading;
      case "code-of-conduct":
        return codeOfConductLoading;
      case "safety-policy":
        return safetyPolicyLoading;
      default:
        return false;
    }
  };

  const policies = getPolicies();
  const activePolicies = policies.filter((p) => p.isActive);
  const draftPolicies = policies.filter((p) => !p.isActive);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Policy & Safety Hub</h1>
          <p className="text-muted-foreground">Manage all platform policies, terms, and safety documents</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-policy">
              <Plus className="h-4 w-4 mr-2" />
              New Version
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Policy Version</DialogTitle>
              <DialogDescription>
                Create a new version of {policyCategories.find((c) => c.key === activeTab)?.label}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Version</label>
                  <Input
                    placeholder="e.g., 1.0.0"
                    value={newPolicy.version}
                    onChange={(e) => setNewPolicy({ ...newPolicy, version: e.target.value })}
                    data-testid="input-version"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Title</label>
                  <Input
                    placeholder="e.g., Terms of Service v1.0"
                    value={newPolicy.title}
                    onChange={(e) => setNewPolicy({ ...newPolicy, title: e.target.value })}
                    data-testid="input-title"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Country Code (optional)</label>
                  <Select value={newPolicy.countryCode} onValueChange={(v) => setNewPolicy({ ...newPolicy, countryCode: v })}>
                    <SelectTrigger data-testid="select-country">
                      <SelectValue placeholder="All countries" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Countries</SelectItem>
                      <SelectItem value="US">United States</SelectItem>
                      <SelectItem value="BD">Bangladesh</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(activeTab === "refund-policy" || activeTab === "cancellation-policy") && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Service Type (optional)</label>
                    <Select value={newPolicy.serviceType} onValueChange={(v) => setNewPolicy({ ...newPolicy, serviceType: v })}>
                      <SelectTrigger data-testid="select-service-type">
                        <SelectValue placeholder="All services" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Services</SelectItem>
                        <SelectItem value="ride">Ride</SelectItem>
                        <SelectItem value="food">Food Delivery</SelectItem>
                        <SelectItem value="parcel">Parcel</SelectItem>
                        <SelectItem value="shop">Shop</SelectItem>
                        <SelectItem value="ticket">Ticket</SelectItem>
                        <SelectItem value="rental">Rental</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {activeTab === "cancellation-policy" && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Actor</label>
                    <Select value={newPolicy.actor} onValueChange={(v) => setNewPolicy({ ...newPolicy, actor: v })}>
                      <SelectTrigger data-testid="select-actor">
                        <SelectValue placeholder="Select actor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="customer">Customer</SelectItem>
                        <SelectItem value="driver">Driver</SelectItem>
                        <SelectItem value="merchant">Merchant</SelectItem>
                        <SelectItem value="system">System</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {(activeTab === "community-guidelines" || activeTab === "code-of-conduct") && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Target Role</label>
                    <Select value={newPolicy.targetRole} onValueChange={(v) => setNewPolicy({ ...newPolicy, targetRole: v })}>
                      <SelectTrigger data-testid="select-target-role">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeTab === "code-of-conduct" ? (
                          <>
                            <SelectItem value="driver">Driver</SelectItem>
                            <SelectItem value="restaurant">Restaurant</SelectItem>
                            <SelectItem value="shop_partner">Shop Partner</SelectItem>
                            <SelectItem value="ticket_operator">Ticket Operator</SelectItem>
                            <SelectItem value="rental_partner">Rental Partner</SelectItem>
                            <SelectItem value="all_partners">All Partners</SelectItem>
                          </>
                        ) : (
                          <>
                            <SelectItem value="customer">Customer</SelectItem>
                            <SelectItem value="driver">Driver</SelectItem>
                            <SelectItem value="restaurant">Restaurant</SelectItem>
                            <SelectItem value="all">All Users</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Content URL (link to full document)</label>
                <Input
                  placeholder="https://safego.com/legal/terms-v1.pdf"
                  value={newPolicy.contentUrl}
                  onChange={(e) => setNewPolicy({ ...newPolicy, contentUrl: e.target.value })}
                  data-testid="input-content-url"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Summary</label>
                <Textarea
                  placeholder="Brief summary of key changes..."
                  value={newPolicy.summary}
                  onChange={(e) => setNewPolicy({ ...newPolicy, summary: e.target.value })}
                  rows={3}
                  data-testid="input-summary"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Full Content (optional)</label>
                <Textarea
                  placeholder="Full policy text if not using URL..."
                  value={newPolicy.content}
                  onChange={(e) => setNewPolicy({ ...newPolicy, content: e.target.value })}
                  rows={6}
                  data-testid="input-content"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)} data-testid="button-cancel">
                Cancel
              </Button>
              <Button
                onClick={() => createMutation.mutate(activeTab)}
                disabled={!newPolicy.version || !newPolicy.title || createMutation.isPending}
                data-testid="button-create"
              >
                {createMutation.isPending ? "Creating..." : "Create Version"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {policyCategories.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeTab === cat.key;
          return (
            <Card
              key={cat.key}
              className={`cursor-pointer transition-colors hover-elevate ${isActive ? "border-primary bg-primary/5" : ""}`}
              onClick={() => setActiveTab(cat.key)}
              data-testid={`card-category-${cat.key}`}
            >
              <CardContent className="p-4 text-center">
                <Icon className={`h-8 w-8 mx-auto mb-2 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                <p className="text-sm font-medium">{cat.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Active Policies
            </CardTitle>
            <CardDescription>Currently live policy versions</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading() ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : activePolicies.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
                <p>No active policies</p>
              </div>
            ) : (
              <ScrollArea className="h-[300px]">
                <div className="space-y-3">
                  {activePolicies.map((policy) => (
                    <div
                      key={policy.id}
                      className="p-4 rounded-lg border bg-green-50 dark:bg-green-950/20"
                      data-testid={`policy-active-${policy.id}`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{policy.title}</p>
                            <Badge variant="secondary">v{policy.version}</Badge>
                            <Badge className="bg-green-500">Active</Badge>
                          </div>
                          {policy.summary && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{policy.summary}</p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(policy.createdAt), "MMM d, yyyy")}
                            </span>
                            {policy.countryCode && (
                              <span className="flex items-center gap-1">
                                <Globe className="h-3 w-3" />
                                {policy.countryCode}
                              </span>
                            )}
                            {policy.targetRole && (
                              <Badge variant="outline" className="text-xs">
                                {policy.targetRole}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button size="icon" variant="ghost" data-testid={`button-view-${policy.id}`}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-500" />
              Draft Versions
            </CardTitle>
            <CardDescription>Pending activation</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading() ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : draftPolicies.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2" />
                <p>No draft policies</p>
              </div>
            ) : (
              <ScrollArea className="h-[300px]">
                <div className="space-y-3">
                  {draftPolicies.map((policy) => (
                    <div
                      key={policy.id}
                      className="p-4 rounded-lg border"
                      data-testid={`policy-draft-${policy.id}`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{policy.title}</p>
                            <Badge variant="secondary">v{policy.version}</Badge>
                            <Badge variant="outline">Draft</Badge>
                          </div>
                          {policy.summary && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{policy.summary}</p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(policy.createdAt), "MMM d, yyyy")}
                            </span>
                            {policy.countryCode && (
                              <span className="flex items-center gap-1">
                                <Globe className="h-3 w-3" />
                                {policy.countryCode}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => activateMutation.mutate({ category: activeTab, id: policy.id })}
                            disabled={activateMutation.isPending}
                            data-testid={`button-activate-${policy.id}`}
                          >
                            Activate
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Versions</CardTitle>
          <CardDescription>Complete version history for {policyCategories.find((c) => c.key === activeTab)?.label}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading() ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : policies.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2" />
              <p>No policies created yet</p>
              <Button className="mt-4" onClick={() => setCreateDialogOpen(true)} data-testid="button-create-first">
                <Plus className="h-4 w-4 mr-2" />
                Create First Policy
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Version</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {policies.map((policy) => (
                  <TableRow key={policy.id} data-testid={`row-policy-${policy.id}`}>
                    <TableCell>
                      <Badge variant="secondary">v{policy.version}</Badge>
                    </TableCell>
                    <TableCell>{policy.title}</TableCell>
                    <TableCell>
                      {policy.isActive ? (
                        <Badge className="bg-green-500">Active</Badge>
                      ) : (
                        <Badge variant="outline">Draft</Badge>
                      )}
                    </TableCell>
                    <TableCell>{policy.countryCode || "Global"}</TableCell>
                    <TableCell>{format(new Date(policy.createdAt), "MMM d, yyyy")}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="icon" variant="ghost" data-testid={`button-view-row-${policy.id}`}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {!policy.isActive && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => activateMutation.mutate({ category: activeTab, id: policy.id })}
                            disabled={activateMutation.isPending}
                            data-testid={`button-activate-row-${policy.id}`}
                          >
                            Activate
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
