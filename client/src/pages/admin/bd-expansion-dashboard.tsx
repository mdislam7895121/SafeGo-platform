import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Store,
  Ticket,
  Car,
  TrendingUp,
  Users,
  Package,
  ShoppingCart,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Eye,
  Download,
  DollarSign,
  Percent,
  Search,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Wallet,
  RefreshCw
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line
} from "recharts";

interface StatsData {
  stats: {
    shopPartners: {
      total: number;
      pending: number;
      approved: number;
      breakdown: Array<{ verificationStatus: string; _count: number }>;
    };
    ticketOperators: {
      total: number;
      pending: number;
      approved: number;
      breakdown: Array<{ verificationStatus: string; _count: number }>;
    };
    productOrders: Array<{ status: string; _count: number; _sum: { totalAmount: number | null } }>;
    ticketBookings: Array<{ status: string; _count: number; _sum: { totalAmount: number | null } }>;
    rentalBookings: Array<{ status: string; _count: number; _sum: { totalAmount: number | null } }>;
  };
}

interface ShopPartner {
  id: string;
  shopName: string;
  ownerName: string;
  phoneNumber: string;
  verificationStatus: string;
  commissionRate: number;
  walletBalance: number;
  negativeBalance: number;
  createdAt: string;
  user: { email: string; isBlocked: boolean };
  _count: { products: number; orders: number };
}

interface TicketOperator {
  id: string;
  operatorName: string;
  operatorType: string;
  phoneNumber: string;
  verificationStatus: string;
  ticketCommissionRate: number;
  rentalCommissionRate: number;
  walletBalance: number;
  negativeBalance: number;
  createdAt: string;
  user: { email: string; isBlocked: boolean };
  _count: { routes: number; vehicles: number; ticketBookings: number; rentalBookings: number };
}

interface NegativeBalanceData {
  negativeBalances: {
    shopPartners: {
      total: number;
      count: number;
      accounts: Array<{
        id: string;
        shopName: string;
        email: string;
        negativeBalance: number;
        walletBalance: number;
      }>;
    };
    ticketOperators: {
      total: number;
      count: number;
      accounts: Array<{
        id: string;
        operatorName: string;
        email: string;
        negativeBalance: number;
        walletBalance: number;
      }>;
    };
    grandTotal: number;
  };
}

