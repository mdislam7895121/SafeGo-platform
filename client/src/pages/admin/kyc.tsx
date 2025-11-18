import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, CheckCircle, XCircle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminKYC() {
  const { toast } = useToast();
  const [selectedRole, setSelectedRole] = useState<string>("driver");

  const { data: pendingUsers, isLoading } = useQuery({
    queryKey: [`/api/admin/kyc/pending?role=${selectedRole}`],
    refetchInterval: 5000,
  });

  const approveMutation = useMutation({
    mutationFn: async (data: { role: string; profileId: string }) => {
      const res = await apiRequest("POST", "/api/admin/kyc/approve", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/kyc/pending"] });
      toast({
        title: "User approved",
        description: "The user has been verified and can now use the platform",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Approval failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (data: { role: string; profileId: string; reason: string }) => {
      const res = await apiRequest("POST", "/api/admin/kyc/reject", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/kyc/pending"] });
      toast({
        title: "User rejected",
        description: "The user has been notified of the rejection",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Rejection failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleApprove = (profileId: string) => {
    approveMutation.mutate({ role: selectedRole, profileId });
  };

  const handleReject = (profileId: string) => {
    const reason = prompt("Enter rejection reason:");
    if (reason) {
      rejectMutation.mutate({ role: selectedRole, profileId, reason });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-6 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link href="/admin">
            <Button variant="ghost" size="icon" className="text-primary-foreground" data-testid="button-back">
              <ArrowLeft className="h-6 w-6" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">KYC Approvals</h1>
        </div>
      </div>

      <div className="p-6">
        <Tabs defaultValue="driver" onValueChange={setSelectedRole}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="driver" data-testid="tab-driver">Drivers</TabsTrigger>
            <TabsTrigger value="customer" data-testid="tab-customer">Customers</TabsTrigger>
            <TabsTrigger value="restaurant" data-testid="tab-restaurant">Restaurants</TabsTrigger>
          </TabsList>

          <TabsContent value={selectedRole} className="space-y-4 mt-6">
            {isLoading ? (
              <>
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </>
            ) : pendingUsers && (pendingUsers as any[]).length > 0 ? (
              (pendingUsers as any[]).map((user: any) => (
                <Card key={user.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="text-base" data-testid={`text-email-${user.id}`}>{user.email}</span>
                      <Badge variant="secondary">
                        <Clock className="h-3 w-3 mr-1" />
                        Pending
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground">Country</p>
                        <p className="font-medium">{user.countryCode === "BD" ? "🇧🇩 Bangladesh" : "🇺🇸 United States"}</p>
                      </div>
                      {user.dateOfBirth && (
                        <div>
                          <p className="text-muted-foreground">Date of Birth</p>
                          <p className="font-medium">{new Date(user.dateOfBirth).toLocaleDateString()}</p>
                        </div>
                      )}
                      {user.nid && (
                        <div>
                          <p className="text-muted-foreground">NID</p>
                          <p className="font-medium">{user.nid}</p>
                        </div>
                      )}
                      {user.governmentId && (
                        <div>
                          <p className="text-muted-foreground">Government ID</p>
                          <p className="font-medium">{user.governmentId}</p>
                        </div>
                      )}
                      {user.restaurantName && (
                        <div>
                          <p className="text-muted-foreground">Restaurant Name</p>
                          <p className="font-medium">{user.restaurantName}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-3 pt-4 border-t">
                      <Button
                        variant="default"
                        className="flex-1"
                        onClick={() => handleApprove(user.id)}
                        disabled={approveMutation.isPending || rejectMutation.isPending}
                        data-testid={`button-approve-${user.id}`}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Approve
                      </Button>
                      <Button
                        variant="destructive"
                        className="flex-1"
                        onClick={() => handleReject(user.id)}
                        disabled={approveMutation.isPending || rejectMutation.isPending}
                        data-testid={`button-reject-${user.id}`}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Reject
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">All caught up!</h3>
                  <p className="text-muted-foreground text-sm">
                    No pending {selectedRole} verifications
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
