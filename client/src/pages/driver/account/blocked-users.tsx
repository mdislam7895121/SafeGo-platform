import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface BlockedRider {
  id: string;
  customerId: string;
  customerEmail: string;
  customerName: string;
  reason: string | null;
  blockedAt: string;
}

export default function BlockedUsers() {
  const { toast } = useToast();

  // Fetch blocked riders
  const { data: blockedData, isLoading } = useQuery({
    queryKey: ["/api/driver/blocked-riders"],
  });

  const blockedRiders = (blockedData as any)?.blockedRiders || [];

  // Mutation to unblock a rider
  const unblockMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await apiRequest(`/api/driver/blocked-riders/${id}`, {
        method: "DELETE",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/blocked-riders"] });
      toast({
        title: "Rider unblocked",
        description: "This rider can now be matched with you again",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error unblocking rider",
        description: error.message || "Unable to unblock rider. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="bg-background">
        <div className="bg-primary text-primary-foreground p-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-md" />
            <Skeleton className="h-8 w-48" />
          </div>
        </div>
        <div className="p-6 max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64 mt-2" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background">
      <div className="bg-primary text-primary-foreground p-6">
        <div className="flex items-center gap-4">
          <Link href="/driver/account">
            <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10" data-testid="button-back">
              <ArrowLeft className="h-6 w-6" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Blocked Users</h1>
        </div>
      </div>

      <div className="p-6 max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Blocked Riders</CardTitle>
            <CardDescription>Riders you've blocked won't be matched with you</CardDescription>
          </CardHeader>
          <CardContent>
            {blockedRiders.length === 0 ? (
              <div className="text-center py-12">
                <UserX className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="font-semibold mb-2">No Blocked Users</h3>
                <p className="text-sm text-muted-foreground">
                  You haven't blocked any riders yet
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {blockedRiders.map((rider: BlockedRider) => (
                  <div
                    key={rider.id}
                    className="flex items-start justify-between p-4 rounded-lg border"
                    data-testid={`blocked-rider-${rider.id}`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <UserX className="h-4 w-4 text-muted-foreground" />
                        <h4 className="font-semibold">{rider.customerName}</h4>
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">{rider.customerEmail}</p>
                      {rider.reason && (
                        <p className="text-sm text-muted-foreground italic">
                          Reason: {rider.reason}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        Blocked on {new Date(rider.blockedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => unblockMutation.mutate(rider.id)}
                      disabled={unblockMutation.isPending}
                      data-testid={`button-unblock-${rider.id}`}
                    >
                      {unblockMutation.isPending ? "Unblocking..." : "Unblock"}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
