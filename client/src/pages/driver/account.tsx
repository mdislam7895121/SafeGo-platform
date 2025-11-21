import { Link } from "wouter";
import {
  Car,
  Briefcase,
  FileText,
  CreditCard,
  Receipt,
  User,
  MapPin,
  Shield,
  Globe,
  Bell,
  Moon,
  Map,
  Navigation,
  UserX,
  Settings,
  Info,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const accountMenuItems = [
  { icon: Car, title: "Vehicles", href: "/driver/account/vehicles", description: "Manage your vehicles and documents" },
  { icon: Briefcase, title: "Work Hub", href: "/driver/account/work-hub", description: "Your trips and work preferences" },
  { icon: FileText, title: "Documents", href: "/driver/kyc-documents", description: "Upload and manage KYC documents" },
  { icon: CreditCard, title: "Payment", href: "/driver/account/payment", description: "Payment methods and banking" },
  { icon: Receipt, title: "Tax Info", href: "/driver/account/tax-info", description: "Tax documents and settings" },
  { icon: User, title: "Manage SafeGo Account", href: "/driver/account/manage", description: "Profile and account settings" },
  { icon: MapPin, title: "Edit Address", href: "/driver/account/address", description: "Update your address information" },
  { icon: Shield, title: "Privacy", href: "/driver/account/privacy", description: "Privacy settings and data controls" },
  { icon: Globe, title: "Language", href: "/driver/account/language", description: "Change app language" },
  { icon: Bell, title: "Notifications", href: "/driver/account/notifications", description: "Manage notification preferences" },
  { icon: Moon, title: "Dark Mode", href: "/driver/account/dark-mode", description: "Toggle dark mode theme" },
  { icon: Map, title: "Map Theme", href: "/driver/account/map-theme", description: "Choose your map style" },
  { icon: Navigation, title: "Navigation Preference", href: "/driver/account/navigation", description: "Set default navigation app" },
  { icon: UserX, title: "Blocked Users", href: "/driver/account/blocked-users", description: "Manage blocked riders" },
  { icon: Settings, title: "App Permissions", href: "/driver/account/permissions", description: "Manage app permissions" },
  { icon: Info, title: "About", href: "/driver/account/about", description: "App version and legal info" },
];

export default function DriverAccount() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-6 sticky top-0 z-10">
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Account</h1>
        <p className="text-sm opacity-90 mt-1">Manage your driver account settings</p>
      </div>

      <div className="p-6 max-w-2xl mx-auto space-y-2">
        {accountMenuItems.map((item, index) => (
          <Link key={index} href={item.href}>
            <a data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
              <Card className="hover-elevate active-elevate-2">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 text-primary flex-shrink-0">
                      <item.icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold">{item.title}</h3>
                      <p className="text-sm text-muted-foreground truncate">{item.description}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            </a>
          </Link>
        ))}
      </div>
    </div>
  );
}
