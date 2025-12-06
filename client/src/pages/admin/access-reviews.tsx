import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'wouter';
import { PageHeader } from '@/components/admin/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { 
  ClipboardCheck, 
  Calendar,
  Users,
  Shield,
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  RefreshCw, 
  Download, 
  Play,
  Ban,
  Loader2,
  ArrowRight,
  UserCog,
  FileText,
  Filter,
  Search,
  ChevronRight,
  CheckCheck,
  CircleDot,
  Plus,
  ArrowLeft,
  Eye,
  UserMinus,
  UserPlus,
  RotateCcw,
  Globe,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface ReviewCycle {
  id: string;
  name: string;
  description: string | null;
  period: string;
  countryScope: string | null;
  roleScope: string[];
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  requiresTwoPersonRule: boolean;
  notifyOnComplete: boolean;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  totalItems: number;
  reviewedItems: number;
  keptCount: number;
  revokedCount: number;
  changedRoleCount: number;
  createdAt: string;
  createdByAdminName: string | null;
  _count?: { reviewItems: number };
}

interface ReviewItem {
  id: string;
  reviewCycleId: string;
  adminId: string;
  adminEmail: string;
  adminName: string | null;
  currentRole: string;
  newRole: string | null;
  team: string | null;
  country: string | null;
  decision: 'PENDING' | 'KEEP' | 'REVOKE' | 'CHANGE_ROLE';
  justificationText: string | null;
  requiresSecondApproval: boolean;
  decidedByAdminId: string | null;
  decidedByAdminName: string | null;
  decidedAt: string | null;
  secondApprovalBy: string | null;
  secondApprovalByName: string | null;
  secondApprovalAt: string | null;
  secondApprovalDecision: string | null;
  isEnforced: boolean;
  enforcedAt: string | null;
  enforcementError: string | null;
  previousRoles: string[];
}

interface CycleStats {
  cycleId: string;
  totalItems: number;
  reviewedItems: number;
  pendingItems: number;
  keptCount: number;
  revokedCount: number;
  changedRoleCount: number;
  completionRate: number;
  byTeam: Record<string, number>;
  byDecision: Record<string, number>;
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'OPEN':
      return <Badge variant="outline" data-testid={`badge-status-${status}`}><CircleDot className="w-3 h-3 mr-1" />Open</Badge>;
    case 'IN_PROGRESS':
      return <Badge variant="default" className="bg-blue-500" data-testid={`badge-status-${status}`}><Loader2 className="w-3 h-3 mr-1 animate-spin" />In Progress</Badge>;
    case 'COMPLETED':
      return <Badge variant="default" className="bg-green-500" data-testid={`badge-status-${status}`}><CheckCircle2 className="w-3 h-3 mr-1" />Completed</Badge>;
    case 'CANCELLED':
      return <Badge variant="secondary" data-testid={`badge-status-${status}`}><Ban className="w-3 h-3 mr-1" />Cancelled</Badge>;
    default:
      return <Badge variant="outline" data-testid={`badge-status-${status}`}>{status}</Badge>;
  }
};

const getDecisionBadge = (decision: string) => {
  switch (decision) {
    case 'PENDING':
      return <Badge variant="outline" data-testid={`badge-decision-${decision}`}><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    case 'KEEP':
      return <Badge variant="default" className="bg-green-500" data-testid={`badge-decision-${decision}`}><CheckCircle2 className="w-3 h-3 mr-1" />Keep</Badge>;
    case 'REVOKE':
      return <Badge variant="destructive" data-testid={`badge-decision-${decision}`}><UserMinus className="w-3 h-3 mr-1" />Revoke</Badge>;
    case 'CHANGE_ROLE':
      return <Badge variant="default" className="bg-yellow-500" data-testid={`badge-decision-${decision}`}><RotateCcw className="w-3 h-3 mr-1" />Change Role</Badge>;
    default:
      return <Badge variant="outline" data-testid={`badge-decision-${decision}`}>{decision}</Badge>;
  }
};

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
  INFRA_ADMIN: "bg-cyan-500",
};

