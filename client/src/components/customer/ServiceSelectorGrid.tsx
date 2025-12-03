import { Car, UtensilsCrossed, Package, Bus, CarFront, Store, type LucideIcon } from "lucide-react";

export type ServiceType = "ride" | "eats" | "parcel" | "tickets" | "rental" | "shop";

interface ServiceItem {
  key: ServiceType;
  label: string;
  description: string;
  icon: LucideIcon;
  isExternal?: boolean;
  route?: string;
}

const serviceItems: ServiceItem[] = [
  { key: "ride", label: "Ride", description: "Trips with drivers", icon: Car },
  { key: "eats", label: "Eats", description: "Food delivery", icon: UtensilsCrossed },
  { key: "parcel", label: "Parcel", description: "Send packages", icon: Package },
  { key: "tickets", label: "Tickets", description: "Bus / launch tickets", icon: Bus, isExternal: true, route: "/customer/bd-tickets" },
  { key: "rental", label: "Rental", description: "Car & micro rentals", icon: CarFront, isExternal: true, route: "/customer/bd-rentals" },
  { key: "shop", label: "Shop", description: "Local stores & grocery", icon: Store, isExternal: true, route: "/customer/bd-shops" },
];

interface ServiceSelectorGridProps {
  activeService: ServiceType;
  onChange: (service: ServiceType) => void;
  onNavigate?: (route: string) => void;
  isBDCustomer?: boolean;
}

export function ServiceSelectorGrid({ 
  activeService, 
  onChange, 
  onNavigate,
  isBDCustomer = false 
}: ServiceSelectorGridProps) {
  const filteredServices = isBDCustomer 
    ? serviceItems 
    : serviceItems.filter(s => !s.isExternal);

  const handleServiceClick = (service: ServiceItem) => {
    if (service.isExternal && service.route && onNavigate) {
      onNavigate(service.route);
    } else {
      onChange(service.key);
    }
  };

  return (
    <div className="w-full" data-testid="service-selector-grid">
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {filteredServices.map((service) => {
          const isActive = activeService === service.key;
          const Icon = service.icon;
          
          return (
            <button
              key={service.key}
              onClick={() => handleServiceClick(service)}
              className="group relative flex flex-col items-center p-4 rounded-2xl transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              style={{
                background: isActive 
                  ? "linear-gradient(135deg, hsl(var(--primary) / 0.08), hsl(var(--primary) / 0.04))"
                  : "hsl(var(--card))",
              }}
              data-testid={`service-card-${service.key}`}
            >
              <div
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                style={{
                  background: "linear-gradient(135deg, hsl(var(--primary) / 0.15), hsl(var(--primary) / 0.05))",
                }}
              />
              
              <div
                className="absolute inset-0 rounded-2xl transition-all duration-300 pointer-events-none"
                style={{
                  padding: "1px",
                  background: isActive
                    ? "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.4))"
                    : "linear-gradient(135deg, hsl(var(--border)), hsl(var(--border) / 0.5))",
                  WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                  WebkitMaskComposite: "xor",
                  maskComposite: "exclude",
                  boxShadow: isActive 
                    ? "0 0 20px hsl(var(--primary) / 0.3), 0 0 40px hsl(var(--primary) / 0.1)"
                    : "none",
                }}
              />

              <div 
                className={`relative z-10 flex items-center justify-center w-12 h-12 rounded-xl mb-2 transition-all duration-300 ${
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-lg" 
                    : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                }`}
                style={{
                  boxShadow: isActive ? "0 4px 20px hsl(var(--primary) / 0.4)" : "none",
                }}
              >
                <Icon className="h-6 w-6" />
              </div>

              <span 
                className={`relative z-10 text-sm font-bold transition-colors duration-300 ${
                  isActive ? "text-primary" : "text-foreground group-hover:text-primary"
                }`}
              >
                {service.label}
              </span>
              
              <span 
                className="relative z-10 text-[10px] text-muted-foreground text-center mt-0.5 leading-tight hidden sm:block"
              >
                {service.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
