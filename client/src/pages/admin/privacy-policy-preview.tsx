/**
 * Admin Privacy Policy Preview Page
 * 
 * Allows admins to preview the privacy policy as it appears to different user roles.
 */

import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Shield, Eye, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PrivacyPolicyContent } from "@/components/privacy/PrivacyPolicyContent";
import { usePrivacyPolicy } from "@/hooks/use-privacy-policy";

type RoleType = "customer" | "driver" | "restaurant" | "shop_partner" | "ticket_operator" | "admin";

export default function AdminPrivacyPolicyPreview() {
  const [selectedRole, setSelectedRole] = useState<RoleType>("customer");
  const { policy, consentStatus, mustAcceptNewPolicy, isLoading } = usePrivacyPolicy();

  const roles: Array<{ value: RoleType; label: string; description: string }> = [
    { value: "customer", label: "Customer", description: "Riders and food delivery customers" },
    { value: "driver", label: "Driver", description: "Ride-hailing and delivery drivers" },
    { value: "restaurant", label: "Restaurant Partner", description: "Restaurant owners and managers" },
    { value: "shop_partner", label: "Shop Partner", description: "E-commerce shop partners" },
    { value: "ticket_operator", label: "Ticket/Rental Partner", description: "Ticket sellers and rental operators" },
    { value: "admin", label: "Admin", description: "Platform administrators" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-primary text-primary-foreground p-4 sm:p-6">
        <div className="flex items-center gap-4 max-w-6xl mx-auto">
          <Link href="/admin/privacy-consent-settings">
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-primary-foreground hover:bg-primary-foreground/10" 
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
              <Eye className="h-5 w-5 sm:h-6 sm:w-6" />
              Preview Policy as User
            </h1>
            <p className="text-sm text-primary-foreground/70">
              See how the privacy policy appears to different user roles
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
        <Card data-testid="card-role-selector">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Select User Role
            </CardTitle>
            <CardDescription>
              Choose a role to preview the privacy policy as that user type would see it
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <Select 
                value={selectedRole} 
                onValueChange={(value: RoleType) => setSelectedRole(value)}
              >
                <SelectTrigger className="w-full sm:w-64" data-testid="select-role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.value} value={role.value} data-testid={`select-role-${role.value}`}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-sm text-muted-foreground">
                {roles.find(r => r.value === selectedRole)?.description}
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="modal" className="w-full">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="modal" data-testid="tab-modal-view">Modal View</TabsTrigger>
            <TabsTrigger value="page" data-testid="tab-page-view">Full Page View</TabsTrigger>
          </TabsList>

          <TabsContent value="modal" className="mt-4">
            <Card data-testid="card-modal-preview">
              <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
                <div>
                  <CardTitle>Modal Preview</CardTitle>
                  <CardDescription>
                    This is how the policy modal appears when users must accept a new policy
                  </CardDescription>
                </div>
                <Badge variant="outline" className="flex items-center gap-1">
                  <Shield className="h-3 w-3" />
                  Viewing as: {roles.find(r => r.value === selectedRole)?.label}
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg p-4 sm:p-6 bg-background shadow-lg max-w-2xl mx-auto">
                  <div className="flex items-center gap-2 mb-4">
                    <Shield className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold">Privacy Policy Update</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    We've updated our privacy policy. Please review and accept to continue using SafeGo.
                  </p>
                  <PrivacyPolicyContent
                    policy={policy}
                    consentStatus={consentStatus}
                    mustAcceptNewPolicy={true}
                    isLoading={isLoading}
                    isPreviewMode={true}
                    onAccept={() => {}}
                    onDecline={() => {}}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="page" className="mt-4">
            <Card data-testid="card-page-preview">
              <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
                <div>
                  <CardTitle>Full Page Preview</CardTitle>
                  <CardDescription>
                    This is how the policy page appears in user settings
                  </CardDescription>
                </div>
                <Badge variant="outline" className="flex items-center gap-1">
                  <Shield className="h-3 w-3" />
                  Viewing as: {roles.find(r => r.value === selectedRole)?.label}
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden bg-background shadow-lg">
                  <div className="bg-primary text-primary-foreground p-4">
                    <div className="flex items-center gap-4">
                      <div className="h-9 w-9 rounded-md bg-primary-foreground/10 flex items-center justify-center">
                        <ArrowLeft className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                          <Shield className="h-5 w-5" />
                          Privacy Policy
                        </h2>
                        <p className="text-sm text-primary-foreground/70">
                          Viewing as: {roles.find(r => r.value === selectedRole)?.label}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 sm:p-6">
                    <PrivacyPolicyContent
                      policy={policy}
                      consentStatus={consentStatus}
                      mustAcceptNewPolicy={false}
                      isLoading={isLoading}
                      isPreviewMode={true}
                      onAccept={() => {}}
                      onDecline={() => {}}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
