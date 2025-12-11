import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { 
  ArrowLeft, Shield, Users, Key, Lock, Unlock, 
  ChevronDown, ChevronRight, Search, Filter,
  Globe, Building2, MapPin, AlertTriangle, CheckCircle,
  Eye, Edit, Trash2, UserCog, Settings, History, Loader2
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
  scope: 'global' | 'country' | 'regional';
  permissions: string[];
  permissionCount: number;
  canManage: string[];
}

interface PermissionCategory {
  name: string;
  permissions: string[];
}

interface GovernanceStats {
  totalRoles: number;
  totalPermissions: number;
  supportedCountries: { code: string; userCount: number }[];
  adminsByRole: { role: string; count: number }[];
  adminsByCountry: { country: string; count: number }[];
}

interface GovernanceData {
  roles: RoleDefinition[];
  allPermissions: string[];
  permissionCategories: PermissionCategory[];
  stats: GovernanceStats;
}

const roleColors: Record<string, string> = {
  SUPER_ADMIN: "bg-red-500",
  ADMIN: "bg-orange-500",
  COUNTRY_ADMIN: "bg-yellow-500",
  CITY_ADMIN: "bg-green-500",
  COMPLIANCE_ADMIN: "bg-blue-500",
  SUPPORT_ADMIN: "bg-purple-500",
  FINANCE_ADMIN: "bg-emerald-500",
  RISK_ADMIN: "bg-pink-500",
  READONLY_ADMIN: "bg-gray-500",
};

