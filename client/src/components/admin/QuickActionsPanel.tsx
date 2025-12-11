import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  UserX,
  KeyRound,
  ShieldCheck,
  AlertTriangle,
  ChevronRight,
  Zap,
  Loader2,
  CheckCircle,
  X,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

interface QuickAction {
  id: string;
  label: string;
  description: string;
  icon: any;
  color: string;
  permission?: string;
}

const quickActions: QuickAction[] = [
  {
    id: "suspend-user",
    label: "Suspend User",
    description: "Temporarily disable a user account",
    icon: UserX,
    color: "text-red-500 bg-red-500/10",
    permission: "MANAGE_USER_STATUS",
  },
  {
    id: "reset-password",
    label: "Reset Password",
    description: "Send password reset email to user",
    icon: KeyRound,
    color: "text-amber-500 bg-amber-500/10",
    permission: "MANAGE_USER_STATUS",
  },
  {
    id: "verify-kyc",
    label: "Verify KYC",
    description: "Quick approve KYC documents",
    icon: ShieldCheck,
    color: "text-green-500 bg-green-500/10",
    permission: "MANAGE_KYC",
  },
  {
    id: "review-risk",
    label: "Review Risk Case",
    description: "Open risk assessment panel",
    icon: AlertTriangle,
    color: "text-orange-500 bg-orange-500/10",
    permission: "VIEW_IDENTITY_RISK_SCORES",
  },
];

export function QuickActionsPanel() {
  const [open, setOpen] = useState(false);
  const [activeAction, setActiveAction] = useState<QuickAction | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [userId, setUserId] = useState("");
  const [reason, setReason] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const suspendMutation = useMutation({
    mutationFn: async (data: { userId: string; reason: string }) => {
      return apiRequest(`/api/admin/users/${data.userId}/suspend`, {
        method: "POST",
        body: JSON.stringify({ reason: data.reason }),
      });
    },
    onSuccess: () => {
      toast({
        title: "User Suspended",
        description: "The user account has been temporarily disabled.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Action Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (data: { userId: string }) => {
      return apiRequest(`/api/admin/users/${data.userId}/reset-password`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      toast({
        title: "Password Reset Sent",
        description: "A password reset email has been sent to the user.",
      });
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Action Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const verifyKycMutation = useMutation({
    mutationFn: async (data: { userId: string; reason: string }) => {
      return apiRequest(`/api/admin/kyc/${data.userId}/approve`, {
        method: "POST",
        body: JSON.stringify({ notes: data.reason }),
      });
    },
    onSuccess: () => {
      toast({
        title: "KYC Verified",
        description: "The user's KYC has been approved.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/kyc"] });
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Action Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setUserId("");
    setReason("");
    setActiveAction(null);
  };

  const handleActionClick = (action: QuickAction) => {
    if (action.id === "review-risk") {
      setOpen(false);
      setLocation("/admin/fraud-detection");
      return;
    }
    setActiveAction(action);
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!userId.trim()) {
      toast({
        title: "User ID Required",
        description: "Please enter a valid user ID or email.",
        variant: "destructive",
      });
      return;
    }

    switch (activeAction?.id) {
      case "suspend-user":
        if (!reason.trim()) {
          toast({
            title: "Reason Required",
            description: "Please provide a reason for suspension.",
            variant: "destructive",
          });
          return;
        }
        suspendMutation.mutate({ userId, reason });
        break;
      case "reset-password":
        resetPasswordMutation.mutate({ userId });
        break;
      case "verify-kyc":
        verifyKycMutation.mutate({ userId, reason });
        break;
    }
  };

  const isPending = 
    suspendMutation.isPending || 
    resetPasswordMutation.isPending || 
    verifyKycMutation.isPending;

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            data-testid="button-quick-actions"
          >
            <Zap className="h-4 w-4" />
            <span className="hidden sm:inline">Quick Actions</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Quick Actions
            </SheetTitle>
            <SheetDescription>
              Common admin actions for fast operations
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-2">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  onClick={() => handleActionClick(action)}
                  className="flex w-full items-center gap-4 rounded-lg border p-4 text-left transition-all hover:bg-muted/50 hover:border-primary/20 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  data-testid={`quick-action-${action.id}`}
                >
                  <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", action.color)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{action.label}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {action.description}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </button>
              );
            })}
          </div>

          <div className="mt-6 rounded-lg bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">
              These actions are logged for security and compliance purposes. 
              All changes are auditable.
            </p>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {activeAction && (
                <>
                  <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", activeAction.color)}>
                    <activeAction.icon className="h-4 w-4" />
                  </div>
                  {activeAction.label}
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {activeAction?.description}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="userId">User ID or Email</Label>
              <Input
                id="userId"
                placeholder="Enter user ID or email address"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                data-testid="input-quick-action-user"
              />
            </div>

            {(activeAction?.id === "suspend-user" || activeAction?.id === "verify-kyc") && (
              <div className="space-y-2">
                <Label htmlFor="reason">
                  {activeAction.id === "suspend-user" ? "Suspension Reason" : "Approval Notes"}
                </Label>
                <Textarea
                  id="reason"
                  placeholder={activeAction.id === "suspend-user" 
                    ? "Explain why this user is being suspended..."
                    : "Optional notes for this KYC approval..."
                  }
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  data-testid="input-quick-action-reason"
                />
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                resetForm();
              }}
              disabled={isPending}
              data-testid="button-quick-action-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isPending}
              className={cn(
                activeAction?.id === "suspend-user" && "bg-red-600 hover:bg-red-700"
              )}
              data-testid="button-quick-action-confirm"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Confirm
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
