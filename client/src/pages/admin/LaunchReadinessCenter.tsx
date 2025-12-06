import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Rocket, 
  CheckCircle, 
  XCircle, 
  Clock,
  Play,
  FileCheck,
  Award,
  AlertTriangle,
  Plus,
  RefreshCw,
  Download
} from "lucide-react";
import { format } from "date-fns";

const CATEGORY_LABELS: Record<string, string> = {
  kyc_flows: "KYC Flows",
  ride_booking: "Ride Booking",
  delivery_booking: "Delivery Booking",
  food_ordering: "Food Ordering",
  partner_onboarding: "Partner Onboarding",
  finance_settlement: "Finance & Settlement",
  fraud_system: "Fraud System",
  security_layer: "Security Layer",
  notification_layer: "Notification Layer",
  rating_engine: "Rating Engine",
  data_export_delete: "Data Export/Delete"
};

export default function LaunchReadinessCenter() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [newReportName, setNewReportName] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const { data: reports, isLoading: reportsLoading } = useQuery({
    queryKey: ["/api/admin/uat/reports"],
  });

  const { data: certificates, isLoading: certificatesLoading } = useQuery({
    queryKey: ["/api/admin/uat/certificates"],
  });

  const { data: currentReport, isLoading: reportLoading } = useQuery({
    queryKey: ["/api/admin/uat/reports", selectedReport],
    enabled: !!selectedReport,
  });

  const createReportMutation = useMutation({
    mutationFn: (reportName: string) => 
      apiRequest("/api/admin/uat/reports", { 
        method: "POST",
        body: JSON.stringify({ reportName })
      }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/uat/reports"] });
      setSelectedReport(data.id);
      setCreateDialogOpen(false);
      setNewReportName("");
      toast({ title: "UAT Report created" });
    },
    onError: () => toast({ title: "Failed to create report", variant: "destructive" }),
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ itemId, status, notes }: { itemId: string; status: string; notes?: string }) => 
      apiRequest(`/api/admin/uat/items/${itemId}`, { 
        method: "PATCH",
        body: JSON.stringify({ status, notes })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/uat/reports", selectedReport] });
      toast({ title: "Item updated" });
    },
    onError: () => toast({ title: "Failed to update item", variant: "destructive" }),
  });

  const signoffMutation = useMutation({
    mutationFn: ({ reportId, category }: { reportId: string; category: string }) => 
      apiRequest(`/api/admin/uat/reports/${reportId}/signoff`, { 
        method: "POST",
        body: JSON.stringify({ category })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/uat/reports", selectedReport] });
      toast({ title: "Category signed off" });
    },
    onError: (error: any) => toast({ title: error?.message || "Failed to sign off", variant: "destructive" }),
  });

  const generateCertificateMutation = useMutation({
    mutationFn: (reportId: string) => 
      apiRequest(`/api/admin/uat/reports/${reportId}/certificate`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/uat/reports", selectedReport] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/uat/certificates"] });
      toast({ title: "Launch Readiness Certificate generated!" });
    },
    onError: (error: any) => toast({ 
      title: "Cannot generate certificate", 
      description: error?.message || "Not all tests have passed",
      variant: "destructive" 
    }),
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "passed":
        return <Badge className="bg-green-500 hover-elevate"><CheckCircle className="w-3 h-3 mr-1" /> Passed</Badge>;
      case "failed":
        return <Badge variant="destructive" className="hover-elevate"><XCircle className="w-3 h-3 mr-1" /> Failed</Badge>;
      case "blocked":
        return <Badge variant="outline" className="hover-elevate"><AlertTriangle className="w-3 h-3 mr-1" /> Blocked</Badge>;
      case "skipped":
        return <Badge variant="secondary" className="hover-elevate">Skipped</Badge>;
      default:
        return <Badge variant="outline" className="hover-elevate"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
    }
  };

  const getReportStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500 hover-elevate"><CheckCircle className="w-3 h-3 mr-1" /> Completed</Badge>;
      case "certified":
        return <Badge className="bg-blue-500 hover-elevate"><Award className="w-3 h-3 mr-1" /> Certified</Badge>;
      case "failed":
        return <Badge variant="destructive" className="hover-elevate"><XCircle className="w-3 h-3 mr-1" /> Failed</Badge>;
      default:
        return <Badge variant="outline" className="hover-elevate"><Play className="w-3 h-3 mr-1" /> In Progress</Badge>;
    }
  };

  const groupItemsByCategory = (items: any[]) => {
    const grouped: Record<string, any[]> = {};
    for (const item of items) {
      if (!grouped[item.category]) {
        grouped[item.category] = [];
      }
      grouped[item.category].push(item);
    }
    return grouped;
  };

  const getCategoryProgress = (items: any[]) => {
    const passed = items.filter(i => i.status === "passed").length;
    return Math.round((passed / items.length) * 100);
  };

  const isCategoryComplete = (items: any[]) => {
    return items.every(i => i.status === "passed");
  };

  const isCategorySignedOff = (category: string) => {
    return currentReport?.signoffs?.some((s: any) => s.category === category);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Launch Readiness Center</h1>
          <p className="text-muted-foreground">UAT testing and launch certification</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-report">
              <Plus className="w-4 h-4 mr-2" />
              New UAT Report
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create UAT Report</DialogTitle>
              <DialogDescription>Start a new User Acceptance Testing cycle</DialogDescription>
            </DialogHeader>
            <Input
              placeholder="Report name (e.g., Pre-Launch UAT v1.0)"
              value={newReportName}
              onChange={(e) => setNewReportName(e.target.value)}
              data-testid="input-report-name"
            />
            <DialogFooter>
              <Button 
                onClick={() => createReportMutation.mutate(newReportName)}
                disabled={!newReportName || createReportMutation.isPending}
                data-testid="button-confirm-create"
              >
                Create Report
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="hover-elevate">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-muted">
                <FileCheck className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Reports</p>
                <p className="text-2xl font-bold">{reports?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-muted">
                <Play className="w-6 h-6 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">In Progress</p>
                <p className="text-2xl font-bold">
                  {reports?.filter((r: any) => r.status === "in_progress").length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-muted">
                <CheckCircle className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold">
                  {reports?.filter((r: any) => r.status === "completed" || r.status === "certified").length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-muted">
                <Award className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Certificates</p>
                <p className="text-2xl font-bold">{certificates?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="testing" data-testid="tab-testing">Testing</TabsTrigger>
          <TabsTrigger value="certificates" data-testid="tab-certificates">Certificates</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>UAT Reports</CardTitle>
              <CardDescription>All User Acceptance Testing cycles</CardDescription>
            </CardHeader>
            <CardContent>
              {reportsLoading ? (
                <div className="h-40 bg-muted animate-pulse rounded" />
              ) : reports?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileCheck className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No UAT reports yet</p>
                  <p className="text-sm">Create a new report to start testing</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {reports?.map((report: any) => (
                    <div 
                      key={report.id} 
                      className="p-4 border rounded-lg hover-elevate cursor-pointer"
                      onClick={() => {
                        setSelectedReport(report.id);
                        setActiveTab("testing");
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold">{report.reportName}</h4>
                        {getReportStatusBadge(report.status)}
                      </div>
                      <div className="mb-2">
                        <Progress value={report.passRate || 0} className="h-2" />
                      </div>
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>
                          {report.passedItems}/{report.totalItems} tests passed ({report.passRate?.toFixed(1) || 0}%)
                        </span>
                        <span>{format(new Date(report.createdAt), "PPp")}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="testing" className="space-y-4">
          {!selectedReport ? (
            <Card>
              <CardContent className="p-8 text-center">
                <FileCheck className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground">Select a report from the Overview tab to start testing</p>
              </CardContent>
            </Card>
          ) : reportLoading ? (
            <Card><CardContent className="p-6"><div className="h-60 bg-muted animate-pulse rounded" /></CardContent></Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{currentReport?.reportName}</CardTitle>
                      <CardDescription>
                        {currentReport?.passedItems}/{currentReport?.totalItems} tests passed
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {getReportStatusBadge(currentReport?.status)}
                      {currentReport?.status === "completed" && (
                        <Button 
                          onClick={() => generateCertificateMutation.mutate(selectedReport!)}
                          disabled={generateCertificateMutation.isPending}
                          className="bg-green-600 hover:bg-green-700"
                          data-testid="button-generate-certificate"
                        >
                          <Award className="w-4 h-4 mr-2" />
                          Generate Certificate
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Progress value={currentReport?.passRate || 0} className="h-3 mb-4" />
                </CardContent>
              </Card>

              <div className="space-y-4">
                {Object.entries(groupItemsByCategory(currentReport?.items || [])).map(([category, items]) => (
                  <Card key={category}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg">{CATEGORY_LABELS[category] || category}</CardTitle>
                          <Badge variant="outline">{items.length} tests</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            {getCategoryProgress(items)}% complete
                          </span>
                          {isCategoryComplete(items) && !isCategorySignedOff(category) && (
                            <Button 
                              size="sm"
                              onClick={() => signoffMutation.mutate({ reportId: selectedReport!, category })}
                              disabled={signoffMutation.isPending}
                              data-testid={`button-signoff-${category}`}
                            >
                              Sign Off
                            </Button>
                          )}
                          {isCategorySignedOff(category) && (
                            <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" /> Signed Off</Badge>
                          )}
                        </div>
                      </div>
                      <Progress value={getCategoryProgress(items)} className="h-1" />
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="max-h-60">
                        <div className="space-y-2">
                          {items.map((item: any) => (
                            <div 
                              key={item.id} 
                              className="flex items-center justify-between p-3 bg-muted rounded-lg"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs text-muted-foreground">{item.itemCode}</span>
                                  <span className="font-medium">{item.title}</span>
                                </div>
                                {item.description && (
                                  <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {getStatusBadge(item.status)}
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                    onClick={() => updateItemMutation.mutate({ itemId: item.id, status: "passed" })}
                                    disabled={updateItemMutation.isPending}
                                    data-testid={`button-pass-${item.itemCode}`}
                                  >
                                    <CheckCircle className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => updateItemMutation.mutate({ itemId: item.id, status: "failed" })}
                                    disabled={updateItemMutation.isPending}
                                    data-testid={`button-fail-${item.itemCode}`}
                                  >
                                    <XCircle className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="certificates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Launch Readiness Certificates</CardTitle>
              <CardDescription>Official certificates for production deployment</CardDescription>
            </CardHeader>
            <CardContent>
              {certificatesLoading ? (
                <div className="h-40 bg-muted animate-pulse rounded" />
              ) : certificates?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Award className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No certificates issued yet</p>
                  <p className="text-sm">Complete all UAT tests to generate a certificate</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {certificates?.map((cert: any) => (
                    <div 
                      key={cert.id} 
                      className="p-6 border-2 border-dashed rounded-lg hover-elevate"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-lg">
                            <Award className="w-8 h-8 text-white" />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold">SafeGo Launch Readiness Certificate</h3>
                            <p className="text-sm font-mono text-muted-foreground">{cert.certificateNumber}</p>
                            <p className="text-sm text-muted-foreground mt-1">
                              {cert.report?.reportName} - Pass Rate: {cert.passRate?.toFixed(1)}%
                            </p>
                          </div>
                        </div>
                        <Badge className={cert.status === "valid" ? "bg-green-500" : "bg-red-500"}>
                          {cert.status.toUpperCase()}
                        </Badge>
                      </div>
                      
                      <Separator className="my-4" />
                      
                      <div className="grid gap-4 md:grid-cols-3 text-sm">
                        <div>
                          <span className="text-muted-foreground">Issued By</span>
                          <p className="font-medium">{cert.issuedByName}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Issued At</span>
                          <p className="font-medium">{format(new Date(cert.issuedAt), "PPp")}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Signature</span>
                          <p className="font-mono text-xs truncate">{cert.signatureHash?.slice(0, 16)}...</p>
                        </div>
                      </div>

                      <div className="mt-4 p-4 bg-muted rounded-lg">
                        <h4 className="font-semibold mb-2">Certificate Summary</h4>
                        <div className="grid gap-2 text-sm">
                          <div className="flex justify-between">
                            <span>Total Tests</span>
                            <span className="font-medium">{cert.summary?.totalTests}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Passed Tests</span>
                            <span className="font-medium text-green-600">{cert.summary?.passedTests}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Categories Tested</span>
                            <span className="font-medium">{Object.keys(cert.summary?.categories || {}).length}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
