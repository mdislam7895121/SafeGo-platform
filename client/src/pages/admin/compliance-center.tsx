import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { 
  FileWarning, 
  Clock, 
  AlertTriangle,
  FileX,
  RefreshCw,
  User,
  Mail,
  CheckCircle
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ExpiringDocument {
  id: string;
  type: string;
  userId: string;
  userEmail: string;
  userName: string;
  userRole: string;
  expiryDate: string;
  daysUntilExpiry: number;
}

interface MissingDocument {
  id: string;
  userId: string;
  email: string;
  name: string;
  missingDocuments: string[];
  status: string;
}

export default function ComplianceCenter() {
  const [activeTab, setActiveTab] = useState("expiring");
  const [revalidateDialogOpen, setRevalidateDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{ id: string; docType: string } | null>(null);
  const [reason, setReason] = useState("");
  const { toast } = useToast();

  const { data: expiringDocs, isLoading: expiringLoading } = useQuery<{ documents: ExpiringDocument[]; total: number }>({
    queryKey: ["/api/admin/phase3a/compliance/expiring-documents"],
  });

  const { data: missingDocs, isLoading: missingLoading } = useQuery<{ partners: MissingDocument[]; total: number }>({
    queryKey: ["/api/admin/phase3a/compliance/missing-documents"],
  });

  const revalidateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/admin/phase3a/compliance/request-revalidation", {
        method: "POST",
        body: JSON.stringify({
          userId: selectedUser?.id,
          documentType: selectedUser?.docType,
          reason,
        }),
      });
    },
    onSuccess: () => {
      toast({ title: "Revalidation Requested", description: "The user has been notified to revalidate their documents." });
      setRevalidateDialogOpen(false);
      setReason("");
      setSelectedUser(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to request revalidation.", variant: "destructive" });
    },
  });

  const getExpiryBadge = (days: number) => {
    if (days <= 7) {
      return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">Expiring in {days} days</Badge>;
    } else if (days <= 14) {
      return <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">Expiring in {days} days</Badge>;
    } else {
      return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">Expiring in {days} days</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Partner Compliance Center</h1>
          <p className="text-muted-foreground">Monitor document expiry and KYC compliance</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card data-testid="card-stat-expiring">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Expiring Soon</p>
                <p className="text-2xl font-bold text-orange-600">{expiringDocs?.total || 0}</p>
              </div>
              <Clock className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-missing">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Missing Docs</p>
                <p className="text-2xl font-bold text-red-600">{missingDocs?.total || 0}</p>
              </div>
              <FileX className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-compliant">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Compliance Rate</p>
                <p className="text-2xl font-bold text-green-600">94.5%</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="expiring" data-testid="tab-expiring">
            <Clock className="h-4 w-4 mr-2" />
            Expiring Documents
          </TabsTrigger>
          <TabsTrigger value="missing" data-testid="tab-missing">
            <FileX className="h-4 w-4 mr-2" />
            Missing Documents
          </TabsTrigger>
        </TabsList>

        <TabsContent value="expiring">
          <Card>
            <CardHeader>
              <CardTitle>Documents Expiring Within 30 Days</CardTitle>
              <CardDescription>Take action before documents expire</CardDescription>
            </CardHeader>
            <CardContent>
              {expiringLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Partner</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Document Type</TableHead>
                        <TableHead>Expiry Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expiringDocs?.documents.map((doc) => (
                        <TableRow key={doc.id} data-testid={`row-doc-${doc.id}`}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <div className="font-medium">{doc.userName || "Unknown"}</div>
                                <div className="text-sm text-muted-foreground">{doc.userEmail}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{doc.userRole}</Badge>
                          </TableCell>
                          <TableCell>{doc.type}</TableCell>
                          <TableCell>{format(new Date(doc.expiryDate), "MMM dd, yyyy")}</TableCell>
                          <TableCell>{getExpiryBadge(doc.daysUntilExpiry)}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedUser({ id: doc.userId, docType: doc.type });
                                  setRevalidateDialogOpen(true);
                                }}
                                data-testid={`button-notify-${doc.id}`}
                              >
                                <Mail className="h-4 w-4 mr-1" />
                                Notify
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {expiringDocs?.documents.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No documents expiring soon
                    </div>
                  )}
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="missing">
          <Card>
            <CardHeader>
              <CardTitle>Partners with Missing Documents</CardTitle>
              <CardDescription>Partners who need to complete their documentation</CardDescription>
            </CardHeader>
            <CardContent>
              {missingLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-24" />
                  ))}
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-4">
                    {missingDocs?.partners.map((partner) => (
                      <Card key={partner.id} className="hover-elevate" data-testid={`partner-${partner.id}`}>
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{partner.name || "Unknown"}</span>
                                <Badge variant="outline">{partner.status}</Badge>
                              </div>
                              <div className="text-sm text-muted-foreground">{partner.email}</div>
                              <div className="flex flex-wrap gap-2">
                                {partner.missingDocuments.map((doc) => (
                                  <Badge key={doc} variant="destructive" className="text-xs">
                                    <FileWarning className="h-3 w-3 mr-1" />
                                    {doc}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedUser({ id: partner.userId, docType: partner.missingDocuments[0] });
                                setRevalidateDialogOpen(true);
                              }}
                              data-testid={`button-request-${partner.id}`}
                            >
                              <RefreshCw className="h-4 w-4 mr-1" />
                              Request Docs
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {missingDocs?.partners.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        All partners have complete documentation
                      </div>
                    )}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={revalidateDialogOpen} onOpenChange={setRevalidateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Document Revalidation</DialogTitle>
            <DialogDescription>
              Send a notification to the partner to update their {selectedUser?.docType}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Message to Partner</label>
              <Textarea
                placeholder="Enter a message explaining why revalidation is needed..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                data-testid="input-revalidation-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevalidateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => revalidateMutation.mutate()}
              disabled={revalidateMutation.isPending || !reason}
              data-testid="button-send-request"
            >
              {revalidateMutation.isPending ? "Sending..." : "Send Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
