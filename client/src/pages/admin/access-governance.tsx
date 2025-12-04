import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { 
  ArrowLeft, Shield, Users, Key, Lock, Unlock, 
  ChevronDown, ChevronRight, Search, Filter,
  Globe, Building2, MapPin, AlertTriangle, CheckCircle,
  Eye, Edit, Trash2, UserCog, Settings, History
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface RoleDefinition {
  id: string;
  name: string;
  displayName: string;
  description: string;
  level: number;
  color: string;
  permissions: string[];
  scope: 'global' | 'country' | 'regional';
  canManage: string[];
}

const ROLE_HIERARCHY: RoleDefinition[] = [
  {
    id: "SUPER_ADMIN",
    name: "SUPER_ADMIN",
    displayName: "Super Admin",
    description: "Full system access with all permissions",
    level: 1,
    color: "bg-red-500",
    permissions: ["ALL_PERMISSIONS"],
    scope: "global",
    canManage: ["ADMIN", "COUNTRY_ADMIN", "REGIONAL_MANAGER", "OPERATIONS_MANAGER", "SUPPORT_MANAGER", "SUPPORT_AGENT", "FINANCE_MANAGER"]
  },
  {
    id: "ADMIN",
    name: "ADMIN",
    displayName: "Admin",
    description: "Platform administration with extensive permissions",
    level: 2,
    color: "bg-orange-500",
    permissions: ["VIEW_DASHBOARD", "MANAGE_USERS", "VIEW_AUDIT_LOG", "MANAGE_DRIVERS", "MANAGE_CUSTOMERS", "MANAGE_RESTAURANTS", "MANAGE_KYC", "VIEW_ANALYTICS", "MANAGE_SUPPORT"],
    scope: "global",
    canManage: ["COUNTRY_ADMIN", "REGIONAL_MANAGER", "OPERATIONS_MANAGER", "SUPPORT_MANAGER", "SUPPORT_AGENT"]
  },
  {
    id: "COUNTRY_ADMIN",
    name: "COUNTRY_ADMIN",
    displayName: "Country Admin",
    description: "Country-level administration and oversight",
    level: 3,
    color: "bg-yellow-500",
    permissions: ["VIEW_DASHBOARD", "MANAGE_DRIVERS", "MANAGE_CUSTOMERS", "MANAGE_RESTAURANTS", "MANAGE_KYC", "VIEW_COUNTRY_ANALYTICS", "MANAGE_REGIONAL_TEAMS"],
    scope: "country",
    canManage: ["REGIONAL_MANAGER", "OPERATIONS_MANAGER", "SUPPORT_MANAGER", "SUPPORT_AGENT"]
  },
  {
    id: "REGIONAL_MANAGER",
    name: "REGIONAL_MANAGER",
    displayName: "Regional Manager",
    description: "Regional operations and team management",
    level: 4,
    color: "bg-green-500",
    permissions: ["VIEW_DASHBOARD", "MANAGE_DRIVERS", "VIEW_REGIONAL_ANALYTICS", "MANAGE_LOCAL_SUPPORT"],
    scope: "regional",
    canManage: ["OPERATIONS_MANAGER", "SUPPORT_AGENT"]
  },
  {
    id: "OPERATIONS_MANAGER",
    name: "OPERATIONS_MANAGER",
    displayName: "Operations Manager",
    description: "Day-to-day operations oversight",
    level: 5,
    color: "bg-blue-500",
    permissions: ["VIEW_DASHBOARD", "VIEW_DRIVERS", "VIEW_ORDERS", "MANAGE_DISPATCH"],
    scope: "regional",
    canManage: []
  },
  {
    id: "SUPPORT_MANAGER",
    name: "SUPPORT_MANAGER",
    displayName: "Support Manager",
    description: "Customer support team management",
    level: 5,
    color: "bg-purple-500",
    permissions: ["VIEW_DASHBOARD", "MANAGE_SUPPORT_CONVERSATIONS", "ASSIGN_TICKETS", "VIEW_SUPPORT_ANALYTICS"],
    scope: "country",
    canManage: ["SUPPORT_AGENT"]
  },
  {
    id: "SUPPORT_AGENT",
    name: "SUPPORT_AGENT",
    displayName: "Support Agent",
    description: "Frontline customer support",
    level: 6,
    color: "bg-indigo-500",
    permissions: ["VIEW_SUPPORT_CONVERSATIONS", "REPLY_TO_TICKETS", "VIEW_USER_INFO"],
    scope: "regional",
    canManage: []
  },
  {
    id: "FINANCE_MANAGER",
    name: "FINANCE_MANAGER",
    displayName: "Finance Manager",
    description: "Financial operations and reporting",
    level: 4,
    color: "bg-emerald-500",
    permissions: ["VIEW_DASHBOARD", "VIEW_PAYOUTS", "PROCESS_PAYOUTS", "VIEW_FINANCIAL_REPORTS", "MANAGE_COMMISSIONS"],
    scope: "global",
    canManage: []
  }
];

const PERMISSION_CATEGORIES = [
  {
    name: "Dashboard & Analytics",
    permissions: ["VIEW_DASHBOARD", "VIEW_ANALYTICS", "VIEW_COUNTRY_ANALYTICS", "VIEW_REGIONAL_ANALYTICS", "VIEW_SUPPORT_ANALYTICS", "VIEW_FINANCIAL_REPORTS", "EXPORT_ANALYTICS"]
  },
  {
    name: "User Management",
    permissions: ["VIEW_USERS", "MANAGE_USERS", "VIEW_DRIVERS", "MANAGE_DRIVERS", "MANAGE_CUSTOMERS", "MANAGE_RESTAURANTS"]
  },
  {
    name: "KYC & Compliance",
    permissions: ["VIEW_KYC", "MANAGE_KYC", "APPROVE_KYC", "REJECT_KYC", "VIEW_DOCUMENTS", "MANAGE_DOCUMENT_REVIEW"]
  },
  {
    name: "Support",
    permissions: ["VIEW_SUPPORT_CONVERSATIONS", "REPLY_TO_TICKETS", "MANAGE_SUPPORT_CONVERSATIONS", "ASSIGN_TICKETS", "VIEW_USER_INFO"]
  },
  {
    name: "Finance & Payouts",
    permissions: ["VIEW_PAYOUTS", "PROCESS_PAYOUTS", "MANAGE_COMMISSIONS", "VIEW_WALLET_SUMMARY", "PROCESS_WALLET_SETTLEMENT"]
  },
  {
    name: "Security & Audit",
    permissions: ["VIEW_AUDIT_LOG", "VIEW_SECURITY_SETTINGS", "MANAGE_ROLES", "CREATE_ADMIN", "EDIT_ADMIN", "VIEW_ADMIN_LIST"]
  },
  {
    name: "Operations",
    permissions: ["VIEW_ORDERS", "MANAGE_DISPATCH", "VIEW_LIVE_MAP", "VIEW_REALTIME_MONITORING"]
  }
];

function RoleHierarchyTree() {
  const [expandedRoles, setExpandedRoles] = useState<Set<string>>(new Set(["SUPER_ADMIN", "ADMIN"]));
  
  const toggleRole = (roleId: string) => {
    const newExpanded = new Set(expandedRoles);
    if (newExpanded.has(roleId)) {
      newExpanded.delete(roleId);
    } else {
      newExpanded.add(roleId);
    }
    setExpandedRoles(newExpanded);
  };

  const renderRole = (role: RoleDefinition, depth: number = 0) => {
    const isExpanded = expandedRoles.has(role.id);
    const managedRoles = ROLE_HIERARCHY.filter(r => role.canManage.includes(r.id));
    const hasChildren = managedRoles.length > 0;

    return (
      <div key={role.id} style={{ marginLeft: depth * 24 }} className="mb-2">
        <Collapsible open={isExpanded} onOpenChange={() => hasChildren && toggleRole(role.id)}>
          <Card className="border-l-4" style={{ borderLeftColor: role.color.replace('bg-', '').includes('-') ? `var(--${role.color.replace('bg-', '')})` : undefined }}>
            <CollapsibleTrigger asChild>
              <CardHeader className="py-3 px-4 cursor-pointer hover-elevate">
                <div className="flex items-center gap-3">
                  {hasChildren ? (
                    isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                  ) : (
                    <div className="w-4" />
                  )}
                  <div className={`w-3 h-3 rounded-full ${role.color}`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{role.displayName}</span>
                      <Badge variant="outline" className="text-xs">
                        Level {role.level}
                      </Badge>
                      <Badge variant="secondary" className="text-xs capitalize">
                        {role.scope}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{role.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Tooltip>
                      <TooltipTrigger>
                        <Badge variant="outline" className="gap-1">
                          <Key className="h-3 w-3" />
                          {role.permissions.length}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{role.permissions.length} permissions</p>
                      </TooltipContent>
                    </Tooltip>
                    {managedRoles.length > 0 && (
                      <Tooltip>
                        <TooltipTrigger>
                          <Badge variant="outline" className="gap-1">
                            <Users className="h-3 w-3" />
                            {managedRoles.length}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Can manage {managedRoles.length} roles</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 pb-3 px-4">
                <div className="pl-7 space-y-3">
                  <div>
                    <h4 className="text-sm font-medium mb-2">Permissions</h4>
                    <div className="flex flex-wrap gap-1">
                      {role.permissions.slice(0, 8).map(perm => (
                        <Badge key={perm} variant="secondary" className="text-xs">
                          {perm.replace(/_/g, ' ').toLowerCase()}
                        </Badge>
                      ))}
                      {role.permissions.length > 8 && (
                        <Badge variant="outline" className="text-xs">
                          +{role.permissions.length - 8} more
                        </Badge>
                      )}
                    </div>
                  </div>
                  {managedRoles.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">Can Manage</h4>
                      <div className="flex flex-wrap gap-1">
                        {managedRoles.map(r => (
                          <Badge key={r.id} variant="outline" className="text-xs gap-1">
                            <div className={`w-2 h-2 rounded-full ${r.color}`} />
                            {r.displayName}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
        {isExpanded && managedRoles.map(childRole => renderRole(childRole, depth + 1))}
      </div>
    );
  };

  const topLevelRoles = ROLE_HIERARCHY.filter(r => r.level === 1);

  return (
    <div className="space-y-2">
      {topLevelRoles.map(role => renderRole(role))}
    </div>
  );
}

function PermissionMatrix() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const filteredCategories = selectedCategory === "all" 
    ? PERMISSION_CATEGORIES 
    : PERMISSION_CATEGORIES.filter(c => c.name === selectedCategory);

  const hasPermission = (roleId: string, permission: string): boolean => {
    const role = ROLE_HIERARCHY.find(r => r.id === roleId);
    if (!role) return false;
    if (role.permissions.includes("ALL_PERMISSIONS")) return true;
    return role.permissions.includes(permission);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search permissions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-permissions"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full sm:w-[200px]" data-testid="select-permission-category">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {PERMISSION_CATEGORIES.map(cat => (
              <SelectItem key={cat.name} value={cat.name}>{cat.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ScrollArea className="h-[500px]">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-background z-10">
              <tr className="border-b">
                <th className="text-left p-2 font-medium min-w-[200px]">Permission</th>
                {ROLE_HIERARCHY.map(role => (
                  <th key={role.id} className="p-2 text-center">
                    <Tooltip>
                      <TooltipTrigger>
                        <div className={`w-6 h-6 rounded-full ${role.color} mx-auto flex items-center justify-center text-white text-xs font-bold`}>
                          {role.displayName.charAt(0)}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{role.displayName}</p>
                      </TooltipContent>
                    </Tooltip>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredCategories.map(category => (
                <>
                  <tr key={category.name} className="bg-muted/30">
                    <td colSpan={ROLE_HIERARCHY.length + 1} className="p-2 font-semibold text-sm">
                      {category.name}
                    </td>
                  </tr>
                  {category.permissions
                    .filter(p => !searchQuery || p.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map(permission => (
                      <tr key={permission} className="border-b hover:bg-muted/20">
                        <td className="p-2 text-sm">
                          {permission.replace(/_/g, ' ').toLowerCase()}
                        </td>
                        {ROLE_HIERARCHY.map(role => (
                          <td key={`${role.id}-${permission}`} className="p-2 text-center">
                            {hasPermission(role.id, permission) ? (
                              <CheckCircle className="h-4 w-4 text-green-500 mx-auto" />
                            ) : (
                              <div className="h-4 w-4 mx-auto text-muted-foreground">-</div>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </ScrollArea>
    </div>
  );
}

function ScopeMap() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-blue-500" />
              <CardTitle className="text-lg">Global Scope</CardTitle>
            </div>
            <CardDescription>Access across all countries and regions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {ROLE_HIERARCHY.filter(r => r.scope === "global").map(role => (
                <div key={role.id} className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${role.color}`} />
                  <span className="text-sm">{role.displayName}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-yellow-500" />
              <CardTitle className="text-lg">Country Scope</CardTitle>
            </div>
            <CardDescription>Access limited to assigned country</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {ROLE_HIERARCHY.filter(r => r.scope === "country").map(role => (
                <div key={role.id} className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${role.color}`} />
                  <span className="text-sm">{role.displayName}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-green-500" />
              <CardTitle className="text-lg">Regional Scope</CardTitle>
            </div>
            <CardDescription>Access limited to assigned region/city</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {ROLE_HIERARCHY.filter(r => r.scope === "regional").map(role => (
                <div key={role.id} className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${role.color}`} />
                  <span className="text-sm">{role.displayName}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Scope Inheritance</CardTitle>
          <CardDescription>How data access flows through scope levels</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-4 py-4">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center mb-2 mx-auto">
                <Globe className="h-8 w-8 text-blue-500" />
              </div>
              <span className="text-sm font-medium">Global</span>
              <p className="text-xs text-muted-foreground">All data</p>
            </div>
            <ChevronRight className="h-6 w-6 text-muted-foreground" />
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center mb-2 mx-auto">
                <Building2 className="h-8 w-8 text-yellow-500" />
              </div>
              <span className="text-sm font-medium">Country</span>
              <p className="text-xs text-muted-foreground">Country data</p>
            </div>
            <ChevronRight className="h-6 w-6 text-muted-foreground" />
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-2 mx-auto">
                <MapPin className="h-8 w-8 text-green-500" />
              </div>
              <span className="text-sm font-medium">Regional</span>
              <p className="text-xs text-muted-foreground">Region data</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AccessGovernancePage() {
  const { data: adminStats } = useQuery({
    queryKey: ["/api/admin/staff/stats"],
    enabled: false
  });

  return (
    <div className="min-h-screen bg-background pb-6">
      <div className="bg-primary text-primary-foreground px-4 sm:px-6 md:px-8 py-5 sm:py-6 rounded-b-2xl sm:rounded-b-3xl shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <Link href="/admin">
            <Button
              variant="ghost"
              size="icon"
              className="text-primary-foreground hover:bg-primary-foreground/10 h-10 w-10"
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <Shield className="h-6 w-6" />
              Access Governance
            </h1>
            <p className="text-xs sm:text-sm opacity-90">Role hierarchy, permissions, and access control</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="bg-primary-foreground/10 border-primary-foreground/20">
            <CardContent className="p-3 flex items-center gap-2">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Users className="h-4 w-4 text-blue-300" />
              </div>
              <div>
                <p className="text-2xl font-bold text-primary-foreground">{ROLE_HIERARCHY.length}</p>
                <p className="text-xs text-primary-foreground/80">Roles</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-primary-foreground/10 border-primary-foreground/20">
            <CardContent className="p-3 flex items-center gap-2">
              <div className="p-2 rounded-lg bg-green-500/20">
                <Key className="h-4 w-4 text-green-300" />
              </div>
              <div>
                <p className="text-2xl font-bold text-primary-foreground">{PERMISSION_CATEGORIES.reduce((acc, cat) => acc + cat.permissions.length, 0)}</p>
                <p className="text-xs text-primary-foreground/80">Permissions</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-primary-foreground/10 border-primary-foreground/20">
            <CardContent className="p-3 flex items-center gap-2">
              <div className="p-2 rounded-lg bg-yellow-500/20">
                <Globe className="h-4 w-4 text-yellow-300" />
              </div>
              <div>
                <p className="text-2xl font-bold text-primary-foreground">3</p>
                <p className="text-xs text-primary-foreground/80">Scope Levels</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-primary-foreground/10 border-primary-foreground/20">
            <CardContent className="p-3 flex items-center gap-2">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <Lock className="h-4 w-4 text-purple-300" />
              </div>
              <div>
                <p className="text-2xl font-bold text-primary-foreground">6</p>
                <p className="text-xs text-primary-foreground/80">Hierarchy Levels</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="px-4 sm:px-6 md:px-8 py-6">
        <Tabs defaultValue="hierarchy" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="hierarchy" data-testid="tab-hierarchy">
              <Users className="h-4 w-4 mr-2" />
              Role Hierarchy
            </TabsTrigger>
            <TabsTrigger value="matrix" data-testid="tab-matrix">
              <Key className="h-4 w-4 mr-2" />
              Permission Matrix
            </TabsTrigger>
            <TabsTrigger value="scope" data-testid="tab-scope">
              <Globe className="h-4 w-4 mr-2" />
              Scope Map
            </TabsTrigger>
          </TabsList>

          <TabsContent value="hierarchy">
            <Card>
              <CardHeader>
                <CardTitle>Role Hierarchy</CardTitle>
                <CardDescription>
                  Visual representation of admin roles and their management capabilities
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RoleHierarchyTree />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="matrix">
            <Card>
              <CardHeader>
                <CardTitle>Permission Matrix</CardTitle>
                <CardDescription>
                  Complete mapping of permissions across all roles
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PermissionMatrix />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="scope">
            <Card>
              <CardHeader>
                <CardTitle>Access Scope Map</CardTitle>
                <CardDescription>
                  Geographic and organizational access boundaries
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScopeMap />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
