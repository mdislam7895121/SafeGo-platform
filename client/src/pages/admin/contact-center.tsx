import { useState } from "react";
import { useLocation } from "wouter";
import { MessageSquare, Filter, Eye, Mail, Globe, Clock, Search as SearchIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";

interface ContactSubmission {
  id: string;
  createdAt: string;
  updatedAt: string;
  fullName: string;
  email: string;
  country: string;
  region: string | null;
  category: string;
  categoryLabel: string;
  status: string;
  priority: string;
  relatedService: string | null;
  assignedToAdminId: string | null;
  resolvedAt: string | null;
}

interface ContactsResponse {
  submissions: ContactSubmission[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  stats: {
    open: number;
    pending: number;
    resolved: number;
  };
}

const CATEGORY_COLORS: Record<string, string> = {
  rides: "bg-blue-500",
  food: "bg-orange-500",
  parcel: "bg-purple-500",
  shops: "bg-cyan-500",
  tickets: "bg-indigo-500",
  driver: "bg-green-500",
  partner: "bg-pink-500",
  payment: "bg-yellow-500",
  safety: "bg-red-500",
  technical: "bg-gray-500",
  general: "bg-slate-500",
  other: "bg-slate-400"
};

export default function AdminContactCenter() {
  const [, navigate] = useLocation();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const queryParams = new URLSearchParams();
  if (statusFilter !== "all") queryParams.append("status", statusFilter);
  if (priorityFilter !== "all") queryParams.append("priority", priorityFilter);
  if (regionFilter !== "all") queryParams.append("region", regionFilter);
  if (searchQuery.trim()) queryParams.append("search", searchQuery.trim());
  queryParams.append("page", currentPage.toString());
  queryParams.append("limit", "20");

  const queryString = queryParams.toString();
  const fullUrl = `/api/contact${queryString ? `?${queryString}` : ''}`;

  const { data, isLoading, refetch } = useQuery<ContactsResponse>({
    queryKey: ['/api/contact', statusFilter, priorityFilter, regionFilter, searchQuery, currentPage],
    refetchInterval: 30000,
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "resolved":
        return <Badge className="bg-green-500" data-testid={`badge-resolved`}>Resolved</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500" data-testid={`badge-pending`}>Pending</Badge>;
      default:
        return <Badge variant="destructive" data-testid={`badge-open`}>Open</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "high":
        return <Badge variant="destructive" data-testid={`badge-priority-high`}>High</Badge>;
      case "normal":
        return <Badge variant="secondary" data-testid={`badge-priority-normal`}>Normal</Badge>;
      default:
        return <Badge variant="outline" data-testid={`badge-priority-low`}>Low</Badge>;
    }
  };

  const getRegionBadge = (region: string | null) => {
    switch (region) {
      case "BD":
        return <Badge variant="outline" className="border-green-500 text-green-600">BD</Badge>;
      case "US":
        return <Badge variant="outline" className="border-blue-500 text-blue-600">US</Badge>;
      default:
        return <Badge variant="outline">Global</Badge>;
    }
  };

  const handleSearch = () => {
    setCurrentPage(1);
    refetch();
  };

  return (
    <div className="min-h-screen bg-background pb-6">
      <PageHeader
        title="Contact Center"
        description="Manage public contact form submissions"
        icon={MessageSquare}
        backButton={{ label: "Back to Dashboard", href: "/admin" }}
      />

      <div className="p-6 space-y-6">
        {data && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Open</p>
                  <p className="text-2xl font-bold text-red-600" data-testid="text-open-count">{data.stats.open}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <MessageSquare className="h-5 w-5 text-red-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold text-yellow-600" data-testid="text-pending-count">{data.stats.pending}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-yellow-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Resolved</p>
                  <p className="text-2xl font-bold text-green-600" data-testid="text-resolved-count">{data.stats.resolved}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <MessageSquare className="h-5 w-5 text-green-600" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="md:col-span-2">
                <div className="flex gap-2">
                  <Input
                    placeholder="Search by name, email, or message..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    data-testid="input-search"
                  />
                  <Button onClick={handleSearch} size="icon" data-testid="button-search">
                    <SearchIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setCurrentPage(1); }}>
                <SelectTrigger data-testid="select-status">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={(value) => { setPriorityFilter(value); setCurrentPage(1); }}>
                <SelectTrigger data-testid="select-priority">
                  <SelectValue placeholder="All Priorities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
              <Select value={regionFilter} onValueChange={(value) => { setRegionFilter(value); setCurrentPage(1); }}>
                <SelectTrigger data-testid="select-region">
                  <SelectValue placeholder="All Regions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Regions</SelectItem>
                  <SelectItem value="BD">Bangladesh</SelectItem>
                  <SelectItem value="US">United States</SelectItem>
                  <SelectItem value="GLOBAL">Global</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Contact Submissions
                {data && (
                  <Badge variant="secondary" data-testid="text-total-count">
                    {data.pagination.total} total
                  </Badge>
                )}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-28 w-full" />
                ))}
              </div>
            ) : data && data.submissions.length > 0 ? (
              <div className="space-y-3">
                {data.submissions.map((submission) => (
                  <Card key={submission.id} className="hover-elevate cursor-pointer" onClick={() => navigate(`/admin/contact-center/${submission.id}`)} data-testid={`card-submission-${submission.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className={`inline-block w-2 h-2 rounded-full ${CATEGORY_COLORS[submission.category] || 'bg-gray-400'}`} />
                            <p className="font-semibold" data-testid={`text-category-${submission.id}`}>
                              {submission.categoryLabel}
                            </p>
                            {getStatusBadge(submission.status)}
                            {getPriorityBadge(submission.priority)}
                            {getRegionBadge(submission.region)}
                          </div>

                          <div className="space-y-2 text-sm">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              <div className="flex items-center gap-2">
                                <Mail className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <p className="font-medium" data-testid={`text-name-${submission.id}`}>{submission.fullName}</p>
                                  <p className="text-muted-foreground text-xs" data-testid={`text-email-${submission.id}`}>{submission.email}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Globe className="h-4 w-4 text-muted-foreground" />
                                <p data-testid={`text-country-${submission.id}`}>{submission.country}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Clock className="h-4 w-4" />
                              <p data-testid={`text-time-${submission.id}`}>
                                {formatDistanceToNow(new Date(submission.createdAt), { addSuffix: true })}
                              </p>
                            </div>
                          </div>
                        </div>

                        <Button variant="ghost" size="icon" data-testid={`button-view-${submission.id}`}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {data.pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between pt-4">
                    <p className="text-sm text-muted-foreground">
                      Page {data.pagination.page} of {data.pagination.totalPages}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(p => p - 1)}
                        data-testid="button-prev-page"
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage === data.pagination.totalPages}
                        onClick={() => setCurrentPage(p => p + 1)}
                        data-testid="button-next-page"
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground" data-testid="text-no-submissions">No contact submissions found</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
