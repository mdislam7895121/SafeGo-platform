import { memo, useState, useEffect } from "react";
import { Link } from "wouter";
import { 
  Car, UtensilsCrossed, Package, Store, Ticket, Globe,
  ChevronDown, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HealthIndicator } from "@/components/ui/HealthIndicator";

type Region = "BD" | "US";

interface GlobalFooterProps {
  selectedRegion?: Region;
  onRegionChange?: (region: Region) => void;
  showRegionSwitcher?: boolean;
}

const REGION_DISPLAY: Record<Region, { name: string; flag: string }> = {
  US: { name: "United States", flag: "US" },
  BD: { name: "Bangladesh", flag: "BD" },
};

const SERVICES_BY_REGION: Record<Region, Array<{ title: string; link: string; icon: typeof Car }>> = {
  US: [
    { title: "Ride", link: "/ride", icon: Car },
    { title: "Food", link: "/food", icon: UtensilsCrossed },
    { title: "Parcel", link: "/parcel", icon: Package },
  ],
  BD: [
    { title: "Ride", link: "/ride", icon: Car },
    { title: "Food", link: "/food", icon: UtensilsCrossed },
    { title: "Parcel", link: "/parcel", icon: Package },
    { title: "Shops", link: "/shops", icon: Store },
    { title: "Tickets", link: "/tickets", icon: Ticket },
  ],
};

const PARTNERS_BY_REGION: Record<Region, Array<{ title: string; link: string }>> = {
  US: [
    { title: "Drive with us", link: "/driver/signup" },
    { title: "Deliver with us", link: "/driver/signup" },
    { title: "Restaurant partners", link: "/restaurant/signup" },
  ],
  BD: [
    { title: "Drive with us", link: "/driver/signup" },
    { title: "Deliver with us", link: "/driver/signup" },
    { title: "Restaurant partners", link: "/restaurant/signup" },
    { title: "Shop partners", link: "/partner/shop" },
    { title: "Ticket partners", link: "/partner/ticket" },
  ],
};

const SUPPORT_LINKS = [
  { title: "FAQ", link: "/#faq" },
  { title: "Safety", link: "/safety" },
  { title: "Contact", link: "/contact" },
  { title: "Help Center", link: "/help-center" },
  { title: "Report Issue", link: "/support" },
  { title: "Accessibility", link: "/accessibility" },
  { title: "Community Guidelines", link: "/community-guidelines" },
];

const LEGAL_LINKS = [
  { title: "Terms of Service", link: "/terms" },
  { title: "Privacy Policy", link: "/privacy" },
  { title: "Cookie Policy", link: "/cookies" },
  { title: "Safety Policy", link: "/safety-policy" },
  { title: "Data Deletion", link: "/data-deletion" },
  { title: "Partner Terms", link: "/partner-terms" },
];

const COMPANY_LINKS = [
  { title: "About us", link: "/about" },
  { title: "Careers", link: "/careers" },
  { title: "Press", link: "/press" },
  { title: "Blog", link: "/blog" },
];

