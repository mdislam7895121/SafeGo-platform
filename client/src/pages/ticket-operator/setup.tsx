import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Clock, FileCheck, AlertCircle, CheckCircle } from "lucide-react";
import { Link } from "wouter";

export default function TicketOperatorSetup() {
  const { data: profileData, isLoading } = useQuery<{ operator: any }>({
    queryKey: ["/api/ticket-operator/profile"],
  });

  const operator = profileData?.operator;
  const status = operator?.verificationStatus;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" data-testid="loader" />
      </div>
    );
  }

  const statusConfig = {
    pending: {
      icon: Clock,
      iconColor: "text-orange-600",
      bgColor: "bg-orange-50 dark:bg-orange-950",
      title: "আবেদন জমা হয়েছে",
      description: "আপনার আবেদন সফলভাবে জমা হয়েছে। আমরা শীঘ্রই আপনার আবেদন পর্যালোচনা করব।",
    },
    under_review: {
      icon: FileCheck,
      iconColor: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950",
      title: "পর্যালোচনা চলছে",
      description: "আপনার আবেদন এখন পর্যালোচনা করা হচ্ছে। সাধারণত ২৪-৪৮ ঘণ্টার মধ্যে সম্পন্ন হয়।",
    },
    approved: {
      icon: CheckCircle,
      iconColor: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-950",
      title: "অনুমোদিত!",
      description: "আপনার অপারেটর অ্যাকাউন্ট অনুমোদিত হয়েছে। এখনই আপনার ড্যাশবোর্ডে যান।",
    },
    rejected: {
      icon: AlertCircle,
      iconColor: "text-red-600",
      bgColor: "bg-red-50 dark:bg-red-950",
      title: "প্রত্যাখ্যাত",
      description: operator?.rejectionReason || "আপনার আবেদন প্রত্যাখ্যান করা হয়েছে।",
    },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
  const Icon = config.icon;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center space-y-6">
          <div className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center ${config.bgColor}`}>
            <Icon className={`h-10 w-10 ${config.iconColor}`} />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold" data-testid="text-status-title">
              {config.title}
            </h1>
            <p className="text-muted-foreground" data-testid="text-status-description">
              {config.description}
            </p>
          </div>

          {operator && (
            <div className="bg-muted/50 rounded-lg p-4 text-left space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">অপারেটর নাম:</span>
                <span className="font-medium" data-testid="text-operator-name">
                  {operator.operatorName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">ধরণ:</span>
                <span className="font-medium" data-testid="text-operator-type">
                  {operator.operatorType === "ticket" ? "টিকিট" : 
                   operator.operatorType === "rental" ? "রেন্টাল" : "টিকিট ও রেন্টাল"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">স্ট্যাটাস:</span>
                <span className={`font-medium ${config.iconColor}`} data-testid="text-status">
                  {status === "pending" ? "অপেক্ষমান" :
                   status === "under_review" ? "পর্যালোচনা" :
                   status === "approved" ? "অনুমোদিত" : "প্রত্যাখ্যাত"}
                </span>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {status === "approved" && (
              <Link href="/ticket-operator/dashboard">
                <Button className="w-full h-12 text-base" data-testid="button-go-dashboard">
                  ড্যাশবোর্ডে যান
                </Button>
              </Link>
            )}

            {status === "rejected" && (
              <Link href="/ticket-operator/onboarding">
                <Button className="w-full h-12 text-base" data-testid="button-resubmit">
                  পুনরায় আবেদন করুন
                </Button>
              </Link>
            )}

            <Link href="/">
              <Button variant="outline" className="w-full h-12 text-base" data-testid="button-home">
                হোমে ফিরে যান
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
