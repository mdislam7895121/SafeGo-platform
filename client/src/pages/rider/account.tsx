import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Shield,
  ChevronRight,
  Camera,
  Star,
  CreditCard,
  Bell,
  Lock,
  FileText,
  HelpCircle,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface ProfileData {
  id: string;
  email: string;
  phone?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  profilePhotoUrl?: string;
  address?: string;
  kycStatus?: string;
  rating?: number;
  totalTrips?: number;
  memberSince?: string;
}

const accountSections = [
  {
    title: "Personal Info",
    items: [
      { label: "Edit Profile", icon: User, href: "/rider/account/profile" },
      { label: "Addresses", icon: MapPin, href: "/rider/account/addresses" },
      { label: "Emergency Contacts", icon: Phone, href: "/rider/account/emergency" },
    ],
  },
  {
    title: "Payments",
    items: [
      { label: "Payment Methods", icon: CreditCard, href: "/rider/wallet/methods" },
      { label: "Billing History", icon: FileText, href: "/rider/wallet/history" },
    ],
  },
  {
    title: "Preferences",
    items: [
      { label: "Notifications", icon: Bell, href: "/rider/settings/notifications" },
      { label: "Privacy", icon: Lock, href: "/rider/settings/privacy" },
    ],
  },
  {
    title: "Safety & Security",
    items: [
      { label: "Verify Identity", icon: Shield, href: "/rider/account/verify" },
      { label: "Trusted Contacts", icon: User, href: "/rider/account/trusted" },
    ],
  },
];

export default function RiderAccount() {
  const { user } = useAuth();

  const { data: profileData, isLoading } = useQuery<ProfileData>({
    queryKey: ["/api/customer/profile"],
  });

  const profile: ProfileData = profileData || {} as ProfileData;
  const fullName = profile.fullName || 
    (profile.firstName ? `${profile.firstName} ${profile.lastName || ''}`.trim() : null) ||
    user?.email?.split('@')[0] || 'Rider';
  const initials = fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-20 w-20 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-account-title">
          Account
        </h1>
        <p className="text-muted-foreground">
          Manage your profile and settings
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
            <div className="relative">
              <Avatar className="h-20 w-20">
                <AvatarImage src={profile.profilePhotoUrl} alt={fullName} />
                <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <Button
                size="icon"
                variant="secondary"
                className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full"
                data-testid="button-change-photo"
              >
                <Camera className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 text-center sm:text-left">
              <h2 className="text-xl font-semibold" data-testid="text-profile-name">
                {fullName}
              </h2>
              <div className="flex flex-col sm:flex-row items-center gap-2 mt-1 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Mail className="h-4 w-4" />
                  <span>{profile.email || user?.email}</span>
                </div>
                {profile.phone && (
                  <div className="flex items-center gap-1">
                    <Phone className="h-4 w-4" />
                    <span>{profile.phone}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-3">
                {profile.rating && (
                  <Badge variant="secondary" className="gap-1">
                    <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                    {profile.rating.toFixed(1)} rating
                  </Badge>
                )}
                {profile.totalTrips !== undefined && (
                  <Badge variant="outline">
                    {profile.totalTrips} trips
                  </Badge>
                )}
                {profile.kycStatus && (
                  <Badge 
                    variant={profile.kycStatus === 'verified' ? 'default' : 'secondary'}
                    className={profile.kycStatus === 'verified' ? 'bg-green-500' : ''}
                  >
                    <Shield className="h-3 w-3 mr-1" />
                    {profile.kycStatus}
                  </Badge>
                )}
              </div>
            </div>

            <Link href="/rider/account/profile">
              <Button variant="outline" data-testid="button-edit-profile">
                Edit Profile
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {accountSections.map((section) => (
          <Card key={section.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{section.title}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {section.items.map((item) => (
                  <Link key={item.href} href={item.href}>
                    <button
                      className="w-full flex items-center justify-between p-4 hover-elevate text-left"
                      data-testid={`link-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon className="h-5 w-5 text-muted-foreground" />
                        <span className="font-medium">{item.label}</span>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </button>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-4">
          <Link href="/rider/help">
            <Button variant="ghost" className="w-full justify-start" data-testid="link-help-support">
              <HelpCircle className="h-5 w-5 mr-3" />
              Help & Support
            </Button>
          </Link>
        </CardContent>
      </Card>

      {profile.memberSince && (
        <p className="text-center text-sm text-muted-foreground">
          Member since {new Date(profile.memberSince).toLocaleDateString('en-US', { 
            month: 'long', 
            year: 'numeric' 
          })}
        </p>
      )}
    </div>
  );
}
