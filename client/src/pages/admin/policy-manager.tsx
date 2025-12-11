import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  FileText, 
  Plus, 
  Clock,
  CheckCircle,
  Users,
  Eye,
  Edit
} from "lucide-react";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Policy {
  id: string;
  name: string;
  version: string;
  publishedAt: string;
  acceptanceRate: number;
}

interface PolicyAcceptance {
  policyId: string;
  total: number;
  accepted: number;
  pending: number;
  acceptanceRate: number;
}

export default function PolicyManager() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
  const [newPolicy, setNewPolicy] = useState({
    name: "",
    content: "",
    version: "",
    effectiveDate: "",
    requiresAcceptance: true,
  });
  const { toast } = useToast();

  const { data: policies, isLoading } = useQuery<{ policies: Policy[] }>({
    queryKey: ["/api/admin/phase3a/policies"],
  });

  const { data: acceptances } = useQuery<PolicyAcceptance>({
    queryKey: ["/api/admin/phase3a/policies", selectedPolicy?.id, "acceptances"],
    enabled: !!selectedPolicy?.id && viewDialogOpen,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/admin/phase3a/policies", {
        method: "POST",
        body: JSON.stringify(newPolicy),
      });
    },
    onSuccess: () => {
      toast({ title: "Policy Published", description: "New policy has been published." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/phase3a/policies"] });
      setCreateDialogOpen(false);
      setNewPolicy({ name: "", content: "", version: "", effectiveDate: "", requiresAcceptance: true });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to publish policy.", variant: "destructive" });
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Policy Update Manager</h1>
          <p className="text-muted-foreground">Version-controlled policy publications and acceptance tracking</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-policy">
              <Plus className="h-4 w-4 mr-2" />
              New Policy
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Publish New Policy</DialogTitle>
              <DialogDescription>Create a new policy version for user acceptance</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Policy Name</label>
                  <Input
                    placeholder="e.g., Terms of Service"
                    value={newPolicy.name}
                    onChange={(e) => setNewPolicy({ ...newPolicy, name: e.target.value })}
                    data-testid="input-policy-name"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Version</label>
                  <Input
                    placeholder="e.g., 2.0.0"
                    value={newPolicy.version}
                    onChange={(e) => setNewPolicy({ ...newPolicy, version: e.target.value })}
                    data-testid="input-version"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Effective Date</label>
                <Input
                  type="date"
                  value={newPolicy.effectiveDate}
                  onChange={(e) => setNewPolicy({ ...newPolicy, effectiveDate: e.target.value })}
                  data-testid="input-effective-date"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Policy Content</label>
                <Textarea
                  placeholder="Enter the policy content..."
                  value={newPolicy.content}
                  onChange={(e) => setNewPolicy({ ...newPolicy, content: e.target.value })}
                  rows={10}
                  data-testid="input-content"
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="requires-acceptance"
                  checked={newPolicy.requiresAcceptance}
                  onCheckedChange={(checked) => setNewPolicy({ ...newPolicy, requiresAcceptance: !!checked })}
                />
                <label htmlFor="requires-acceptance" className="text-sm">Require user acceptance</label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !newPolicy.name || !newPolicy.version}
                data-testid="button-publish"
              >
                {createMutation.isPending ? "Publishing..." : "Publish Policy"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card data-testid="card-stat-total">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Policies</p>
                <p className="text-2xl font-bold">{policies?.policies.length || 0}</p>
              </div>
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-acceptance">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Acceptance Rate</p>
                <p className="text-2xl font-bold text-green-600">
                  {policies?.policies.length
                    ? (policies.policies.reduce((sum, p) => sum + p.acceptanceRate, 0) / policies.policies.length).toFixed(1)
                    : 0}%
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-recent">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Last Published</p>
                <p className="text-sm font-medium">
                  {policies?.policies[0]
                    ? format(new Date(policies.policies[0].publishedAt), "MMM dd, yyyy")
                    : "N/A"}
                </p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Published Policies</CardTitle>
          <CardDescription>All active policies and their acceptance rates</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-4">
                {policies?.policies.map((policy) => (
                  <Card key={policy.id} className="hover-elevate" data-testid={`policy-${policy.id}`}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                            <span className="font-medium">{policy.name}</span>
                            <Badge variant="outline">v{policy.version}</Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Published: {format(new Date(policy.publishedAt), "MMM dd, yyyy")}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {policy.acceptanceRate}% accepted
                            </span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div
                              className="bg-green-500 h-2 rounded-full"
                              style={{ width: `${policy.acceptanceRate}%` }}
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedPolicy(policy);
                              setViewDialogOpen(true);
                            }}
                            data-testid={`button-view-${policy.id}`}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                          <Button size="sm" variant="outline" data-testid={`button-edit-${policy.id}`}>
                            <Edit className="h-4 w-4 mr-1" />
                            New Version
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {policies?.policies.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No policies published yet
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedPolicy?.name} v{selectedPolicy?.version}</DialogTitle>
            <DialogDescription>Policy acceptance statistics</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg text-center">
                <p className="text-sm text-muted-foreground">Total Users</p>
                <p className="text-2xl font-bold">{acceptances?.total || 0}</p>
              </div>
              <div className="p-4 border rounded-lg text-center">
                <p className="text-sm text-muted-foreground">Accepted</p>
                <p className="text-2xl font-bold text-green-600">{acceptances?.accepted || 0}</p>
              </div>
              <div className="p-4 border rounded-lg text-center">
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{acceptances?.pending || 0}</p>
              </div>
              <div className="p-4 border rounded-lg text-center">
                <p className="text-sm text-muted-foreground">Rate</p>
                <p className="text-2xl font-bold">{acceptances?.acceptanceRate || 0}%</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
