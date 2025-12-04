import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  CreditCard, 
  AlertTriangle, 
  DollarSign,
  Scale,
  CheckCircle,
  XCircle,
  Clock,
  Eye
} from "lucide-react";
import { format } from "date-fns";

interface FailedPayment {
  id: string;
  amount: number;
  type: string;
  userEmail: string;
  failedAt: string;
  reason: string;
}

interface Dispute {
  id: string;
  amount: number;
  status: string;
  userId: string;
  reason: string;
  createdAt: string;
}

interface Reconciliation {
  date: string;
  summary: {
    expectedRevenue: number;
    actualRevenue: number;
    discrepancy: number;
    status: string;
  };
  breakdown: {
    rides: { expected: number; actual: number; difference: number };
    food: { expected: number; actual: number; difference: number };
    parcel: { expected: number; actual: number; difference: number };
  };
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
};

export default function PaymentVerification() {
  const [activeTab, setActiveTab] = useState("failed");

  const { data: failed, isLoading: failedLoading } = useQuery<{ transactions: FailedPayment[]; total: number }>({
    queryKey: ["/api/admin/phase3a/payments/failed"],
  });

  const { data: disputes, isLoading: disputesLoading } = useQuery<{ disputes: Dispute[]; total: number }>({
    queryKey: ["/api/admin/phase3a/payments/disputes"],
  });

  const { data: reconciliation, isLoading: reconciliationLoading } = useQuery<Reconciliation>({
    queryKey: ["/api/admin/phase3a/payments/reconciliation"],
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Payment Verification Console</h1>
          <p className="text-muted-foreground">Monitor failed payments, disputes, and reconciliation</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card data-testid="card-stat-failed">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Failed Payments</p>
                <p className="text-2xl font-bold text-red-600">{failed?.total || 0}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-disputes">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Open Disputes</p>
                <p className="text-2xl font-bold text-orange-600">{disputes?.total || 0}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-discrepancy">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Today's Discrepancy</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(reconciliation?.summary.discrepancy || 0)}
                </p>
              </div>
              <Scale className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-status">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Reconciliation Status</p>
                <Badge variant={reconciliation?.summary.status === "ok" ? "default" : "secondary"} className="mt-1">
                  {reconciliation?.summary.status || "Pending"}
                </Badge>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="failed" data-testid="tab-failed">
            <XCircle className="h-4 w-4 mr-2" />
            Failed Payments
          </TabsTrigger>
          <TabsTrigger value="disputes" data-testid="tab-disputes">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Disputes
          </TabsTrigger>
          <TabsTrigger value="reconciliation" data-testid="tab-reconciliation">
            <Scale className="h-4 w-4 mr-2" />
            Reconciliation
          </TabsTrigger>
        </TabsList>

        <TabsContent value="failed">
          <Card>
            <CardHeader>
              <CardTitle>Failed Payment Transactions</CardTitle>
              <CardDescription>Payments that failed processing</CardDescription>
            </CardHeader>
            <CardContent>
              {failedLoading ? (
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
                        <TableHead>ID</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Failed At</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {failed?.transactions.map((tx) => (
                        <TableRow key={tx.id} data-testid={`row-failed-${tx.id}`}>
                          <TableCell className="font-mono text-sm">{tx.id.slice(0, 8)}...</TableCell>
                          <TableCell>{tx.userEmail || "Unknown"}</TableCell>
                          <TableCell className="font-medium text-red-600">
                            {formatCurrency(tx.amount)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{tx.type}</Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {format(new Date(tx.failedAt), "MMM dd, HH:mm")}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">{tx.reason}</TableCell>
                          <TableCell>
                            <Button size="sm" variant="outline" data-testid={`button-view-${tx.id}`}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {failed?.transactions.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No failed payments
                    </div>
                  )}
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="disputes">
          <Card>
            <CardHeader>
              <CardTitle>Payment Disputes</CardTitle>
              <CardDescription>User-reported payment issues</CardDescription>
            </CardHeader>
            <CardContent>
              {disputesLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-24" />
                  ))}
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-4">
                    {disputes?.disputes.map((dispute) => (
                      <Card key={dispute.id} className="hover-elevate" data-testid={`dispute-${dispute.id}`}>
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm text-muted-foreground">{dispute.id}</span>
                                <Badge
                                  variant={dispute.status === "open" ? "destructive" : dispute.status === "investigating" ? "secondary" : "default"}
                                >
                                  {dispute.status}
                                </Badge>
                              </div>
                              <div className="font-medium text-lg">{formatCurrency(dispute.amount)}</div>
                              <div className="text-sm text-muted-foreground">{dispute.reason}</div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {format(new Date(dispute.createdAt), "MMM dd, yyyy HH:mm")}
                              </div>
                            </div>
                            <Button size="sm" variant="outline" data-testid={`button-investigate-${dispute.id}`}>
                              <Eye className="h-4 w-4 mr-1" />
                              Investigate
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {disputes?.disputes.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        No open disputes
                      </div>
                    )}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reconciliation">
          <Card>
            <CardHeader>
              <CardTitle>Daily Reconciliation</CardTitle>
              <CardDescription>Compare expected vs actual revenue</CardDescription>
            </CardHeader>
            <CardContent>
              {reconciliationLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-32" />
                  <Skeleton className="h-48" />
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-sm text-muted-foreground">Expected Revenue</p>
                        <p className="text-2xl font-bold">
                          {formatCurrency(reconciliation?.summary.expectedRevenue || 0)}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-sm text-muted-foreground">Actual Revenue</p>
                        <p className="text-2xl font-bold text-green-600">
                          {formatCurrency(reconciliation?.summary.actualRevenue || 0)}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-sm text-muted-foreground">Discrepancy</p>
                        <p className={`text-2xl font-bold ${(reconciliation?.summary.discrepancy || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {formatCurrency(reconciliation?.summary.discrepancy || 0)}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium">Breakdown by Service</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Service</TableHead>
                          <TableHead>Expected</TableHead>
                          <TableHead>Actual</TableHead>
                          <TableHead>Difference</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reconciliation?.breakdown && Object.entries(reconciliation.breakdown).map(([service, data]) => (
                          <TableRow key={service}>
                            <TableCell className="font-medium capitalize">{service}</TableCell>
                            <TableCell>{formatCurrency(data.expected)}</TableCell>
                            <TableCell>{formatCurrency(data.actual)}</TableCell>
                            <TableCell className={data.difference > 0 ? 'text-red-600' : 'text-green-600'}>
                              {formatCurrency(data.difference)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
