import { lazy, Suspense } from "react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Headphones, MessageCircle, Users, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

const SupportSafePilotPanel = lazy(() => import("@/components/safepilot/support/SupportSafePilotPanel"));

interface SupportStats {
  openTickets: number;
  assignedTickets: number;
  resolvedToday: number;
  escalatedConversations: number;
}

export default function SupportConsole() {
  const { data: stats, isLoading } = useQuery<SupportStats>({
    queryKey: ["/api/admin/safepilot/support/stats"],
    retry: 1,
  });

  return (
    <div className="container mx-auto py-6 space-y-8">
      <PageHeader
        title="Support Console"
        description="Support SafePilot AI Assistant - Manage customer issues, tickets, and conversations"
        icon={Headphones}
        iconColor="text-green-600"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Open Tickets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? "-" : (stats?.openTickets ?? 0)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              Assigned
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? "-" : (stats?.assignedTickets ?? 0)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Resolved Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? "-" : (stats?.resolvedToday ?? 0)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-red-500" />
              Escalated
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? "-" : (stats?.escalatedConversations ?? 0)}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="assistant" className="space-y-4">
        <TabsList>
          <TabsTrigger value="assistant" className="flex items-center gap-2">
            <Headphones className="h-4 w-4" />
            AI Assistant
          </TabsTrigger>
          <TabsTrigger value="conversations" className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            Conversations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="assistant" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Headphones className="h-5 w-5 text-green-600" />
                Support SafePilot
              </CardTitle>
              <CardDescription>
                Ask questions about customer issues, support tickets, refunds, and conversation summaries.
                This AI assistant is specifically designed for support staff.
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[500px]">
              <Suspense fallback={
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
                </div>
              }>
                <SupportSafePilotPanel />
              </Suspense>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conversations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-blue-600" />
                Recent Conversations
              </CardTitle>
              <CardDescription>
                View and manage customer support conversations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center text-muted-foreground py-8">
                Customer conversations are available in the Support Center.
                <a href="/admin/support-center" className="text-blue-600 hover:underline ml-1">
                  Go to Support Center
                </a>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
