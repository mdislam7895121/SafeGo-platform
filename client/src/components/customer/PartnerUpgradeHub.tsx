import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { 
  Car, Bike, UtensilsCrossed, Store, Bus, 
  ArrowRight, Loader2, Sparkles, MapPin
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface PartnerOption {
  id: string;
  role: "ride_driver" | "delivery_driver" | "restaurant" | "shop_partner" | "ticket_operator";
  icon: typeof Car;
  title: string;
  subtitle: string;
  buttonText: string;
  route: string;
  bdOnly?: boolean;
}

const partnerOptions: PartnerOption[] = [
  {
    id: "ride-driver",
    role: "ride_driver",
    icon: Car,
    title: "Ride Driver",
    subtitle: "Earn by giving safe rides",
    buttonText: "Become a Ride Driver",
    route: "/partner/ride/start",
  },
  {
    id: "delivery-driver",
    role: "delivery_driver",
    icon: Bike,
    title: "Delivery Driver",
    subtitle: "Deliver food and parcels",
    buttonText: "Become a Delivery Driver",
    route: "/partner/delivery/start",
  },
  {
    id: "restaurant",
    role: "restaurant",
    icon: UtensilsCrossed,
    title: "Restaurant Partner",
    subtitle: "Join SafeGo Eats",
    buttonText: "Open Restaurant Dashboard",
    route: "/partner/restaurant/start",
  },
  {
    id: "shop-partner",
    role: "shop_partner",
    icon: Store,
    title: "Shop Partner",
    subtitle: "Sell products on SafeGo Shops",
    buttonText: "Become Shop Partner",
    route: "/partner/shop/start",
    bdOnly: true,
  },
  {
    id: "ticket-operator",
    role: "ticket_operator",
    icon: Bus,
    title: "Tickets & Rentals",
    subtitle: "Manage routes, schedules and rentals",
    buttonText: "Become Operator",
    route: "/partner/ticket/start",
    bdOnly: true,
  },
];

interface PartnerCardProps {
  option: PartnerOption;
  onStart: (option: PartnerOption) => void;
  isLoading: boolean;
  loadingRole: string | null;
}

function PartnerCard({ option, onStart, isLoading, loadingRole }: PartnerCardProps) {
  const Icon = option.icon;
  const isCurrentLoading = isLoading && loadingRole === option.role;
  
  return (
    <div
      className="partner-glow-card group relative bg-white dark:bg-gray-900 rounded-[16px] p-6 cursor-pointer transition-all duration-[220ms] ease-out hover:scale-[0.985] active:scale-[0.98]"
      onClick={() => !isLoading && onStart(option)}
      data-testid={`card-partner-${option.id}`}
    >
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500/10 to-purple-500/10 flex items-center justify-center">
          <Icon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
        </div>
        
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white" data-testid={`text-partner-title-${option.id}`}>
            {option.title}
          </h3>
          <p className="text-sm font-semibold text-gray-600 dark:text-gray-400" data-testid={`text-partner-subtitle-${option.id}`}>
            {option.subtitle}
          </p>
        </div>

        <Button 
          className="w-full font-bold gap-2"
          disabled={isLoading}
          data-testid={`button-partner-start-${option.id}`}
        >
          {isCurrentLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Starting...
            </>
          ) : (
            <>
              {option.buttonText}
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
      
      {option.bdOnly && (
        <div className="absolute top-3 right-3">
          <span 
            className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
            data-testid={`badge-bd-only-${option.id}`}
          >
            <MapPin className="h-3 w-3" />
            BD Only
          </span>
        </div>
      )}
    </div>
  );
}

export function PartnerUpgradeHub() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const countryCode = user?.countryCode || "US";
  const isBD = countryCode === "BD";
  
  const filteredOptions = partnerOptions.filter(option => {
    if (option.bdOnly && !isBD) {
      return false;
    }
    return true;
  });

  if (isAuthLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold">Become a Partner</h2>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" data-testid="loader-partner-hub" />
        </div>
      </div>
    );
  }

  interface PartnerInitResponse {
    success: boolean;
    partnerType: string;
    countryCode: string;
    nextStepUrl: string;
    requiredDocuments: string[];
    message: string;
  }

  const initPartnerMutation = useMutation({
    mutationFn: async (data: { partnerType: string; fallbackRoute: string }) => {
      const response: PartnerInitResponse = await apiRequest("/api/customer/partner/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnerType: data.partnerType }),
      });
      return { ...response, partnerType: data.partnerType, fallbackRoute: data.fallbackRoute };
    },
    onSuccess: (data) => {
      const option = partnerOptions.find(o => o.role === data.partnerType);
      toast({
        title: "Partner onboarding started",
        description: data.message || `You're now starting the ${option?.title || 'partner'} onboarding process.`,
      });
      setLocation(data.nextStepUrl || data.fallbackRoute);
    },
    onError: (error: Error) => {
      toast({
        title: "Could not start onboarding",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleStartPartner = (option: PartnerOption) => {
    initPartnerMutation.mutate({ partnerType: option.role, fallbackRoute: option.route });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-bold">Become a Partner</h2>
      </div>
      
      <p className="text-sm text-muted-foreground mb-6">
        {isBD 
          ? "Expand your opportunities with SafeGo. Join as a partner and start earning."
          : "Join the SafeGo network as a partner and unlock new income opportunities."
        }
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredOptions.map((option) => (
          <PartnerCard
            key={option.id}
            option={option}
            onStart={handleStartPartner}
            isLoading={initPartnerMutation.isPending}
            loadingRole={initPartnerMutation.variables?.partnerType || null}
          />
        ))}
      </div>

      <style>{`
        .partner-glow-card {
          border: 1px solid transparent;
          background-image: 
            linear-gradient(white, white),
            linear-gradient(135deg, #0066FF, #00C6FF, #8A2BE2);
          background-origin: border-box;
          background-clip: padding-box, border-box;
          box-shadow: 
            0px 0px 8px rgba(0, 102, 255, 0.25),
            0px 0px 14px rgba(0, 198, 255, 0.15);
        }
        
        .dark .partner-glow-card {
          background-image: 
            linear-gradient(rgb(17, 24, 39), rgb(17, 24, 39)),
            linear-gradient(135deg, #0066FF, #00C6FF, #8A2BE2);
        }
        
        .partner-glow-card:hover {
          border-width: 2px;
          box-shadow: 
            0px 0px 12px rgba(0, 102, 255, 0.35),
            0px 0px 20px rgba(0, 198, 255, 0.25);
        }
      `}</style>
    </div>
  );
}
