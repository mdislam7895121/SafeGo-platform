import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function AdminSettlement() {
  const { toast } = useToast();
  const [walletType, setWalletType] = useState<string>("");
  const [walletId, setWalletId] = useState("");
  const [settlementAmount, setSettlementAmount] = useState("");

  const settleMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/admin/settle-wallet", data);
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Settlement successful",
        description: data.message,
      });
      setWalletId("");
      setSettlementAmount("");
    },
    onError: (error: any) => {
      toast({
        title: "Settlement failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!walletType) {
      toast({
        title: "Missing information",
        description: "Please select wallet type",
        variant: "destructive",
      });
      return;
    }

    settleMutation.mutate({
      walletType,
      walletId,
      settlementAmount: parseFloat(settlementAmount),
    });
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
          <h1 className="text-2xl font-bold">Wallet Settlement</h1>
        </div>
      </div>

      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Settle Negative Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="walletType">Wallet Type</Label>
                <Select value={walletType} onValueChange={setWalletType} required>
                  <SelectTrigger id="walletType" data-testid="select-wallet-type">
                    <SelectValue placeholder="Select wallet type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="driver">Driver Wallet</SelectItem>
                    <SelectItem value="restaurant">Restaurant Wallet</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="walletId">Wallet ID</Label>
                <Input
                  id="walletId"
                  placeholder="Enter wallet UUID"
                  value={walletId}
                  onChange={(e) => setWalletId(e.target.value)}
                  required
                  data-testid="input-wallet-id"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Find the wallet ID from the driver/restaurant profile
                </p>
              </div>

              <div>
                <Label htmlFor="amount">Settlement Amount ($)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={settlementAmount}
                  onChange={(e) => setSettlementAmount(e.target.value)}
                  required
                  data-testid="input-settlement-amount"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Amount to deduct from negative balance
                </p>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={settleMutation.isPending}
                data-testid="button-settle"
              >
                {settleMutation.isPending ? "Processing..." : "Process Settlement"}
              </Button>
            </form>

            <div className="mt-6 p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">Settlement Process</h4>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Driver/restaurant pays SafeGo commission in cash or bank transfer</li>
                <li>Admin enters the settlement amount here</li>
                <li>System reduces their negative balance accordingly</li>
                <li>Balance becomes available for withdrawal when positive</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