function RegionSwitcher({ 
  selectedRegion, 
  onRegionChange 
}: { 
  selectedRegion: Region; 
  onRegionChange: (region: Region) => void;
}) {
  return (
    <div className="flex items-center gap-2" data-testid="footer-region-switcher">
      <Globe className="h-4 w-4 text-gray-400" />
      <span className="text-sm text-gray-400">Select Region:</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-white hover:bg-gray-800 gap-1 px-2"
            data-testid="button-region-dropdown"
          >
            {REGION_DISPLAY[selectedRegion].name}
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[160px]">
          {(Object.keys(REGION_DISPLAY) as Region[]).map((region) => (
            <DropdownMenuItem
              key={region}
              onClick={() => onRegionChange(region)}
              className="cursor-pointer"
              data-testid={`menu-region-${region.toLowerCase()}`}
            >
              <span className="mr-2">{REGION_DISPLAY[region].flag === "US" ? "USA" : "BD"}</span>
              {REGION_DISPLAY[region].name}
              {selectedRegion === region && (
                <ChevronRight className="ml-auto h-4 w-4 text-primary" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function FooterLink({ href, children, external = false }: { href: string; children: React.ReactNode; external?: boolean }) {
  const isInternal = href.startsWith('/') || href.startsWith('#');
  
  if (isInternal && !external) {
    return (
      <Link href={href} className="hover:text-white transition-colors">
        {children}
      </Link>
    );
  }
  
  return (
    <a 
      href={href} 
      className="hover:text-white transition-colors"
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
    >
      {children}
    </a>
  );
}

function FooterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-semibold text-white mb-4 text-sm uppercase tracking-wide">{title}</h3>
      <ul className="space-y-2.5 text-sm">
        {children}
      </ul>
    </div>
  );
}

const GlobalFooter = memo(function GlobalFooter({ 
  selectedRegion: externalRegion, 
  onRegionChange: externalOnRegionChange,
  showRegionSwitcher = true 
}: GlobalFooterProps) {
  const [internalRegion, setInternalRegion] = useState<Region>("BD");
  
  useEffect(() => {
    const stored = localStorage.getItem("safego-region");
    if (stored && ["BD", "US"].includes(stored)) {
      setInternalRegion(stored as Region);
    }
  }, []);

  const selectedRegion = externalRegion ?? internalRegion;
  
  const handleRegionChange = (region: Region) => {
    if (externalOnRegionChange) {
      externalOnRegionChange(region);
    } else {
      setInternalRegion(region);
      localStorage.setItem("safego-region", region);
    }
  };

  const services = SERVICES_BY_REGION[selectedRegion];
  const partners = PARTNERS_BY_REGION[selectedRegion];

  return (
    <footer className="bg-gray-900 text-gray-400 pt-12 pb-6" data-testid="global-footer">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-8 lg:gap-6 mb-10">
          <FooterSection title="Company">
            {COMPANY_LINKS.map((item) => (
              <li key={item.title}>
                <FooterLink href={item.link}>{item.title}</FooterLink>
              </li>
            ))}
          </FooterSection>

          <FooterSection title="Services">
            {services.map((item) => (
              <li key={item.title}>
                <FooterLink href={item.link}>{item.title}</FooterLink>
              </li>
            ))}
          </FooterSection>

          <FooterSection title="Partners">
            {partners.map((item) => (
              <li key={item.title}>
                <FooterLink href={item.link}>{item.title}</FooterLink>
              </li>
            ))}
          </FooterSection>

          <FooterSection title="Support">
            {SUPPORT_LINKS.slice(0, 4).map((item) => (
              <li key={item.title}>
                <FooterLink href={item.link}>{item.title}</FooterLink>
              </li>
            ))}
          </FooterSection>

          <FooterSection title="More Support">
            {SUPPORT_LINKS.slice(4).map((item) => (
              <li key={item.title}>
                <FooterLink href={item.link}>{item.title}</FooterLink>
              </li>
            ))}
          </FooterSection>

          <FooterSection title="Legal">
            {LEGAL_LINKS.map((item) => (
              <li key={item.title}>
                <FooterLink href={item.link}>{item.title}</FooterLink>
              </li>
            ))}
          </FooterSection>
        </div>
        
        <div className="border-t border-gray-800 pt-6">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm">
                <span className="text-white font-bold">S</span>
              </div>
              <span className="font-semibold text-white">SafeGo</span>
            </div>

            {showRegionSwitcher && (
              <RegionSwitcher 
                selectedRegion={selectedRegion} 
                onRegionChange={handleRegionChange} 
              />
            )}

            <p className="text-gray-500 text-sm order-last lg:order-none">
              &copy; {new Date().getFullYear()} SafeGo Global. All rights reserved.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
              <FooterLink href="/terms">Terms</FooterLink>
              <FooterLink href="/privacy">Privacy</FooterLink>
              <FooterLink href="/cookies">Cookies</FooterLink>
            </div>
          </div>
          
          <div className="mt-6 pt-4 border-t border-gray-800/50">
            <div className="flex items-center justify-between mb-3">
              <HealthIndicator />
            </div>
            <div className="bg-amber-900/20 border border-amber-800/30 rounded-lg p-3">
              <p className="text-center text-xs text-amber-200/80">
                <strong className="text-amber-300">Testing Mode:</strong> SafeGo is currently in development preview. 
                Payment processing, driver matching, and delivery services are simulated. 
                Full production launch will include verified KYC, real-time payments, safety compliance, 
                and regulatory approvals for each operating region.
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
});

export default GlobalFooter;
