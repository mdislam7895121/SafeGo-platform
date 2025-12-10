import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Heart, Loader2, CheckCircle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/formatCurrency";

interface TipCardProps {
  rideId: string;
  currency: string;
  existingTip?: number | null;
  onTipAdded?: (amount: number) => void;
  className?: string;
}

export function TipCard({ rideId, currency, existingTip, onTipAdded, className = "" }: TipCardProps) {
  const { toast } = useToast();
  const [customAmount, setCustomAmount] = useState("");
  const [tipAdded, setTipAdded] = useState(!!existingTip);
  const [finalTipAmount, setFinalTipAmount] = useState(existingTip || 0);

  const quickTips = currency === "BDT" 
    ? [20, 50, 100] 
    : [2, 5, 10];

  const tipMutation = useMutation({
    mutationFn: async (amount: number) => {
      return apiRequest(`/api/rides/${rideId}/tip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, currency }),
      });
    },
    onSuccess: (data) => {
      setTipAdded(true);
      setFinalTipAmount(data.tipAmount);
      queryClient.invalidateQueries({ queryKey: ["/api/rides", rideId] });
      toast({
        title: "Tip Added",
        description: data.message || "Thank you for your generosity!",
      });
      onTipAdded?.(data.tipAmount);
    },
    onError: (error: Error) => {
      if (error.message?.includes("409") || error.message?.includes("already")) {
        toast({
          title: "Tip Already Added",
          description: "You have already tipped for this ride.",
          variant: "destructive",
        });
        setTipAdded(true);
      } else {
        toast({
          title: "Failed to Add Tip",
          description: error.message || "Please try again.",
          variant: "destructive",
        });
      }
    },
  });

  const handleQuickTip = (amount: number) => {
    tipMutation.mutate(amount);
  };

  const handleCustomTip = () => {
    const amount = parseFloat(customAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid tip amount.",
        variant: "destructive",
      });
      return;
    }
    tipMutation.mutate(amount);
  };

  if (tipAdded) {
    return (
      <Card className={`border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 ${className}`} data-testid="tip-success-card">
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">
              Thank you! {finalTipAmount > 0 && `Tip of ${formatCurrency(finalTipAmount, currency)} added.`}
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className} data-testid="tip-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Heart className="h-4 w-4 text-pink-500" />
          Add a Tip for Your Driver
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2 flex-wrap">
          {quickTips.map((amount) => (
            <Button
              key={amount}
              variant="outline"
              size="sm"
              onClick={() => handleQuickTip(amount)}
              disabled={tipMutation.isPending}
              data-testid={`button-tip-${amount}`}
            >
              {tipMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                formatCurrency(amount, currency)
              )}
            </Button>
          ))}
        </div>
        
        <div className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="custom-tip" className="sr-only">Custom Amount</Label>
            <Input
              id="custom-tip"
              type="number"
              placeholder="Custom amount"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              disabled={tipMutation.isPending}
              min="1"
              step="1"
              data-testid="input-custom-tip"
            />
          </div>
          <Button
            onClick={handleCustomTip}
            disabled={tipMutation.isPending || !customAmount}
            data-testid="button-send-tip"
          >
            {tipMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Send"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
