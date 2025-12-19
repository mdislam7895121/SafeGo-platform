import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { getPartnerTexts, getFilteredPartnerCards, PartnerKind } from "@/config/partnerCardTexts";

type PartnerStatus = "not_started" | "draft" | "kyc_pending" | "setup_incomplete" | "ready_for_review" | "live" | "rejected";

interface PartnerSummary {
  [key: string]: {
    status: PartnerStatus;
    label: string;
  };
}

const getStatusBadgeClass = (status: PartnerStatus): string => {
  switch (status) {
    case "not_started":
      return "bg-gray-200 text-gray-800";
    case "draft":
    case "kyc_pending":
      return "bg-yellow-200 text-gray-900";
    case "setup_incomplete":
    case "ready_for_review":
      return "bg-blue-200 text-gray-900";
    case "live":
      return "bg-green-200 text-gray-900";
    case "rejected":
      return "bg-red-200 text-gray-900";
    default:
      return "bg-gray-200 text-gray-800";
  }
};

export function PartnerProgramsSection() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [loadingKind, setLoadingKind] = useState<PartnerKind | null>(null);
  const { user, isLoading: authLoading } = useAuth();

  const countryCode = user?.countryCode || "US";
  const texts = getPartnerTexts(countryCode);
  const partnerCards = getFilteredPartnerCards(countryCode);

  const getStatusLabel = (status: PartnerStatus): string => {
    return texts.statusLabels[status] || "";
  };

  const getButtonLabel = (status: PartnerStatus, buttonText: string): string => {
    switch (status) {
      case "not_started":
        return buttonText;
      case "live":
        return countryCode === "BD" ? "ড্যাশবোর্ড দেখুন" : "View Dashboard";
      default:
        return countryCode === "BD" ? "চালিয়ে যান" : "Continue";
    }
  };

  const isBD = countryCode === "BD";
  
  // BD users use the BD-specific partner summary endpoint
  // US users navigate directly to partner start pages
  const { data: partnerSummary, isLoading, error: summaryError } = useQuery<PartnerSummary>({
    queryKey: ["/api/bd/partner/summary"],
    enabled: !!user && isBD,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 60000,
  });

  const isSessionExpired = summaryError && (summaryError as any)?.status === 403;
  const needsLogin = !user || isSessionExpired;

  const startMutation = useMutation({
    mutationFn: async (partnerKind: PartnerKind) => {
      const response = await apiRequest("/api/bd/partner/start", {
        method: "POST",
        body: JSON.stringify({ partnerKind }),
        headers: { "Content-Type": "application/json" },
      });
      return response;
    },
    onSuccess: (data) => {
      if (data.nextUrl) {
        setLocation(data.nextUrl);
      }
    },
    onError: (error: any) => {
      const status = error?.status || 500;
      let message = countryCode === "BD" 
        ? "সিস্টেমে সমস্যা হচ্ছে, আবার চেষ্টা করুন।"
        : "System error, please try again.";
      
      if (status === 401 || status === 403) {
        setLocation("/login?returnTo=/customer");
        return;
      } else if (status === 400 || status === 422) {
        message = error?.message || (countryCode === "BD" ? "অনুরোধে সমস্যা হয়েছে।" : "Request failed.");
      }
      
      toast({
        title: countryCode === "BD" ? "ত্রুটি" : "Error",
        description: message,
        variant: "destructive",
      });
      setLoadingKind(null);
    },
  });

  // Get the destination URL for each partner type based on country
  const getPartnerDestination = (kind: PartnerKind): string => {
    switch (kind) {
      case "driver_ride":
        return "/partner/ride/start";
      case "driver_delivery":
        return "/partner/delivery/start";
      case "driver_delivery_bike":
        return "/partner/delivery-driver/start";
      case "restaurant":
        return "/partner/restaurant/start";
      case "shop_partner":
        return "/shop-partner/onboarding";
      case "ticket_operator":
        return "/ticket-operator/onboarding";
      default:
        return "/customer";
    }
  };

  const handlePartnerClick = (kind: PartnerKind) => {
    if (needsLogin) {
      setLocation("/login?returnTo=/customer");
      return;
    }
    
    // For BD users, use the start mutation for BD-specific tracking
    // For US users, navigate directly to partner start pages
    if (isBD) {
      setLoadingKind(kind);
      startMutation.mutate(kind);
    } else {
      // US users go directly to partner start pages
      setLocation(getPartnerDestination(kind));
    }
  };

  if (authLoading) {
    return (
      <div className="mt-6 flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mt-6" data-testid="partner-programs-section">
      <h3 className="text-lg font-bold text-foreground">{texts.sectionTitle}</h3>
      <p className="text-sm text-muted-foreground mt-1">
        {texts.masterTagline}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-5">
        {partnerCards.map((item) => {
          const Icon = item.icon;
          const summary = partnerSummary?.[item.kind];
          const status: PartnerStatus = summary?.status || "not_started";
          const isItemLoading = loadingKind === item.kind && startMutation.isPending;

          return (
            <div
              key={item.kind}
              className="relative bg-white dark:bg-card rounded-xl border border-gray-100 dark:border-border p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
              data-testid={`partner-card-${item.kind}`}
            >
              {isBD && status !== "not_started" && (
                <span 
                  className={`absolute top-3 right-3 px-2 py-0.5 text-xs font-medium rounded-full ${getStatusBadgeClass(status)}`}
                  data-testid={`partner-status-${item.kind}`}
                >
                  {getStatusLabel(status)}
                </span>
              )}

              <div className="mb-3">
                <Icon className="h-8 w-8 text-blue-600 dark:text-blue-500" strokeWidth={1.5} />
              </div>

              <h4 className="text-base font-semibold text-gray-900 dark:text-foreground">
                {item.title}
              </h4>

              <p className="text-sm text-gray-500 dark:text-muted-foreground mt-1 leading-snug">
                {item.description}
              </p>

              <button
                onClick={() => handlePartnerClick(item.kind)}
                disabled={isItemLoading}
                className="w-full mt-4 py-2.5 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50"
                data-testid={`partner-button-${item.kind}`}
              >
                {isItemLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                ) : needsLogin ? (
                  texts.loginButtonText
                ) : (
                  getButtonLabel(status, item.buttonText)
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
