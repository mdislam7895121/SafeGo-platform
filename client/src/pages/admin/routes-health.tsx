import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle, XCircle, Loader2, RefreshCw, Activity, Link as LinkIcon } from "lucide-react";
import { Link } from "wouter";
import { STATIC_ADMIN_ROUTES } from "@/lib/adminRoutes";

interface RouteStatus {
  path: string;
  status: "pending" | "checking" | "ok" | "error";
  error?: string;
}

export default function AdminRoutesHealth() {
  const [routes, setRoutes] = useState<RouteStatus[]>(
    STATIC_ADMIN_ROUTES.map(path => ({ path, status: "pending" }))
  );
  const [isChecking, setIsChecking] = useState(false);

  const checkRoute = async (path: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      const response = await fetch(path, { method: "HEAD" });
      return { ok: response.ok || response.status === 401 };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  };

  const checkAllRoutes = async () => {
    setIsChecking(true);
    
    for (let i = 0; i < routes.length; i++) {
      const path = routes[i].path;
      
      setRoutes(prev => prev.map((r, idx) => 
        idx === i ? { ...r, status: "checking" } : r
      ));
      
      const result = await checkRoute(path);
      
      setRoutes(prev => prev.map((r, idx) => 
        idx === i ? { 
          ...r, 
          status: result.ok ? "ok" : "error",
          error: result.error 
        } : r
      ));
    }
    
    setIsChecking(false);
  };

  const okCount = routes.filter(r => r.status === "ok").length;
  const errorCount = routes.filter(r => r.status === "error").length;
  const pendingCount = routes.filter(r => r.status === "pending" || r.status === "checking").length;

  const getStatusIcon = (status: RouteStatus["status"]) => {
    switch (status) {
      case "ok":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "checking":
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <div className="h-4 w-4 rounded-full border-2 border-gray-300" />;
    }
  };

  const getStatusBadge = (status: RouteStatus["status"]) => {
    switch (status) {
      case "ok":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">OK</Badge>;
      case "error":
        return <Badge variant="destructive">Error</Badge>;
      case "checking":
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">Checking...</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6" />
            Admin Routes Health
          </h1>
          <p className="text-muted-foreground mt-1">
            Verify all admin routes are accessible and properly configured
          </p>
        </div>
        <Button 
          onClick={checkAllRoutes} 
          disabled={isChecking}
          className="gap-2"
        >
          {isChecking ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Check All Routes
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Routes</p>
                <p className="text-2xl font-bold">{routes.length}</p>
              </div>
              <LinkIcon className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Accessible</p>
                <p className="text-2xl font-bold text-green-600">{okCount}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Errors</p>
                <p className="text-2xl font-bold text-red-600">{errorCount}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Route Status</CardTitle>
          <CardDescription>
            Click "Check All Routes" to verify each route is accessible. 
            Routes returning 401 (unauthorized) are considered valid (auth required).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            <div className="space-y-2">
              {routes.map((route) => (
                <div 
                  key={route.path}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(route.status)}
                    <Link href={route.path}>
                      <span className="font-mono text-sm hover:underline cursor-pointer">
                        {route.path}
                      </span>
                    </Link>
                  </div>
                  <div className="flex items-center gap-2">
                    {route.error && (
                      <span className="text-xs text-red-500">{route.error}</span>
                    )}
                    {getStatusBadge(route.status)}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
