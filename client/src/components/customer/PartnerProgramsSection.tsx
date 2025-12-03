import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Car, Truck, UtensilsCrossed, Store, Ticket, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";

type PartnerKind = "driver_ride" | "driver_delivery" | "restaurant" | "shop_partner" | "ticket_operator";

interface PartnerItem {
  kind: PartnerKind;
  title: string;
  description: string;
  icon: typeof Car;
}

const partnerItems: PartnerItem[] = [
  {
    kind: "driver_ride",
    title: "রাইড শেয়ার ড্রাইভার",
    description: "যাত্রী নিয়ে শহরের ভেতরে যাতায়াত সেবা দিন।",
    icon: Car,
  },
  {
    kind: "driver_delivery",
    title: "ডেলিভারি ড্রাইভার",
    description: "খাবার ও পার্সেল ডেলিভারি করে আয় করুন।",
    icon: Truck,
  },
  {
    kind: "restaurant",
    title: "রেস্টুরেন্ট পার্টনার",
    description: "SafeGo দিয়ে আপনার খাবার অনলাইনে বিক্রি করুন।",
    icon: UtensilsCrossed,
  },
  {
    kind: "shop_partner",
    title: "দোকান পার্টনার",
    description: "মুদিখানা, ইলেকট্রনিক্স বা অন্যান্য দোকান অনলাইনে তুলুন।",
    icon: Store,
  },
  {
    kind: "ticket_operator",
    title: "টিকিট ও রেন্টাল অপারেটর",
    description: "বাস, লঞ্চ ও গাড়ি ভাড়া ও কল সেন্টার পরিচালনা করুন।",
    icon: Ticket,
  },
];

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

const getStatusLabel = (status: PartnerStatus): string => {
  switch (status) {
    case "not_started":
      return "শুরু করুন";
    case "draft":
      return "খসড়া";
    case "kyc_pending":
      return "KYC পেন্ডিং";
    case "setup_incomplete":
      return "সেটআপ অসম্পূর্ণ";
    case "ready_for_review":
      return "রিভিউ পেন্ডিং";
    case "live":
      return "সক্রিয়";
    case "rejected":
      return "বাতিল";
    default:
      return "";
  }
};

const getButtonLabel = (status: PartnerStatus): string => {
  switch (status) {
    case "not_started":
      return "শুরু করুন";
    case "live":
      return "ড্যাশবোর্ড দেখুন";
    default:
      return "চালিয়ে যান";
  }
};

export function PartnerProgramsSection() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [loadingKind, setLoadingKind] = useState<PartnerKind | null>(null);

  const { data: partnerSummary, isLoading } = useQuery<PartnerSummary>({
    queryKey: ["/api/bd/partner/summary"],
  });

  const startMutation = useMutation({
    mutationFn: async (partnerKind: PartnerKind) => {
      const response = await apiRequest("POST", "/api/bd/partner/start", { partnerKind });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.nextUrl) {
        setLocation(data.nextUrl);
      }
    },
    onError: (error: any) => {
      const status = error?.status || 500;
      let message = "সিস্টেমে সমস্যা হচ্ছে, আবার চেষ্টা করুন।";
      
      if (status === 401 || status === 403) {
        message = "লগইন করুন বা এই সেবা আপনার অঞ্চলের জন্য নয়।";
      } else if (status === 400 || status === 422) {
        message = error?.message || "অনুরোধে সমস্যা হয়েছে।";
      }
      
      toast({
        title: "ত্রুটি",
        description: message,
        variant: "destructive",
      });
      setLoadingKind(null);
    },
  });

  const handlePartnerClick = (kind: PartnerKind) => {
    setLoadingKind(kind);
    startMutation.mutate(kind);
  };

  if (isLoading) {
    return (
      <div className="mt-6 flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mt-6" data-testid="partner-programs-section">
      <h3 className="text-lg font-bold text-foreground">SafeGo Partner Programs</h3>
      <p className="text-sm text-muted-foreground mt-1">
        আপনার SafeGo একাউন্ট থেকে আয় করতে চাইলে নিচের যেকোনো অপশন নির্বাচন করুন।
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        {partnerItems.map((item) => {
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
              {/* Left glow */}
              <div 
                className="absolute left-0 top-0 h-full w-[2px] rounded-l-xl"
                style={{
                  background: "linear-gradient(to bottom, rgba(58, 139, 255, 0.4), rgba(58, 139, 255, 0.13))",
                  filter: "blur(2px)",
                }}
              />
              
              {/* Right glow */}
              <div 
                className="absolute right-0 top-0 h-full w-[2px] rounded-r-xl"
                style={{
                  background: "linear-gradient(to bottom, rgba(58, 139, 255, 0.4), rgba(58, 139, 255, 0.13))",
                  filter: "blur(2px)",
                }}
              />

              {/* Status Badge */}
              {status !== "not_started" && (
                <span 
                  className={`absolute top-3 right-3 px-2 py-[2px] text-[12px] font-semibold rounded-full ${getStatusBadgeClass(status)}`}
                  data-testid={`partner-status-${item.kind}`}
                >
                  {getStatusLabel(status)}
                </span>
              )}

              {/* Icon */}
              <div className="mb-3">
                <Icon className="h-10 w-10 text-[#007BFF]" />
              </div>

              {/* Title */}
              <h4 className="text-[17px] font-bold text-gray-900 dark:text-foreground">
                {item.title}
              </h4>

              {/* Description */}
              <p className="text-[14px] text-gray-500 dark:text-muted-foreground mt-1">
                {item.description}
              </p>

              {/* Action Button */}
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
