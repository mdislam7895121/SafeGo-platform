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

  const getButtonLabel = (status: PartnerStatus): string => {
    switch (status) {
      case "not_started":
        return texts.statusLabels.not_started;
      case "live":
        return countryCode === "BD" ? "ড্যাশবোর্ড দেখুন" : "View Dashboard";
      default:
        return countryCode === "BD" ? "চালিয়ে যান" : "Continue";
    }
  };

  const { data: partnerSummary, isLoading, error: summaryError } = useQuery<PartnerSummary>({
    queryKey: ["/api/bd/partner/summary"],
    enabled: !!user,
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

  const handlePartnerClick = (kind: PartnerKind) => {
    if (needsLogin) {
      setLocation("/login?returnTo=/customer");
      return;
    }
    setLoadingKind(kind);
    startMutation.mutate(kind);
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        {partnerCards.map((item) => {
          const Icon = item.icon;
          const summary = partnerSummary?.[item.kind];
          const status: PartnerStatus = summary?.status || "not_started";
          const isItemLoading = loadingKind === item.kind && startMutation.isPending;

          return (
            <div
              key={item.kind}
              className="relative bg-white dark:bg-card rounded-xl p-5 shadow-sm transition-all duration-200 hover:scale-[1.02] hover:shadow-md"
              data-testid={`partner-card-${item.kind}`}
            >
              <div 
                className="absolute left-0 top-0 h-full w-[2px] rounded-l-xl"
                style={{
                  background: "linear-gradient(to bottom, rgba(58, 139, 255, 0.4), rgba(58, 139, 255, 0.13))",
                  filter: "blur(2px)",
                }}
              />
              
              <div 
                className="absolute right-0 top-0 h-full w-[2px] rounded-r-xl"
                style={{
                  background: "linear-gradient(to bottom, rgba(58, 139, 255, 0.4), rgba(58, 139, 255, 0.13))",
                  filter: "blur(2px)",
                }}
              />

              {status !== "not_started" && (
                <span 
                  className={`absolute top-3 right-3 px-2 py-[2px] text-[12px] font-semibold rounded-full ${getStatusBadgeClass(status)}`}
                  data-testid={`partner-status-${item.kind}`}
                >
                  {getStatusLabel(status)}
                </span>
              )}

              <div className="mb-3">
                <Icon className="h-10 w-10 text-[#007BFF]" />
              </div>

              <h4 className="text-[17px] font-bold text-gray-900 dark:text-foreground">
                {item.title}
              </h4>

              <p className="text-[14px] text-gray-500 dark:text-muted-foreground mt-1">
                {item.description}
              </p>

              <button
                onClick={() => handlePartnerClick(item.kind)}
                disabled={isItemLoading}
                className="w-full mt-4 py-2 rounded-lg font-bold text-white transition-colors disabled:opacity-50"
                style={{ backgroundColor: "#007BFF" }}
                onMouseEnter={(e) => !isItemLoading && (e.currentTarget.style.backgroundColor = "#0069d9")}
                onMouseLeave={(e) => !isItemLoading && (e.currentTarget.style.backgroundColor = "#007BFF")}
                data-testid={`partner-button-${item.kind}`}
              >
                {isItemLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                ) : needsLogin ? (
                  texts.loginButtonText
                ) : (
                  getButtonLabel(status)
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