const CHART_COLORS = ["#22c55e", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6", "#ec4899"];

const statusLabels: Record<string, string> = {
  pending: "পেন্ডিং",
  approved: "অনুমোদিত",
  rejected: "প্রত্যাখ্যাত",
  suspended: "স্থগিত",
  under_review: "পর্যালোচনাধীন",
  requested: "অনুরোধ",
  confirmed: "নিশ্চিত",
  preparing: "প্রস্তুত হচ্ছে",
  ready: "প্রস্তুত",
  picked_up: "পিকআপ",
  delivered: "ডেলিভারি",
  cancelled: "বাতিল",
  booked: "বুক হয়েছে",
  used: "ব্যবহৃত",
  active: "সক্রিয়",
  completed: "সম্পন্ন",
  accepted: "গৃহীত"
};

export default function BDExpansionDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const { toast } = useToast();

  const { data: statsData, isLoading: statsLoading } = useQuery<StatsData>({
    queryKey: ["/api/admin/bd-expansion/bd-expansion/stats"],
  });

  const { data: negativeData, isLoading: negativeLoading } = useQuery<NegativeBalanceData>({
    queryKey: ["/api/admin/bd-expansion/negative-balances"],
  });

  const stats = statsData?.stats;

  const shopPartnerChartData = stats?.shopPartners.breakdown.map(item => ({
    name: statusLabels[item.verificationStatus] || item.verificationStatus,
    value: item._count,
    status: item.verificationStatus
  })) || [];

  const ticketOperatorChartData = stats?.ticketOperators.breakdown.map(item => ({
    name: statusLabels[item.verificationStatus] || item.verificationStatus,
    value: item._count,
    status: item.verificationStatus
  })) || [];

  const orderChartData = stats?.productOrders.map(item => ({
    name: statusLabels[item.status] || item.status,
    count: item._count,
    amount: item._sum.totalAmount || 0
  })) || [];

  const ticketBookingChartData = stats?.ticketBookings.map(item => ({
    name: statusLabels[item.status] || item.status,
    count: item._count,
    amount: item._sum.totalAmount || 0
  })) || [];

  const rentalBookingChartData = stats?.rentalBookings.map(item => ({
    name: statusLabels[item.status] || item.status,
    count: item._count,
    amount: item._sum.totalAmount || 0
  })) || [];

  const totalProductOrders = stats?.productOrders.reduce((acc, o) => acc + o._count, 0) || 0;
  const totalTicketBookings = stats?.ticketBookings.reduce((acc, b) => acc + b._count, 0) || 0;
  const totalRentalBookings = stats?.rentalBookings.reduce((acc, b) => acc + b._count, 0) || 0;

  const totalProductRevenue = stats?.productOrders.reduce((acc, o) => acc + (o._sum.totalAmount || 0), 0) || 0;
  const totalTicketRevenue = stats?.ticketBookings.reduce((acc, b) => acc + (b._sum.totalAmount || 0), 0) || 0;
  const totalRentalRevenue = stats?.rentalBookings.reduce((acc, b) => acc + (b._sum.totalAmount || 0), 0) || 0;

  const commissionData = [
    { name: "শপ কমিশন", value: totalProductRevenue * 0.1 },
    { name: "টিকিট কমিশন", value: totalTicketRevenue * 0.08 },
    { name: "রেন্টাল কমিশন", value: totalRentalRevenue * 0.12 }
  ];

  if (statsLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <BarChart3 className="h-6 w-6 text-primary" />
            বাংলাদেশ এক্সপানশন ড্যাশবোর্ড
          </h1>
          <p className="text-muted-foreground">
            বাংলাদেশ মার্কেটের সম্পূর্ণ বিশ্লেষণ ও পরিচালনা
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/admin/bd-expansion"] });
            toast({ title: "রিফ্রেশ হচ্ছে..." });
          }}
          data-testid="button-refresh"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          রিফ্রেশ
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-auto">
          <TabsTrigger value="overview" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground" data-testid="tab-overview">
            সারাংশ
          </TabsTrigger>
          <TabsTrigger value="shops" data-testid="tab-shops">
            শপ পার্টনার
          </TabsTrigger>
          <TabsTrigger value="operators" data-testid="tab-operators">
            টিকিট/রেন্টাল
          </TabsTrigger>
          <TabsTrigger value="commission" data-testid="tab-commission">
            কমিশন
          </TabsTrigger>
          <TabsTrigger value="settlements" data-testid="tab-settlements">
            সেটেলমেন্ট
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <OverviewTab
            stats={stats}
            shopPartnerChartData={shopPartnerChartData}
            ticketOperatorChartData={ticketOperatorChartData}
            orderChartData={orderChartData}
            ticketBookingChartData={ticketBookingChartData}
            rentalBookingChartData={rentalBookingChartData}
            commissionData={commissionData}
            negativeData={negativeData}
            totalProductOrders={totalProductOrders}
            totalTicketBookings={totalTicketBookings}
            totalRentalBookings={totalRentalBookings}
          />
        </TabsContent>

        <TabsContent value="shops">
          <ShopPartnersTab />
        </TabsContent>

        <TabsContent value="operators">
          <TicketOperatorsTab />
        </TabsContent>

        <TabsContent value="commission">
          <CommissionTab />
        </TabsContent>

        <TabsContent value="settlements">
          <SettlementsTab negativeData={negativeData} isLoading={negativeLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OverviewTab({
  stats,
  shopPartnerChartData,
  ticketOperatorChartData,
  orderChartData,
  ticketBookingChartData,
  rentalBookingChartData,
  commissionData,
  negativeData,
  totalProductOrders,
  totalTicketBookings,
  totalRentalBookings
}: {
  stats: StatsData["stats"] | undefined;
  shopPartnerChartData: any[];
  ticketOperatorChartData: any[];
  orderChartData: any[];
  ticketBookingChartData: any[];
  rentalBookingChartData: any[];
  commissionData: any[];
  negativeData: NegativeBalanceData | undefined;
  totalProductOrders: number;
  totalTicketBookings: number;
  totalRentalBookings: number;
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          icon={Store}
          label="শপ পার্টনার"
          value={stats?.shopPartners.total || 0}
          subValue={`${stats?.shopPartners.pending || 0} পেন্ডিং`}
          color="text-blue-600"
          bgColor="bg-blue-50 dark:bg-blue-950"
          testId="stat-shop-partners"
        />
        <StatCard
          icon={Ticket}
          label="টিকিট/রেন্টাল"
          value={stats?.ticketOperators.total || 0}
          subValue={`${stats?.ticketOperators.pending || 0} পেন্ডিং`}
          color="text-purple-600"
          bgColor="bg-purple-50 dark:bg-purple-950"
          testId="stat-ticket-operators"
        />
        <StatCard
          icon={ShoppingCart}
          label="শপ অর্ডার"
          value={totalProductOrders}
          subValue="মোট অর্ডার"
          color="text-green-600"
          bgColor="bg-green-50 dark:bg-green-950"
          testId="stat-shop-orders"
        />
        <StatCard
          icon={Ticket}
          label="টিকিট বুকিং"
          value={totalTicketBookings}
          subValue="মোট বুকিং"
          color="text-orange-600"
          bgColor="bg-orange-50 dark:bg-orange-950"
          testId="stat-ticket-bookings"
        />
        <StatCard
          icon={Car}
          label="রেন্টাল বুকিং"
          value={totalRentalBookings}
          subValue="মোট বুকিং"
          color="text-cyan-600"
          bgColor="bg-cyan-50 dark:bg-cyan-950"
          testId="stat-rental-bookings"
        />
        <StatCard
          icon={AlertTriangle}
          label="নেতিবাচক ব্যালেন্স"
          value={`৳${(negativeData?.negativeBalances.grandTotal || 0).toLocaleString("bn-BD")}`}
          subValue={`${(negativeData?.negativeBalances.shopPartners.count || 0) + (negativeData?.negativeBalances.ticketOperators.count || 0)} অ্যাকাউন্ট`}
          color="text-red-600"
          bgColor="bg-red-50 dark:bg-red-950"
          testId="stat-negative-balance"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Store className="h-5 w-5" />
              শপ পার্টনার স্ট্যাটাস
            </CardTitle>
          </CardHeader>
          <CardContent>
            {shopPartnerChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={shopPartnerChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {shopPartnerChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                কোনো ডেটা নেই
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Ticket className="h-5 w-5" />
              টিকিট/রেন্টাল অপারেটর স্ট্যাটাস
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ticketOperatorChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={ticketOperatorChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {ticketOperatorChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                কোনো ডেটা নেই
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              শপ অর্ডার সারাংশ
            </CardTitle>
          </CardHeader>
          <CardContent>
            {orderChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={orderChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#22c55e" name="অর্ডার" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[180px] flex items-center justify-center text-muted-foreground">
                কোনো অর্ডার নেই
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Ticket className="h-5 w-5" />
              টিকিট বুকিং সারাংশ
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ticketBookingChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={ticketBookingChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#f59e0b" name="বুকিং" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[180px] flex items-center justify-center text-muted-foreground">
                কোনো বুকিং নেই
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Car className="h-5 w-5" />
              রেন্টাল বুকিং সারাংশ
            </CardTitle>
          </CardHeader>
          <CardContent>
            {rentalBookingChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={rentalBookingChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#06b6d4" name="বুকিং" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[180px] flex items-center justify-center text-muted-foreground">
                কোনো বুকিং নেই
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            কমিশন ও আয় বিশ্লেষণ
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={commissionData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ৳${value.toFixed(0)}`}
                >
                  {commissionData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `৳${value.toFixed(2)}`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                <span>শপ কমিশন (১০%)</span>
                <span className="font-bold text-green-600">৳{(commissionData[0]?.value || 0).toLocaleString("bn-BD")}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                <span>টিকিট কমিশন (৮%)</span>
                <span className="font-bold text-orange-600">৳{(commissionData[1]?.value || 0).toLocaleString("bn-BD")}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                <span>রেন্টাল কমিশন (১২%)</span>
                <span className="font-bold text-cyan-600">৳{(commissionData[2]?.value || 0).toLocaleString("bn-BD")}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  subValue,
  color,
  bgColor,
  testId
}: {
  icon: any;
  label: string;
  value: number | string;
  subValue: string;
  color: string;
  bgColor: string;
  testId: string;
}) {
  return (
    <Card className={bgColor}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full ${bgColor}`}>
            <Icon className={`h-5 w-5 ${color}`} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-lg font-bold ${color}`} data-testid={testId}>
              {typeof value === "number" ? value.toLocaleString("bn-BD") : value}
            </p>
            <p className="text-xs text-muted-foreground">{subValue}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ShopPartnersTab() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [selectedShop, setSelectedShop] = useState<ShopPartner | null>(null);
  const [actionDialog, setActionDialog] = useState<{ type: "approve" | "reject" | "suspend"; shop: ShopPartner } | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const { toast } = useToast();

  const { data, isLoading } = useQuery<{ shopPartners: ShopPartner[]; pagination: any }>({
    queryKey: ["/api/admin/bd-expansion/shop-partners", { search, verificationStatus: statusFilter, page }],
  });

  const verifyMutation = useMutation({
    mutationFn: async ({ id, action, rejectionReason }: { id: string; action: string; rejectionReason?: string }) => {
      return apiRequest(`/api/admin/bd-expansion/shop-partners/${id}/verify`, {
        method: "PATCH",
        body: JSON.stringify({ action, rejectionReason }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bd-expansion/shop-partners"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bd-expansion/bd-expansion/stats"] });
      toast({ title: "সফল", description: "শপ পার্টনার আপডেট হয়েছে" });
      setActionDialog(null);
      setRejectionReason("");
    },
    onError: () => {
      toast({ title: "ত্রুটি", description: "আপডেট করতে ব্যর্থ", variant: "destructive" });
    }
  });

  const handleAction = () => {
    if (!actionDialog) return;
    verifyMutation.mutate({
      id: actionDialog.shop.id,
      action: actionDialog.type,
      rejectionReason: actionDialog.type === "reject" ? rejectionReason : undefined
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="নাম বা ফোন দিয়ে খুঁজুন..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            data-testid="input-search-shops"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border rounded-md px-3 py-2 bg-background"
          data-testid="select-status-filter"
        >
          <option value="">সব স্ট্যাটাস</option>
          <option value="pending">পেন্ডিং</option>
          <option value="approved">অনুমোদিত</option>
          <option value="rejected">প্রত্যাখ্যাত</option>
          <option value="suspended">স্থগিত</option>
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {data?.shopPartners.map((shop) => (
            <Card key={shop.id} className="hover-elevate" data-testid={`card-shop-${shop.id}`}>
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Store className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{shop.shopName}</h3>
                      <p className="text-sm text-muted-foreground">{shop.ownerName} - {shop.phoneNumber}</p>
                      <div className="flex gap-2 mt-1">
                        <Badge variant={shop.verificationStatus === "approved" ? "default" : shop.verificationStatus === "pending" ? "secondary" : "destructive"}>
                          {statusLabels[shop.verificationStatus] || shop.verificationStatus}
                        </Badge>
                        <Badge variant="outline">{shop._count.products} পণ্য</Badge>
                        <Badge variant="outline">{shop._count.orders} অর্ডার</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedShop(shop)}
                      data-testid={`button-view-shop-${shop.id}`}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      দেখুন
                    </Button>
                    {shop.verificationStatus === "pending" && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => setActionDialog({ type: "approve", shop })}
                          data-testid={`button-approve-shop-${shop.id}`}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          অনুমোদন
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setActionDialog({ type: "reject", shop })}
                          data-testid={`button-reject-shop-${shop.id}`}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          প্রত্যাখ্যান
                        </Button>
                      </>
                    )}
                    {shop.verificationStatus === "approved" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActionDialog({ type: "suspend", shop })}
                        data-testid={`button-suspend-shop-${shop.id}`}
                      >
                        <AlertTriangle className="h-4 w-4 mr-1" />
                        স্থগিত
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {data?.shopPartners.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Store className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>কোনো শপ পার্টনার পাওয়া যায়নি</p>
            </div>
          )}
        </div>
      )}

      {data?.pagination && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            data-testid="button-prev-page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">
            পৃষ্ঠা {page} / {data.pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page === data.pagination.totalPages}
            onClick={() => setPage(p => p + 1)}
            data-testid="button-next-page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <Dialog open={!!actionDialog} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog?.type === "approve" && "শপ পার্টনার অনুমোদন"}
              {actionDialog?.type === "reject" && "শপ পার্টনার প্রত্যাখ্যান"}
              {actionDialog?.type === "suspend" && "শপ পার্টনার স্থগিত"}
            </DialogTitle>
            <DialogDescription>
              {actionDialog?.shop.shopName} - এই অ্যাকশন নিশ্চিত করুন
            </DialogDescription>
          </DialogHeader>
          {actionDialog?.type === "reject" && (
            <div className="space-y-2">
              <Label>প্রত্যাখ্যানের কারণ</Label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="কারণ লিখুন..."
                data-testid="input-rejection-reason"
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)} data-testid="button-cancel-action">
              বাতিল
            </Button>
            <Button
              variant={actionDialog?.type === "approve" ? "default" : "destructive"}
              onClick={handleAction}
              disabled={verifyMutation.isPending || (actionDialog?.type === "reject" && !rejectionReason)}
              data-testid="button-confirm-action"
            >
              {verifyMutation.isPending ? "প্রক্রিয়াধীন..." : "নিশ্চিত"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedShop} onOpenChange={() => setSelectedShop(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedShop?.shopName}</DialogTitle>
            <DialogDescription>শপ পার্টনার বিস্তারিত</DialogDescription>
          </DialogHeader>
          {selectedShop && (
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">মালিকের নাম</Label>
                  <p className="font-medium">{selectedShop.ownerName}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">ফোন</Label>
                  <p className="font-medium">{selectedShop.phoneNumber}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">ইমেইল</Label>
                  <p className="font-medium">{selectedShop.user.email}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">কমিশন রেট</Label>
                  <p className="font-medium">{selectedShop.commissionRate}%</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">ওয়ালেট ব্যালেন্স</Label>
                  <p className="font-medium text-green-600">৳{Number(selectedShop.walletBalance).toLocaleString("bn-BD")}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">নেতিবাচক ব্যালেন্স</Label>
                  <p className="font-medium text-red-600">৳{Number(selectedShop.negativeBalance).toLocaleString("bn-BD")}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TicketOperatorsTab() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [selectedOperator, setSelectedOperator] = useState<TicketOperator | null>(null);
  const [actionDialog, setActionDialog] = useState<{ type: "approve" | "reject" | "suspend"; operator: TicketOperator } | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const { toast } = useToast();

  const { data, isLoading } = useQuery<{ operators: TicketOperator[]; pagination: any }>({
    queryKey: ["/api/admin/bd-expansion/ticket-operators", { search, verificationStatus: statusFilter, page }],
  });

  const verifyMutation = useMutation({
    mutationFn: async ({ id, action, rejectionReason }: { id: string; action: string; rejectionReason?: string }) => {
      return apiRequest(`/api/admin/bd-expansion/ticket-operators/${id}/verify`, {
        method: "PATCH",
        body: JSON.stringify({ action, rejectionReason }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bd-expansion/ticket-operators"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bd-expansion/bd-expansion/stats"] });
      toast({ title: "সফল", description: "অপারেটর আপডেট হয়েছে" });
      setActionDialog(null);
      setRejectionReason("");
    },
    onError: () => {
      toast({ title: "ত্রুটি", description: "আপডেট করতে ব্যর্থ", variant: "destructive" });
    }
  });

  const handleAction = () => {
    if (!actionDialog) return;
    verifyMutation.mutate({
      id: actionDialog.operator.id,
      action: actionDialog.type,
      rejectionReason: actionDialog.type === "reject" ? rejectionReason : undefined
    });
  };

  const operatorTypeLabels: Record<string, string> = {
    ticket: "টিকিট",
    rental: "রেন্টাল",
    both: "টিকিট ও রেন্টাল",
    bus_company: "বাস কোম্পানি",
    ferry_company: "ফেরি কোম্পানি",
    train_operator: "ট্রেন অপারেটর",
    rental_service: "রেন্টাল সার্ভিস"
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="নাম বা ফোন দিয়ে খুঁজুন..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            data-testid="input-search-operators"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border rounded-md px-3 py-2 bg-background"
          data-testid="select-operator-status-filter"
        >
          <option value="">সব স্ট্যাটাস</option>
          <option value="pending">পেন্ডিং</option>
          <option value="approved">অনুমোদিত</option>
          <option value="rejected">প্রত্যাখ্যাত</option>
          <option value="suspended">স্থগিত</option>
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {data?.operators?.map((operator) => (
            <Card key={operator.id} className="hover-elevate" data-testid={`card-operator-${operator.id}`}>
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-950 flex items-center justify-center">
                      <Ticket className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{operator.operatorName}</h3>
                      <p className="text-sm text-muted-foreground">
                        {operatorTypeLabels[operator.operatorType] || operator.operatorType} - {operator.phoneNumber}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        <Badge variant={operator.verificationStatus === "approved" ? "default" : operator.verificationStatus === "pending" ? "secondary" : "destructive"}>
                          {statusLabels[operator.verificationStatus] || operator.verificationStatus}
                        </Badge>
                        {operator._count?.routes > 0 && (
                          <Badge variant="outline">{operator._count.routes} রুট</Badge>
                        )}
                        {operator._count?.vehicles > 0 && (
                          <Badge variant="outline">{operator._count.vehicles} গাড়ি</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedOperator(operator)}
                      data-testid={`button-view-operator-${operator.id}`}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      দেখুন
                    </Button>
                    {operator.verificationStatus === "pending" && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => setActionDialog({ type: "approve", operator })}
                          data-testid={`button-approve-operator-${operator.id}`}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          অনুমোদন
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setActionDialog({ type: "reject", operator })}
                          data-testid={`button-reject-operator-${operator.id}`}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          প্রত্যাখ্যান
                        </Button>
                      </>
                    )}
                    {operator.verificationStatus === "approved" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActionDialog({ type: "suspend", operator })}
                        data-testid={`button-suspend-operator-${operator.id}`}
                      >
                        <AlertTriangle className="h-4 w-4 mr-1" />
                        স্থগিত
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {(!data?.operators || data.operators.length === 0) && (
            <div className="text-center py-12 text-muted-foreground">
              <Ticket className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>কোনো অপারেটর পাওয়া যায়নি</p>
            </div>
          )}
        </div>
      )}

      {data?.pagination && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            data-testid="button-prev-operators"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">
            পৃষ্ঠা {page} / {data.pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page === data.pagination.totalPages}
            onClick={() => setPage(p => p + 1)}
            data-testid="button-next-operators"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <Dialog open={!!actionDialog} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog?.type === "approve" && "অপারেটর অনুমোদন"}
              {actionDialog?.type === "reject" && "অপারেটর প্রত্যাখ্যান"}
              {actionDialog?.type === "suspend" && "অপারেটর স্থগিত"}
            </DialogTitle>
            <DialogDescription>
              {actionDialog?.operator.operatorName} - এই অ্যাকশন নিশ্চিত করুন
            </DialogDescription>
          </DialogHeader>
          {actionDialog?.type === "reject" && (
            <div className="space-y-2">
              <Label>প্রত্যাখ্যানের কারণ</Label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="কারণ লিখুন..."
                data-testid="input-operator-rejection-reason"
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)} data-testid="button-cancel-operator-action">
              বাতিল
            </Button>
            <Button
              variant={actionDialog?.type === "approve" ? "default" : "destructive"}
              onClick={handleAction}
              disabled={verifyMutation.isPending || (actionDialog?.type === "reject" && !rejectionReason)}
              data-testid="button-confirm-operator-action"
            >
              {verifyMutation.isPending ? "প্রক্রিয়াধীন..." : "নিশ্চিত"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedOperator} onOpenChange={() => setSelectedOperator(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedOperator?.operatorName}</DialogTitle>
            <DialogDescription>অপারেটর বিস্তারিত</DialogDescription>
          </DialogHeader>
          {selectedOperator && (
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">অপারেটর টাইপ</Label>
                  <p className="font-medium">{operatorTypeLabels[selectedOperator.operatorType] || selectedOperator.operatorType}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">ফোন</Label>
                  <p className="font-medium">{selectedOperator.phoneNumber}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">ইমেইল</Label>
                  <p className="font-medium">{selectedOperator.user.email}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">টিকিট কমিশন</Label>
                  <p className="font-medium">{selectedOperator.ticketCommissionRate}%</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">রেন্টাল কমিশন</Label>
                  <p className="font-medium">{selectedOperator.rentalCommissionRate}%</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">ওয়ালেট ব্যালেন্স</Label>
                  <p className="font-medium text-green-600">৳{Number(selectedOperator.walletBalance).toLocaleString("bn-BD")}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">নেতিবাচক ব্যালেন্স</Label>
                  <p className="font-medium text-red-600">৳{Number(selectedOperator.negativeBalance).toLocaleString("bn-BD")}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CommissionTab() {
  const [shopCommission, setShopCommission] = useState("10");
  const [ticketCommission, setTicketCommission] = useState("8");
  const [rentalCommission, setRentalCommission] = useState("12");
  const { toast } = useToast();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Percent className="h-5 w-5" />
            কমিশন রেট সেটিংস
          </CardTitle>
          <CardDescription>
            বাংলাদেশ মার্কেটের জন্য কমিশন রেট কনফিগার করুন
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <Store className="h-5 w-5 text-green-600" />
                  <h3 className="font-semibold">শপ পার্টনার কমিশন</h3>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={shopCommission}
                    onChange={(e) => setShopCommission(e.target.value)}
                    className="w-20"
                    min="0"
                    max="100"
                    data-testid="input-shop-commission"
                  />
                  <span className="text-lg font-bold">%</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  প্রতিটি শপ অর্ডারের উপর কমিশন
                </p>
              </CardContent>
            </Card>

            <Card className="bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <Ticket className="h-5 w-5 text-orange-600" />
                  <h3 className="font-semibold">টিকিট কমিশন</h3>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={ticketCommission}
                    onChange={(e) => setTicketCommission(e.target.value)}
                    className="w-20"
                    min="0"
                    max="100"
                    data-testid="input-ticket-commission"
                  />
                  <span className="text-lg font-bold">%</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  প্রতিটি টিকিট বুকিংয়ের উপর কমিশন
                </p>
              </CardContent>
            </Card>

            <Card className="bg-cyan-50 dark:bg-cyan-950 border-cyan-200 dark:border-cyan-800">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <Car className="h-5 w-5 text-cyan-600" />
                  <h3 className="font-semibold">রেন্টাল কমিশন</h3>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={rentalCommission}
                    onChange={(e) => setRentalCommission(e.target.value)}
                    className="w-20"
                    min="0"
                    max="100"
                    data-testid="input-rental-commission"
                  />
                  <span className="text-lg font-bold">%</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  প্রতিটি রেন্টাল বুকিংয়ের উপর কমিশন
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => {
                toast({
                  title: "কমিশন রেট আপডেট",
                  description: "নতুন কমিশন রেট সেভ হয়েছে (ডেমো)"
                });
              }}
              data-testid="button-save-commission"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              সেভ করুন
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            কমিশন সারাংশ
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">শপ কমিশন (এই মাস)</p>
              <p className="text-2xl font-bold text-green-600">৳০</p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">টিকিট কমিশন (এই মাস)</p>
              <p className="text-2xl font-bold text-orange-600">৳০</p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">রেন্টাল কমিশন (এই মাস)</p>
              <p className="text-2xl font-bold text-cyan-600">৳০</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SettlementsTab({ negativeData, isLoading }: { negativeData: NegativeBalanceData | undefined; isLoading: boolean }) {
  const [settleDialog, setSettleDialog] = useState<{ type: "shop-partner" | "ticket-operator"; id: string; name: string; balance: number } | null>(null);
  const [settleAmount, setSettleAmount] = useState("");
  const { toast } = useToast();

  const settleMutation = useMutation({
    mutationFn: async ({ type, id, amount }: { type: string; id: string; amount: number }) => {
      return apiRequest(`/api/admin/bd-expansion/settle-balance/${type}/${id}`, {
        method: "POST",
        body: JSON.stringify({ amount }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bd-expansion/negative-balances"] });
      toast({ title: "সফল", description: "ব্যালেন্স সেটেল হয়েছে" });
      setSettleDialog(null);
      setSettleAmount("");
    },
    onError: () => {
      toast({ title: "ত্রুটি", description: "সেটেল করতে ব্যর্থ", variant: "destructive" });
    }
  });

  const handleSettle = () => {
    if (!settleDialog || !settleAmount) return;
    settleMutation.mutate({
      type: settleDialog.type,
      id: settleDialog.id,
      amount: parseFloat(settleAmount)
    });
  };

  const exportCSV = () => {
    if (!negativeData) return;

    const rows = [
      ["Type", "Name", "Email", "Negative Balance", "Wallet Balance"]
    ];

    negativeData.negativeBalances.shopPartners.accounts.forEach(acc => {
      rows.push(["Shop Partner", acc.shopName, acc.email, String(acc.negativeBalance), String(acc.walletBalance)]);
    });

    negativeData.negativeBalances.ticketOperators.accounts.forEach(acc => {
      rows.push(["Ticket Operator", acc.operatorName, acc.email, String(acc.negativeBalance), String(acc.walletBalance)]);
    });

    const csvContent = rows.map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `negative-balances-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({ title: "এক্সপোর্ট সফল", description: "CSV ফাইল ডাউনলোড হয়েছে" });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            নেতিবাচক ব্যালেন্স সেটেলমেন্ট
          </h2>
          <p className="text-sm text-muted-foreground">
            মোট বকেয়া: <span className="font-bold text-red-600">৳{(negativeData?.negativeBalances.grandTotal || 0).toLocaleString("bn-BD")}</span>
          </p>
        </div>
        <Button variant="outline" onClick={exportCSV} data-testid="button-export-csv">
          <Download className="h-4 w-4 mr-2" />
          CSV এক্সপোর্ট
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Store className="h-5 w-5" />
              শপ পার্টনার ({negativeData?.negativeBalances.shopPartners.count || 0})
            </CardTitle>
            <CardDescription>
              মোট: ৳{(negativeData?.negativeBalances.shopPartners.total || 0).toLocaleString("bn-BD")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {negativeData?.negativeBalances.shopPartners.accounts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-600" />
                <p>কোনো নেতিবাচক ব্যালেন্স নেই</p>
              </div>
            ) : (
              negativeData?.negativeBalances.shopPartners.accounts.map((acc) => (
                <div
                  key={acc.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  data-testid={`settlement-shop-${acc.id}`}
                >
                  <div>
                    <p className="font-medium">{acc.shopName}</p>
                    <p className="text-xs text-muted-foreground">{acc.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-red-600">৳{Number(acc.negativeBalance).toLocaleString("bn-BD")}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSettleDialog({
                        type: "shop-partner",
                        id: acc.id,
                        name: acc.shopName,
                        balance: Number(acc.negativeBalance)
                      })}
                      data-testid={`button-settle-shop-${acc.id}`}
                    >
                      সেটেল
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Ticket className="h-5 w-5" />
              টিকিট/রেন্টাল অপারেটর ({negativeData?.negativeBalances.ticketOperators.count || 0})
            </CardTitle>
            <CardDescription>
              মোট: ৳{(negativeData?.negativeBalances.ticketOperators.total || 0).toLocaleString("bn-BD")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {negativeData?.negativeBalances.ticketOperators.accounts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-600" />
                <p>কোনো নেতিবাচক ব্যালেন্স নেই</p>
              </div>
            ) : (
              negativeData?.negativeBalances.ticketOperators.accounts.map((acc) => (
                <div
                  key={acc.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  data-testid={`settlement-operator-${acc.id}`}
                >
                  <div>
                    <p className="font-medium">{acc.operatorName}</p>
                    <p className="text-xs text-muted-foreground">{acc.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-red-600">৳{Number(acc.negativeBalance).toLocaleString("bn-BD")}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSettleDialog({
                        type: "ticket-operator",
                        id: acc.id,
                        name: acc.operatorName,
                        balance: Number(acc.negativeBalance)
                      })}
                      data-testid={`button-settle-operator-${acc.id}`}
                    >
                      সেটেল
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!settleDialog} onOpenChange={() => setSettleDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ব্যালেন্স সেটেল করুন</DialogTitle>
            <DialogDescription>
              {settleDialog?.name} - বর্তমান বকেয়া: ৳{settleDialog?.balance.toLocaleString("bn-BD")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>সেটেল পরিমাণ (৳)</Label>
              <Input
                type="number"
                value={settleAmount}
                onChange={(e) => setSettleAmount(e.target.value)}
                placeholder="পরিমাণ লিখুন"
                min="0"
                max={settleDialog?.balance}
                data-testid="input-settle-amount"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setSettleAmount(String(settleDialog?.balance || 0))}
                data-testid="button-settle-full"
              >
                সম্পূর্ণ সেটেল
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettleDialog(null)} data-testid="button-cancel-settle">
              বাতিল
            </Button>
            <Button
              onClick={handleSettle}
              disabled={settleMutation.isPending || !settleAmount || parseFloat(settleAmount) <= 0}
              data-testid="button-confirm-settle"
            >
              {settleMutation.isPending ? "প্রক্রিয়াধীন..." : "সেটেল করুন"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
