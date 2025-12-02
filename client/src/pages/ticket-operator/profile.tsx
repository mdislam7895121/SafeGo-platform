import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  User,
  CreditCard,
  Calendar,
  Star,
  CheckCircle,
  Clock,
  AlertCircle,
  Ticket,
  Car,
} from "lucide-react";

interface ProfileData {
  operator: {
    id: string;
    operatorName: string;
    operatorType: string;
    description?: string;
    logo?: string;
    officeAddress: string;
    officePhone: string;
    officeEmail?: string;
    ownerName: string;
    nidNumber: string;
    verificationStatus: string;
    isActive: boolean;
    averageRating: number;
    totalRatings: number;
    totalBookings: number;
    ticketListingCount: number;
    ticketBookingCount: number;
    rentalVehicleCount: number;
    rentalBookingCount: number;
  };
}

const verificationStatusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "অপেক্ষমান", color: "bg-orange-500", icon: Clock },
  under_review: { label: "পর্যালোচনা চলছে", color: "bg-blue-500", icon: Clock },
  approved: { label: "অনুমোদিত", color: "bg-green-500", icon: CheckCircle },
  rejected: { label: "প্রত্যাখ্যাত", color: "bg-red-500", icon: AlertCircle },
  suspended: { label: "স্থগিত", color: "bg-red-500", icon: AlertCircle },
};

const operatorTypeLabels: Record<string, string> = {
  ticket: "টিকিট অপারেটর",
  rental: "রেন্টাল অপারেটর",
  both: "টিকিট ও রেন্টাল অপারেটর",
};

export default function TicketOperatorProfile() {
  const { data, isLoading } = useQuery<ProfileData>({
    queryKey: ["/api/ticket-operator/profile"],
  });

  const profile = data?.operator;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-48" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (!profile) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-medium mb-2">প্রোফাইল পাওয়া যায়নি</h3>
        </CardContent>
      </Card>
    );
  }

  const statusConfig = verificationStatusConfig[profile.verificationStatus] || verificationStatusConfig.pending;
  const StatusIcon = statusConfig.icon;

  return (
    <div>
      <div className="space-y-6 pb-20 md:pb-0">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={profile.logo} alt={profile.operatorName} />
                <AvatarFallback className="text-2xl">
                  {profile.operatorName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h1 className="text-xl font-bold" data-testid="text-operator-name">
                      {profile.operatorName}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                      {operatorTypeLabels[profile.operatorType] || profile.operatorType}
                    </p>
                  </div>
                  <Badge className={`${statusConfig.color} text-white`}>
                    <StatusIcon className="h-3 w-3 mr-1" />
                    {statusConfig.label}
                  </Badge>
                </div>

                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                    <span className="font-medium" data-testid="text-rating">
                      {(profile.averageRating || 0).toFixed(1)}
                    </span>
                    <span className="text-muted-foreground">
                      ({profile.totalRatings || 0} রেটিং)
                    </span>
                  </div>
                  <span className="text-muted-foreground">
                    মোট {profile.totalBookings || 0} বুকিং
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Ticket className="h-5 w-5" />
                টিকিট সামারি
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">মোট রুট</span>
                <span className="font-bold" data-testid="text-ticket-count">
                  {profile.ticketListingCount || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">মোট বুকিং</span>
                <span className="font-bold">
                  {profile.ticketBookingCount || 0}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Car className="h-5 w-5" />
                রেন্টাল সামারি
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">মোট গাড়ি</span>
                <span className="font-bold" data-testid="text-vehicle-count">
                  {profile.rentalVehicleCount || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">মোট বুকিং</span>
                <span className="font-bold">
                  {profile.rentalBookingCount || 0}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              অফিস তথ্য
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">ঠিকানা</p>
                <p className="font-medium" data-testid="text-address">
                  {profile.officeAddress}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">ফোন</p>
                <p className="font-medium" data-testid="text-phone">
                  {profile.officePhone}
                </p>
              </div>
            </div>
            {profile.officeEmail && (
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">ইমেইল</p>
                  <p className="font-medium">{profile.officeEmail}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-5 w-5" />
              মালিকের তথ্য
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">নাম</span>
              <span className="font-medium" data-testid="text-owner-name">
                {profile.ownerName}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">এনআইডি</span>
              <span className="font-medium">
                {profile.nidNumber?.slice(0, 4)}****{profile.nidNumber?.slice(-4)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
