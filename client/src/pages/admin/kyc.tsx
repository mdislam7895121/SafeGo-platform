import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, CheckCircle, XCircle, Clock, Store, Bus } from "lucide-react";
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
    refetchInterval: 30000,
  });

  const approveMutation = useMutation({
    mutationFn: async (data: { role: string; profileId: string }) => {
      const result = await apiRequest("/api/admin/kyc/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/kyc/pending?role=${selectedRole}`] });
      toast({
        title: "User approved",
        description: data?.message || "The user has been verified and can now use the platform",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Approval failed",
        description: error.message || "Failed to approve KYC",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (data: { role: string; profileId: string; reason: string }) => {
      const result = await apiRequest("/api/admin/kyc/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/kyc/pending?role=${selectedRole}`] });
      toast({
        title: "User rejected",
        description: data?.message || "The user has been notified of the rejection",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Rejection failed",
        description: error.message || "Failed to reject KYC",
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

  const renderUserCard = (user: any) => {
    const isBdRole = selectedRole === "shop_partner" || selectedRole === "ticket_operator";
    
    return (
      <Card key={user.id}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              {selectedRole === "shop_partner" && <Store className="h-5 w-5 text-primary" />}
              {selectedRole === "ticket_operator" && <Bus className="h-5 w-5 text-primary" />}
              <span className="text-base" data-testid={`text-email-${user.id}`}>{user.email}</span>
            </div>
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
              <p className="font-medium" data-testid={`text-country-${user.id}`}>
                {user.countryCode === "BD" ? "Bangladesh" : user.countryCode === "US" ? "United States" : user.countryCode}
              </p>
            </div>
            
            {user.ownerName && (
              <div>
                <p className="text-muted-foreground">Owner Name</p>
                <p className="font-medium" data-testid={`text-owner-${user.id}`}>{user.ownerName}</p>
              </div>
            )}
            
            {user.shopName && (
              <div>
                <p className="text-muted-foreground">Shop Name</p>
                <p className="font-medium" data-testid={`text-shop-name-${user.id}`}>{user.shopName}</p>
              </div>
            )}
            
            {user.shopType && (
              <div>
                <p className="text-muted-foreground">Shop Type</p>
                <p className="font-medium" data-testid={`text-shop-type-${user.id}`}>
                  {user.shopType.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
                </p>
              </div>
            )}
            
            {user.operatorName && (
              <div>
                <p className="text-muted-foreground">Operator Name</p>
                <p className="font-medium" data-testid={`text-operator-name-${user.id}`}>{user.operatorName}</p>
              </div>
            )}
            
            {user.operatorType && (
              <div>
                <p className="text-muted-foreground">Business Type</p>
                <p className="font-medium" data-testid={`text-operator-type-${user.id}`}>
                  {user.operatorType === "both" ? "Tickets & Rentals" : 
                   user.operatorType === "tickets" ? "Tickets Only" : "Rentals Only"}
                </p>
              </div>
            )}
            
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

          {isBdRole && (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground mb-2">KYC Documents (BD)</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">NID Required</Badge>
                <Badge variant="outline">Trade License</Badge>
                {selectedRole === "shop_partner" && <Badge variant="outline">MFS Account</Badge>}
                {selectedRole === "ticket_operator" && <Badge variant="outline">Business Registration</Badge>}
              </div>
            </div>
          )}

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
    );
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "driver": return "driver";
      case "customer": return "customer";
      case "restaurant": return "restaurant";
      case "shop_partner": return "Shop Partner";
      case "ticket_operator": return "Ticket Operator";
      default: return role;
    }
  };

  return (
    <div className="min-h-screen bg-background">
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
          <TabsList className="flex flex-wrap gap-3 items-center h-auto p-2 w-full">
            <TabsTrigger 
              value="driver" 
              data-testid="tab-driver"
              className="min-w-max whitespace-nowrap px-4"
            >
              Drivers
            </TabsTrigger>
            <TabsTrigger 
              value="customer" 
              data-testid="tab-customer"
              className="min-w-max whitespace-nowrap px-4"
            >
              Customers
            </TabsTrigger>
            <TabsTrigger 
              value="restaurant" 
              data-testid="tab-restaurant"
              className="min-w-max whitespace-nowrap px-4"
            >
              Restaurants
            </TabsTrigger>
            <TabsTrigger 
              value="shop_partner" 
              data-testid="tab-shop-partner"
              className="min-w-max whitespace-nowrap px-4"
            >
              <Store className="h-4 w-4 mr-1.5" />
              Shop Partners
            </TabsTrigger>
            <TabsTrigger 
              value="ticket_operator" 
              data-testid="tab-ticket-operator"
              className="min-w-max whitespace-nowrap px-4"
            >
              <Bus className="h-4 w-4 mr-1.5" />
              Ticket Operators
            </TabsTrigger>
          </TabsList>

          <TabsContent value={selectedRole} className="space-y-4 mt-6">
            {isLoading ? (
              <>
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </>
            ) : pendingUsers && (pendingUsers as any[]).length > 0 ? (
              (pendingUsers as any[]).map((user: any) => renderUserCard(user))
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">All caught up!</h3>
                  <p className="text-muted-foreground text-sm">
                    No pending {getRoleLabel(selectedRole)} verifications
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
