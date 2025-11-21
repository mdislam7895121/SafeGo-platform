import { Link } from "wouter";
import { ArrowLeft, User, Mail, Phone, Calendar, Lock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function ManageAccount() {
  const { data: driverData } = useQuery({
    queryKey: ["/api/driver/home"],
  });

  const profile = (driverData as any)?.profile;
  const driverName = profile?.firstName && profile?.lastName
    ? `${profile.firstName} ${profile.lastName}`
    : profile?.fullName || "Driver";
  const initials = driverName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="bg-background">
      <div className="bg-primary text-primary-foreground p-6 ">
        <div className="flex items-center gap-4">
          <Link href="/driver/account">
            <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10" data-testid="button-back">
              <ArrowLeft className="h-6 w-6" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Manage Account</h1>
        </div>
      </div>

      <div className="p-6 max-w-2xl mx-auto space-y-6">
        {/* Profile Photo */}
        <Card>
          <CardHeader>
            <CardTitle>Profile Photo</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-6">
            <Avatar className="h-24 w-24">
              <AvatarImage src={profile?.profilePhotoUrl} alt={driverName} />
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-2">JPG or PNG. Max size 5MB.</p>
              <Button variant="outline" size="sm" data-testid="button-change-photo">
                Change Photo
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Personal Information */}
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <div className="flex gap-2">
                <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-muted rounded-lg">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span data-testid="text-full-name">{driverName}</span>
                </div>
                <Button variant="outline" size="sm" data-testid="button-edit-name">
                  Edit
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="flex gap-2">
                <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-muted rounded-lg">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span data-testid="text-email">{profile?.email}</span>
                </div>
                <Button variant="outline" size="sm" data-testid="button-edit-email">
                  Edit
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Member Since</Label>
              <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span data-testid="text-member-since">
                  {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : "N/A"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader>
            <CardTitle>Security</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full justify-start" data-testid="button-change-password">
              <Lock className="h-4 w-4 mr-2" />
              Change Password
            </Button>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
            <CardDescription>These actions cannot be undone</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" className="w-full" data-testid="button-delete-account">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Account
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