const adminRoles = [
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'COUNTRY_ADMIN', label: 'Country Admin' },
  { value: 'CITY_ADMIN', label: 'City Admin' },
  { value: 'COMPLIANCE_ADMIN', label: 'Compliance Admin' },
  { value: 'SUPPORT_ADMIN', label: 'Support Admin' },
  { value: 'FINANCE_ADMIN', label: 'Finance Admin' },
  { value: 'RISK_ADMIN', label: 'Risk Admin' },
  { value: 'READONLY_ADMIN', label: 'Read-Only Admin' },
  { value: 'INFRA_ADMIN', label: 'Infrastructure Admin' },
];

export default function AccessReviewsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('cycles');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedCycle, setSelectedCycle] = useState<ReviewCycle | null>(null);
  const [decisionFilter, setDecisionFilter] = useState<string>('all');
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [cycleName, setCycleName] = useState('');
  const [cycleDescription, setCycleDescription] = useState('');
  const [cyclePeriod, setCyclePeriod] = useState('Q1 2025');
  const [cycleCountryScope, setCycleCountryScope] = useState<string>('');
  const [cycleTwoPersonRule, setCycleTwoPersonRule] = useState(false);
  
  const [decisionDialogOpen, setDecisionDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ReviewItem | null>(null);
  const [decisionType, setDecisionType] = useState<'KEEP' | 'REVOKE' | 'CHANGE_ROLE'>('KEEP');
  const [decisionJustification, setDecisionJustification] = useState('');
  const [decisionNewRole, setDecisionNewRole] = useState('');
  
  const [secondApprovalDialogOpen, setSecondApprovalDialogOpen] = useState(false);

  const { data: cyclesData, isLoading: cyclesLoading, refetch: refetchCycles } = useQuery<{ cycles: ReviewCycle[]; total: number }>({
    queryKey: ['/api/admin/access-reviews/cycles', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      const res = await fetch(`/api/admin/access-reviews/cycles?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch cycles');
      return res.json();
    },
  });

  const { data: statsData } = useQuery<{ totalCycles: number; openCycles: number; completedCycles: number; inProgressCycles: number; totalItems: number; enforcedItems: number }>({
    queryKey: ['/api/admin/access-reviews/stats'],
  });

  const { data: itemsData, isLoading: itemsLoading, refetch: refetchItems } = useQuery<{ items: ReviewItem[]; total: number }>({
    queryKey: ['/api/admin/access-reviews/cycles', selectedCycle?.id, 'items', decisionFilter, teamFilter],
    queryFn: async () => {
      if (!selectedCycle) return { items: [], total: 0 };
      const params = new URLSearchParams();
      if (decisionFilter !== 'all') params.append('decision', decisionFilter);
      if (teamFilter !== 'all') params.append('team', teamFilter);
      const res = await fetch(`/api/admin/access-reviews/cycles/${selectedCycle.id}/items?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch items');
      return res.json();
    },
    enabled: !!selectedCycle,
  });

  const { data: cycleStats } = useQuery<CycleStats>({
    queryKey: ['/api/admin/access-reviews/cycles', selectedCycle?.id, 'stats'],
    enabled: !!selectedCycle,
  });

  const { data: teamsData } = useQuery<{ teams: string[] }>({
    queryKey: ['/api/admin/access-reviews/filters/teams'],
  });

  const createCycleMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; period: string; countryScope?: string; requiresTwoPersonRule: boolean }) => {
      return apiRequest('/api/admin/access-reviews/cycles', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Review cycle created successfully' });
      setCreateDialogOpen(false);
      setCycleName('');
      setCycleDescription('');
      refetchCycles();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const startCycleMutation = useMutation({
    mutationFn: async (cycleId: string) => {
      return apiRequest(`/api/admin/access-reviews/cycles/${cycleId}/start`, { method: 'POST' });
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Review cycle started' });
      refetchCycles();
      if (selectedCycle) {
        refetchItems();
      }
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const completeCycleMutation = useMutation({
    mutationFn: async (cycleId: string) => {
      return apiRequest(`/api/admin/access-reviews/cycles/${cycleId}/complete`, { method: 'POST' });
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Review cycle completed and decisions enforced' });
      refetchCycles();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const cancelCycleMutation = useMutation({
    mutationFn: async (cycleId: string) => {
      return apiRequest(`/api/admin/access-reviews/cycles/${cycleId}/cancel`, { method: 'POST' });
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Review cycle cancelled' });
      refetchCycles();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const makeDecisionMutation = useMutation({
    mutationFn: async (data: { itemId: string; decision: string; justificationText?: string; newRole?: string }) => {
      return apiRequest(`/api/admin/access-reviews/items/${data.itemId}/decision`, {
        method: 'POST',
        body: JSON.stringify({
          decision: data.decision,
          justificationText: data.justificationText,
          newRole: data.newRole,
        }),
      });
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Decision recorded successfully' });
      setDecisionDialogOpen(false);
      setSelectedItem(null);
      setDecisionJustification('');
      setDecisionNewRole('');
      refetchItems();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const secondApprovalMutation = useMutation({
    mutationFn: async (data: { itemId: string; decision: string }) => {
      return apiRequest(`/api/admin/access-reviews/items/${data.itemId}/second-approval`, {
        method: 'POST',
        body: JSON.stringify({ decision: data.decision }),
      });
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Second approval recorded' });
      setSecondApprovalDialogOpen(false);
      setSelectedItem(null);
      refetchItems();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const handleExport = async (cycleId: string) => {
    try {
      const res = await fetch(`/api/admin/access-reviews/cycles/${cycleId}/export`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `access-review-${cycleId}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({ title: 'Success', description: 'Export downloaded successfully' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const filteredItems = itemsData?.items.filter(item => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.adminEmail.toLowerCase().includes(query) ||
      item.adminName?.toLowerCase().includes(query) ||
      item.currentRole.toLowerCase().includes(query) ||
      item.team?.toLowerCase().includes(query)
    );
  }) || [];

  const renderCyclesList = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40" data-testid="select-status-filter">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="OPEN">Open</SelectItem>
              <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-cycle">
          <Plus className="w-4 h-4 mr-2" />
          Create Review Cycle
        </Button>
      </div>

      {cyclesLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : cyclesData?.cycles.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <ClipboardCheck className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No review cycles found</p>
            <Button className="mt-4" onClick={() => setCreateDialogOpen(true)} data-testid="button-create-first-cycle">
              Create Your First Review Cycle
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {cyclesData?.cycles.map(cycle => (
            <Card key={cycle.id} className="hover-elevate cursor-pointer" onClick={() => setSelectedCycle(cycle)} data-testid={`card-cycle-${cycle.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      {cycle.name}
                      {getStatusBadge(cycle.status)}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {cycle.description || `Review period: ${cycle.period}`}
                    </CardDescription>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {cycle.period}
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    {cycle.totalItems} admin roles
                  </div>
                  {cycle.countryScope && (
                    <div className="flex items-center gap-1">
                      <Globe className="w-4 h-4" />
                      {cycle.countryScope}
                    </div>
                  )}
                  {cycle.requiresTwoPersonRule && (
                    <Badge variant="outline" className="text-xs">
                      <Shield className="w-3 h-3 mr-1" />
                      Two-Person Rule
                    </Badge>
                  )}
                </div>
                {cycle.status === 'IN_PROGRESS' && cycle.totalItems > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span>Progress</span>
                      <span>{Math.round((cycle.reviewedItems / cycle.totalItems) * 100)}%</span>
                    </div>
                    <Progress value={(cycle.reviewedItems / cycle.totalItems) * 100} className="h-2" />
                  </div>
                )}
                {cycle.status === 'COMPLETED' && (
                  <div className="mt-3 flex items-center gap-4 text-sm">
                    <Badge variant="default" className="bg-green-500">{cycle.keptCount} Kept</Badge>
                    <Badge variant="destructive">{cycle.revokedCount} Revoked</Badge>
                    <Badge variant="default" className="bg-yellow-500">{cycle.changedRoleCount} Changed</Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const renderCycleDetail = () => {
    if (!selectedCycle) return null;

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setSelectedCycle(null)} data-testid="button-back-to-cycles">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              {selectedCycle.name}
              {getStatusBadge(selectedCycle.status)}
            </h2>
            <p className="text-sm text-muted-foreground">{selectedCycle.period}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {selectedCycle.status === 'OPEN' && (
            <Button onClick={() => startCycleMutation.mutate(selectedCycle.id)} disabled={startCycleMutation.isPending} data-testid="button-start-cycle">
              {startCycleMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
              Start Review
            </Button>
          )}
          {selectedCycle.status === 'IN_PROGRESS' && (
            <>
              <Button onClick={() => completeCycleMutation.mutate(selectedCycle.id)} disabled={completeCycleMutation.isPending} data-testid="button-complete-cycle">
                {completeCycleMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCheck className="w-4 h-4 mr-2" />}
                Complete & Enforce
              </Button>
              <Button variant="outline" onClick={() => cancelCycleMutation.mutate(selectedCycle.id)} disabled={cancelCycleMutation.isPending} data-testid="button-cancel-cycle">
                {cancelCycleMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Ban className="w-4 h-4 mr-2" />}
                Cancel Cycle
              </Button>
            </>
          )}
          <Button variant="outline" onClick={() => handleExport(selectedCycle.id)} data-testid="button-export-cycle">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="ghost" size="icon" onClick={() => refetchItems()} data-testid="button-refresh-items">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {cycleStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">{cycleStats.totalItems}</div>
                <div className="text-sm text-muted-foreground">Total Items</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">{cycleStats.completionRate}%</div>
                <div className="text-sm text-muted-foreground">Completed</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-green-600">{cycleStats.keptCount}</div>
                <div className="text-sm text-muted-foreground">Kept</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-red-600">{cycleStats.revokedCount + cycleStats.changedRoleCount}</div>
                <div className="text-sm text-muted-foreground">Changed/Revoked</div>
              </CardContent>
            </Card>
          </div>
        )}

        <Separator />

        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search by email, name, role..." 
              className="w-64" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-search-items"
            />
          </div>
          <Select value={decisionFilter} onValueChange={setDecisionFilter}>
            <SelectTrigger className="w-40" data-testid="select-decision-filter">
              <SelectValue placeholder="Decision" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Decisions</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="KEEP">Keep</SelectItem>
              <SelectItem value="REVOKE">Revoke</SelectItem>
              <SelectItem value="CHANGE_ROLE">Change Role</SelectItem>
            </SelectContent>
          </Select>
          <Select value={teamFilter} onValueChange={setTeamFilter}>
            <SelectTrigger className="w-40" data-testid="select-team-filter">
              <SelectValue placeholder="Team" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teams</SelectItem>
              {teamsData?.teams.map(team => (
                <SelectItem key={team} value={team}>{team}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {itemsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : filteredItems.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No review items found</p>
            </CardContent>
          </Card>
        ) : (
          <ScrollArea className="h-[500px]">
            <div className="space-y-2">
              {filteredItems.map(item => (
                <Card key={item.id} className="hover-elevate" data-testid={`card-item-${item.id}`}>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium truncate">{item.adminEmail}</span>
                          {getDecisionBadge(item.decision)}
                          {item.requiresSecondApproval && !item.secondApprovalAt && item.decision !== 'PENDING' && (
                            <Badge variant="outline" className="text-xs bg-orange-50">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Needs 2nd Approval
                            </Badge>
                          )}
                          {item.isEnforced && (
                            <Badge variant="default" className="bg-green-500 text-xs">
                              <CheckCheck className="w-3 h-3 mr-1" />
                              Enforced
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                          <div className="flex items-center gap-1">
                            <div className={`w-2 h-2 rounded-full ${roleColors[item.currentRole] || 'bg-gray-500'}`} />
                            {item.currentRole}
                          </div>
                          {item.newRole && (
                            <>
                              <ArrowRight className="w-3 h-3" />
                              <div className="flex items-center gap-1">
                                <div className={`w-2 h-2 rounded-full ${roleColors[item.newRole] || 'bg-gray-500'}`} />
                                {item.newRole}
                              </div>
                            </>
                          )}
                          {item.team && <span>Team: {item.team}</span>}
                          {item.country && <span>Country: {item.country}</span>}
                        </div>
                        {item.justificationText && (
                          <p className="mt-2 text-sm text-muted-foreground italic">
                            "{item.justificationText}"
                          </p>
                        )}
                        {item.decidedByAdminName && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Reviewed by {item.decidedByAdminName} {item.decidedAt && `on ${format(new Date(item.decidedAt), 'MMM d, yyyy')}`}
                          </p>
                        )}
                        {item.enforcementError && (
                          <Alert variant="destructive" className="mt-2">
                            <AlertTriangle className="w-4 h-4" />
                            <AlertDescription>{item.enforcementError}</AlertDescription>
                          </Alert>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {selectedCycle.status === 'IN_PROGRESS' && item.decision === 'PENDING' && (
                          <Button 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedItem(item);
                              setDecisionDialogOpen(true);
                            }}
                            data-testid={`button-review-${item.id}`}
                          >
                            <UserCog className="w-4 h-4 mr-1" />
                            Review
                          </Button>
                        )}
                        {item.requiresSecondApproval && item.decision !== 'PENDING' && !item.secondApprovalAt && (
                          <Button 
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedItem(item);
                              setSecondApprovalDialogOpen(true);
                            }}
                            data-testid={`button-second-approval-${item.id}`}
                          >
                            <CheckCheck className="w-4 h-4 mr-1" />
                            2nd Approval
                          </Button>
                        )}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`button-view-${item.id}`}>
                              <Eye className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>View Details</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Periodic Access Review"
        description="Audit and certify admin role assignments"
        icon={ClipboardCheck}
        backButton={{ label: "Back to Security", href: "/admin" }}
      />

      <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {statsData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold">{statsData.totalCycles}</div>
                  <div className="text-sm text-muted-foreground">Total Cycles</div>
                </div>
                <ClipboardCheck className="w-8 h-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-blue-600">{statsData.inProgressCycles}</div>
                  <div className="text-sm text-muted-foreground">In Progress</div>
                </div>
                <Loader2 className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-green-600">{statsData.completedCycles}</div>
                  <div className="text-sm text-muted-foreground">Completed</div>
                </div>
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold">{statsData.enforcedItems}</div>
                  <div className="text-sm text-muted-foreground">Enforced Actions</div>
                </div>
                <Shield className="w-8 h-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          {selectedCycle ? renderCycleDetail() : renderCyclesList()}
        </CardContent>
      </Card>
      </div>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Review Cycle</DialogTitle>
            <DialogDescription>
              Start a new access review cycle to audit admin role assignments
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="cycle-name">Cycle Name</Label>
              <Input 
                id="cycle-name" 
                value={cycleName} 
                onChange={(e) => setCycleName(e.target.value)}
                placeholder="e.g., Q1 2025 Access Review"
                data-testid="input-cycle-name"
              />
            </div>
            <div>
              <Label htmlFor="cycle-period">Review Period</Label>
              <Input 
                id="cycle-period" 
                value={cyclePeriod} 
                onChange={(e) => setCyclePeriod(e.target.value)}
                placeholder="e.g., Q1 2025"
                data-testid="input-cycle-period"
              />
            </div>
            <div>
              <Label htmlFor="cycle-description">Description (Optional)</Label>
              <Textarea 
                id="cycle-description" 
                value={cycleDescription} 
                onChange={(e) => setCycleDescription(e.target.value)}
                placeholder="Describe the scope and purpose of this review"
                data-testid="input-cycle-description"
              />
            </div>
            <div>
              <Label htmlFor="cycle-country">Country Scope (Optional)</Label>
              <Input 
                id="cycle-country" 
                value={cycleCountryScope} 
                onChange={(e) => setCycleCountryScope(e.target.value)}
                placeholder="e.g., US, BD, or leave empty for all"
                data-testid="input-cycle-country"
              />
            </div>
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                id="two-person-rule" 
                checked={cycleTwoPersonRule}
                onChange={(e) => setCycleTwoPersonRule(e.target.checked)}
                className="rounded"
                data-testid="checkbox-two-person-rule"
              />
              <Label htmlFor="two-person-rule" className="text-sm">
                Require two-person approval for sensitive changes
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={() => createCycleMutation.mutate({
                name: cycleName,
                description: cycleDescription,
                period: cyclePeriod,
                countryScope: cycleCountryScope || undefined,
                requiresTwoPersonRule: cycleTwoPersonRule,
              })}
              disabled={!cycleName || !cyclePeriod || createCycleMutation.isPending}
              data-testid="button-submit-create-cycle"
            >
              {createCycleMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Cycle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={decisionDialogOpen} onOpenChange={setDecisionDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Review Access</DialogTitle>
            <DialogDescription>
              {selectedItem && `Review access for ${selectedItem.adminEmail}`}
            </DialogDescription>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <div className="font-medium">{selectedItem.adminEmail}</div>
                <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                  <div className={`w-2 h-2 rounded-full ${roleColors[selectedItem.currentRole] || 'bg-gray-500'}`} />
                  Current Role: {selectedItem.currentRole}
                </div>
                {selectedItem.team && (
                  <div className="text-sm text-muted-foreground">Team: {selectedItem.team}</div>
                )}
              </div>
              
              <div>
                <Label>Decision</Label>
                <Select value={decisionType} onValueChange={(v) => setDecisionType(v as 'KEEP' | 'REVOKE' | 'CHANGE_ROLE')}>
                  <SelectTrigger data-testid="select-decision-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="KEEP">
                      <span className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        Keep Current Access
                      </span>
                    </SelectItem>
                    <SelectItem value="REVOKE">
                      <span className="flex items-center gap-2">
                        <UserMinus className="w-4 h-4 text-red-500" />
                        Revoke Access
                      </span>
                    </SelectItem>
                    <SelectItem value="CHANGE_ROLE">
                      <span className="flex items-center gap-2">
                        <RotateCcw className="w-4 h-4 text-yellow-500" />
                        Change Role
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {decisionType === 'CHANGE_ROLE' && (
                <div>
                  <Label>New Role</Label>
                  <Select value={decisionNewRole} onValueChange={setDecisionNewRole}>
                    <SelectTrigger data-testid="select-new-role">
                      <SelectValue placeholder="Select new role" />
                    </SelectTrigger>
                    <SelectContent>
                      {adminRoles.filter(r => r.value !== selectedItem.currentRole).map(role => (
                        <SelectItem key={role.value} value={role.value}>
                          <span className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${roleColors[role.value] || 'bg-gray-500'}`} />
                            {role.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label>Justification</Label>
                <Textarea 
                  value={decisionJustification} 
                  onChange={(e) => setDecisionJustification(e.target.value)}
                  placeholder="Provide a reason for your decision..."
                  data-testid="input-justification"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecisionDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={() => {
                if (!selectedItem) return;
                makeDecisionMutation.mutate({
                  itemId: selectedItem.id,
                  decision: decisionType,
                  justificationText: decisionJustification || undefined,
                  newRole: decisionType === 'CHANGE_ROLE' ? decisionNewRole : undefined,
                });
              }}
              disabled={makeDecisionMutation.isPending || (decisionType === 'CHANGE_ROLE' && !decisionNewRole)}
              data-testid="button-submit-decision"
            >
              {makeDecisionMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Submit Decision
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={secondApprovalDialogOpen} onOpenChange={setSecondApprovalDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Second Approval Required</DialogTitle>
            <DialogDescription>
              This decision requires a second approver to confirm
            </DialogDescription>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <Alert>
                <Shield className="w-4 h-4" />
                <AlertTitle>Two-Person Rule</AlertTitle>
                <AlertDescription>
                  Review the first decision and provide your approval or rejection
                </AlertDescription>
              </Alert>
              
              <div className="p-3 bg-muted rounded-lg">
                <div className="font-medium">{selectedItem.adminEmail}</div>
                <div className="text-sm text-muted-foreground">Current Role: {selectedItem.currentRole}</div>
                <div className="text-sm mt-2">
                  First Decision: {getDecisionBadge(selectedItem.decision)}
                </div>
                {selectedItem.newRole && (
                  <div className="text-sm text-muted-foreground">
                    Proposed New Role: {selectedItem.newRole}
                  </div>
                )}
                {selectedItem.justificationText && (
                  <p className="text-sm text-muted-foreground mt-2 italic">
                    "{selectedItem.justificationText}"
                  </p>
                )}
                <div className="text-xs text-muted-foreground mt-2">
                  Reviewed by: {selectedItem.decidedByAdminName}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSecondApprovalDialogOpen(false)}>Cancel</Button>
            <Button 
              variant="destructive"
              onClick={() => {
                if (!selectedItem) return;
                secondApprovalMutation.mutate({
                  itemId: selectedItem.id,
                  decision: 'KEEP',
                });
              }}
              disabled={secondApprovalMutation.isPending}
              data-testid="button-reject-decision"
            >
              Reject
            </Button>
            <Button 
              onClick={() => {
                if (!selectedItem) return;
                secondApprovalMutation.mutate({
                  itemId: selectedItem.id,
                  decision: selectedItem.decision,
                });
              }}
              disabled={secondApprovalMutation.isPending}
              data-testid="button-approve-decision"
            >
              {secondApprovalMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
