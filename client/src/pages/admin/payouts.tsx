import { useLocation } from "wouter";
import {
  Calendar,
  HandCoins,
  FileText,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/PageHeader";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";

export default function AdminPayoutsHub() {
  const [, navigate] = useLocation();

  // Fetch admin capabilities for RBAC
  const { data: capabilitiesData } = useQuery<{ capabilities: string[] }>({
    queryKey: ["/api/admin/capabilities"],
  });
  const capabilities = capabilitiesData?.capabilities || [];

  const sections = [
    {
      name: "Payout Requests",
      description: "Review and approve pending payout requests from drivers and restaurants",
      icon: CheckCircle2,
      color: "text-violet-600",
      bgColor: "bg-violet-50 dark:bg-violet-950",
      href: "/admin/payouts/requests",
      permission: "MANAGE_PAYOUTS",
    },
    {
      name: "Scheduled Payouts",
      description: "Configure automatic batch payout schedules for drivers and restaurants",
      icon: Calendar,
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950",
      href: "/admin/payouts/schedule",
      permission: "CREATE_MANUAL_PAYOUT",
    },
    {
      name: "Manual Payouts",
      description: "Process one-time manual payouts for exceptional cases",
      icon: HandCoins,
      color: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-950",
      href: "/admin/payouts/manual",
      permission: "CREATE_MANUAL_PAYOUT",
    },
    {
      name: "Reconciliation Reports",
      description: "Generate and view payout reconciliation reports to detect mismatches",
      icon: FileText,
      color: "text-orange-600",
      bgColor: "bg-orange-50 dark:bg-orange-950",
      href: "/admin/payouts/reports",
      permission: "VIEW_PAYOUTS",
    },
  ];

  // Filter sections based on permissions
  const filteredSections = sections.filter((section) => {
    if (!section.permission) return true;
    return capabilities.includes(section.permission);
  });

  return (
    <div className="min-h-screen bg-background pb-6">
      <PageHeader
        title="Payout Management"
        description="Comprehensive payout scheduling, processing, and reconciliation"
        icon={HandCoins}
        backButton={{ label: "Back to Dashboard", href: "/admin" }}
      />

      <div className="p-4 sm:p-6">
        {/* Info Card */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="bg-primary/10 p-3 rounded-lg">
                <HandCoins className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold mb-2">Payout System Overview</h2>
                <p className="text-sm text-muted-foreground">
                  SafeGo's payout system handles all financial transactions between the platform and 
                  service providers. Use scheduled payouts for regular batch processing, manual payouts 
                  for exceptional cases, and reconciliation reports to ensure accuracy and compliance.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Management Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredSections.map((section) => {
            const Icon = section.icon;
            return (
              <Card
                key={section.name}
                className="hover-elevate cursor-pointer transition-all"
                onClick={() => navigate(section.href)}
                data-testid={`card-${section.name.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-4">
                    <div className={`${section.bgColor} p-3 rounded-lg`}>
                      <Icon className={`h-6 w-6 ${section.color}`} />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-lg mb-1">{section.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {section.description}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <Button variant="outline" className="w-full" data-testid={`button-${section.name.toLowerCase().replace(/\s+/g, "-")}`}>
                    Manage {section.name}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* No Access Message */}
        {filteredSections.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <Clock className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-2">No Access</h3>
              <p className="text-muted-foreground">
                You don't have permission to access any payout management features.
                <br />
                Please contact your administrator to request access.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
