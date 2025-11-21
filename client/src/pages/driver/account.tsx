import { Link } from "wouter";
import {
  Car,
  FileText,
  Receipt,
  User,
  MapPin,
  Shield,
  Globe,
  Bell,
  Moon,
  Navigation,
  UserX,
  Settings,
  Info,
  ChevronRight,
  Lock,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

// Grouped account menu sections
const accountSections = [
  {
    title: "Personal Information",
    items: [
      { icon: User, title: "Personal Info", href: "/driver/account/manage", description: "Profile and account details" },
      { icon: MapPin, title: "Address", href: "/driver/account/address", description: "Update your address" },
    ],
  },
  {
    title: "Security & Privacy",
    items: [
      { icon: Lock, title: "Security", href: "/driver/account/manage", description: "Password and authentication" },
      { icon: Shield, title: "Privacy & Data", href: "/driver/account/privacy", description: "Privacy settings and data controls" },
      { icon: UserX, title: "Blocked Users", href: "/driver/account/blocked-users", description: "Manage blocked riders" },
    ],
  },
  {
    title: "Driver Requirements",
    items: [
      { icon: FileText, title: "Documents", href: "/driver/kyc-documents", description: "Upload and manage KYC documents" },
      { icon: Car, title: "Vehicles", href: "/driver/account/vehicles", description: "Manage your vehicles and documents" },
      { icon: Receipt, title: "Tax Info", href: "/driver/account/tax-info", description: "Tax documents and settings" },
    ],
  },
  {
    title: "App Preferences",
    items: [
      { icon: Navigation, title: "Map Settings", href: "/driver/account/map-settings", description: "Navigation app and map style" },
      { icon: Moon, title: "Appearance", href: "/driver/account/dark-mode", description: "Dark mode and theme settings" },
      { icon: Globe, title: "Language", href: "/driver/account/language", description: "Change app language" },
      { icon: Bell, title: "Notifications", href: "/driver/account/notifications", description: "Manage notification preferences" },
      { icon: Settings, title: "App Permissions", href: "/driver/account/permissions", description: "Manage app permissions" },
    ],
  },
  {
    title: "About",
    items: [
      { icon: Info, title: "About SafeGo", href: "/driver/account/about", description: "App version and legal info" },
    ],
  },
];

export default function DriverAccount() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-6 sticky top-0 z-10">
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Account Settings</h1>
        <p className="text-sm opacity-90 mt-1">Manage your driver account and preferences</p>
      </div>

      <div className="p-6 max-w-2xl mx-auto space-y-8">
        {accountSections.map((section, sectionIndex) => (
          <div key={sectionIndex}>
            <h2 className="text-lg font-semibold mb-3 px-1">{section.title}</h2>
            <div className="space-y-2">
              {section.items.map((item, index) => (
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
        ))}
      </div>
    </div>
  );
}