function RoleHierarchyTree({ roles }: { roles: RoleDefinition[] }) {
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
    const managedRoles = roles.filter(r => role.canManage.includes(r.id));
    const hasChildren = managedRoles.length > 0;
    const roleColor = roleColors[role.id] || "bg-gray-500";

    return (
      <div key={role.id} style={{ marginLeft: depth * 24 }} className="mb-2">
        <Collapsible open={isExpanded} onOpenChange={() => hasChildren && toggleRole(role.id)}>
          <Card className="border-l-4" style={{ borderLeftColor: roleColor.replace('bg-', '').includes('-') ? `var(--${roleColor.replace('bg-', '')})` : undefined }}>
            <CollapsibleTrigger asChild>
              <CardHeader className="py-3 px-4 cursor-pointer hover-elevate">
                <div className="flex items-center gap-3">
                  {hasChildren ? (
                    isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                  ) : (
                    <div className="w-4" />
                  )}
                  <div className={`w-3 h-3 rounded-full ${roleColor}`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
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
                          {role.permissionCount}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{role.permissionCount} permissions</p>
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
                            <div className={`w-2 h-2 rounded-full ${roleColors[r.id] || 'bg-gray-500'}`} />
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

  const topLevelRoles = roles.filter(r => r.level === 1);

  return (
    <div className="space-y-2">
      {topLevelRoles.map(role => renderRole(role))}
    </div>
  );
}

function PermissionMatrix({ roles, categories }: { roles: RoleDefinition[]; categories: PermissionCategory[] }) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCategories = selectedCategory === "all" 
    ? categories 
    : categories.filter(c => c.name === selectedCategory);

  const allPermissionsInCategories = filteredCategories.flatMap(c => c.permissions);
  const filteredPermissions = searchQuery
    ? allPermissionsInCategories.filter(p => p.toLowerCase().includes(searchQuery.toLowerCase()))
    : allPermissionsInCategories;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search permissions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-permissions"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full sm:w-[200px]" data-testid="select-category">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(cat => (
              <SelectItem key={cat.name} value={cat.name}>{cat.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <ScrollArea className="h-[500px]">
          <div className="min-w-[800px]">
            <table className="w-full">
              <thead className="sticky top-0 bg-card z-10">
                <tr className="border-b">
                  <th className="text-left p-3 font-medium">Permission</th>
                  {roles.slice(0, 6).map(role => (
                    <th key={role.id} className="p-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <div className={`w-3 h-3 rounded-full ${roleColors[role.id] || 'bg-gray-500'}`} />
                        <span className="text-xs font-medium">{role.displayName.split(' ')[0]}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredPermissions.slice(0, 50).map((permission, idx) => (
                  <tr key={permission} className={idx % 2 === 0 ? "bg-muted/30" : ""}>
                    <td className="p-3 text-sm">
                      {permission.replace(/_/g, ' ').toLowerCase()}
                    </td>
                    {roles.slice(0, 6).map(role => (
                      <td key={role.id} className="p-3 text-center">
                        {role.permissions.includes(permission) ? (
                          <CheckCircle className="h-4 w-4 text-green-500 mx-auto" />
                        ) : (
                          <div className="h-4 w-4 mx-auto rounded-full border border-muted-foreground/30" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredPermissions.length > 50 && (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Showing 50 of {filteredPermissions.length} permissions
              </div>
            )}
          </div>
        </ScrollArea>
      </Card>
    </div>
  );
}

function CountryScopeMap({ stats }: { stats: GovernanceStats }) {
  const countries = stats.supportedCountries || [];
  const adminsByCountry = stats.adminsByCountry || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Countries Active
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{countries.length}</div>
            <p className="text-sm text-muted-foreground">With registered users</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Total Admins
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {stats.adminsByRole?.reduce((sum, r) => sum + r.count, 0) || 0}
            </div>
            <p className="text-sm text-muted-foreground">Across all roles</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Country Admins
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{adminsByCountry.length}</div>
            <p className="text-sm text-muted-foreground">Country-scoped admins</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Geographic Distribution
          </CardTitle>
          <CardDescription>User and admin distribution by country</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            <div className="space-y-3">
              {countries.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No country data available yet
                </div>
              ) : (
                countries.map(country => {
                  const adminCount = adminsByCountry.find(a => a.country === country.code)?.count || 0;
                  return (
                    <div key={country.code} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-6 bg-muted rounded flex items-center justify-center text-xs font-medium">
                          {country.code || 'N/A'}
                        </div>
                        <div>
                          <div className="font-medium">{country.code || 'Unknown'}</div>
                          <div className="text-sm text-muted-foreground">{country.userCount} users</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {adminCount > 0 && (
                          <Badge variant="outline" className="gap-1">
                            <UserCog className="h-3 w-3" />
                            {adminCount} admins
                          </Badge>
                        )}
                        <Badge variant={country.userCount > 100 ? "default" : "secondary"}>
                          {country.userCount > 100 ? "Active" : "Growing"}
                        </Badge>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Admin Role Distribution
          </CardTitle>
          <CardDescription>Number of admins per role</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {stats.adminsByRole?.map(item => (
              <div key={item.role} className="p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-2 h-2 rounded-full ${roleColors[item.role] || 'bg-gray-500'}`} />
                  <span className="text-sm font-medium">
                    {item.role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </span>
                </div>
                <div className="text-2xl font-bold">{item.count}</div>
              </div>
            ))}
            {(!stats.adminsByRole || stats.adminsByRole.length === 0) && (
              <div className="col-span-full text-center text-muted-foreground py-4">
                No admin data available yet
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminAccessGovernance() {
  const { data, isLoading, error } = useQuery<GovernanceData>({
    queryKey: ['/api/admin/access-governance'],
  });

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading access governance data...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Error Loading Data
            </CardTitle>
            <CardDescription>
              Failed to load access governance data. Please try again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.location.reload()} data-testid="button-retry">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/admin/dashboard">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="h-6 w-6" />
              Access Governance
            </h1>
            <p className="text-muted-foreground">
              Role hierarchy, permissions, and scope management
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="gap-1">
            <Users className="h-3 w-3" />
            {data.stats.totalRoles} Roles
          </Badge>
          <Badge variant="outline" className="gap-1">
            <Key className="h-3 w-3" />
            {data.stats.totalPermissions} Permissions
          </Badge>
          <Badge variant="outline" className="gap-1">
            <Globe className="h-3 w-3" />
            {data.stats.supportedCountries?.length || 0} Countries
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="hierarchy" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="hierarchy" className="gap-2" data-testid="tab-hierarchy">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Role Hierarchy</span>
            <span className="sm:hidden">Roles</span>
          </TabsTrigger>
          <TabsTrigger value="permissions" className="gap-2" data-testid="tab-permissions">
            <Key className="h-4 w-4" />
            <span className="hidden sm:inline">Permission Matrix</span>
            <span className="sm:hidden">Perms</span>
          </TabsTrigger>
          <TabsTrigger value="scope" className="gap-2" data-testid="tab-scope">
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">Country Scope</span>
            <span className="sm:hidden">Scope</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="hierarchy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Role Hierarchy Tree
              </CardTitle>
              <CardDescription>
                Visual representation of admin roles and their management capabilities. 
                Data is fetched live from the RBAC system.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RoleHierarchyTree roles={data.roles} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Permission Matrix
              </CardTitle>
              <CardDescription>
                Shows which permissions are granted to each role. 
                Data reflects the current RBAC configuration.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PermissionMatrix roles={data.roles} categories={data.permissionCategories} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scope" className="space-y-4">
          <CountryScopeMap stats={data.stats} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
