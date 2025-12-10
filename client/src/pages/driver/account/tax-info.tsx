import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileText, Download, Upload, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { getAuthToken } from "@/lib/authToken";

export default function TaxInfo() {
  const { data: driverData, isLoading } = useQuery({
    queryKey: ["/api/driver/home"],
  });

  // Wait for data to load before rendering
  if (isLoading || !driverData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading tax information...</p>
        </div>
      </div>
    );
  }

  const profile = (driverData as any)?.profile;
  const countryCode = profile?.countryCode;

  // Show US or BD view based on driver's country
  if (countryCode === "BD") {
    return <BangladeshTaxView driverData={driverData} />;
  }

  // Default to US view for US drivers and others
  return <USTaxView driverData={driverData} />;
}

// ====================================================
// US Tax View (1099 Forms)
// ====================================================
function USTaxView({ driverData }: { driverData: any }) {
  const [_, navigate] = useLocation();
  const { toast } = useToast();

  // Fetch US tax summary
  const { data: taxSummary, isLoading: taxLoading } = useQuery({
    queryKey: ["/api/driver/tax-summary"],
  });

  const profile = driverData?.profile;
  const currentYear = new Date().getFullYear();
  
  // Determine W-9 status badge
  const w9Status = profile?.w9Status || "pending";
  const w9StatusConfig = {
    pending: { label: "Pending", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
    submitted: { label: "Submitted", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
    approved: { label: "On File", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  };
  
  const taxIdStatus = profile?.hasSSN ? "Verified" : "Pending";

  // Format currency for US drivers
  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`;
  };

  // Download US tax document
  const downloadTaxDocument = async (type: string, year: number) => {
    try {
      const response = await fetch(`/api/driver/tax-documents/${type}?year=${year}`, {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to download document");
      }

      const data = await response.json();

      // For now, download as JSON (later can be converted to PDF)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${type}-${year}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Success",
        description: `${type} document downloaded successfully`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to download tax document",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="bg-background">
      <div className="bg-primary text-primary-foreground p-6">
        <div className="flex items-center gap-4">
          <Link href="/driver/account">
            <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10" data-testid="button-back">
              <ArrowLeft className="h-6 w-6" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Tax Info</h1>
        </div>
      </div>

      <div className="p-6 max-w-2xl mx-auto space-y-6">
        {/* Year-to-Date Earnings Summary */}
        {!taxLoading && taxSummary && (
          <Card>
            <CardHeader>
              <CardTitle>Year-to-Date Earnings ({currentYear})</CardTitle>
              <CardDescription>Your earnings breakdown for tax purposes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <DollarSign className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Trip Revenue (1099-K)</p>
                    <p className="text-sm text-muted-foreground">Rides, deliveries, and fares</p>
                  </div>
                </div>
                <p className="text-lg font-bold" data-testid="text-trip-revenue">{formatCurrency(taxSummary.tripRevenue1099K || 0)}</p>
              </div>

              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <DollarSign className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Non-Trip Income (1099-NEC)</p>
                    <p className="text-sm text-muted-foreground">Bonuses, referrals, and promotions</p>
                  </div>
                </div>
                <p className="text-lg font-bold" data-testid="text-non-trip-income">{formatCurrency(taxSummary.nonTripIncome1099NEC || 0)}</p>
              </div>

              <div className="flex items-center justify-between p-4 bg-primary/10 rounded-lg border-2 border-primary/20">
                <div>
                  <p className="font-semibold">Total Earnings</p>
                  <p className="text-xs text-muted-foreground">Subject to tax reporting</p>
                </div>
                <p className="text-2xl font-bold text-primary" data-testid="text-total-earnings">{formatCurrency(taxSummary.totalEarnings || 0)}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tax Documents */}
        <Card>
          <CardHeader>
            <CardTitle>Tax Documents</CardTitle>
            <CardDescription>Download your tax forms and summaries</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Year-to-Date Tax Summary</p>
                  <p className="text-sm text-muted-foreground">Complete earnings breakdown for {currentYear}</p>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                data-testid="button-download-ytd-summary"
                onClick={() => downloadTaxDocument("ytd-summary", currentYear)}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>

            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">1099-K Form</p>
                  <p className="text-sm text-muted-foreground">Trip revenue for {currentYear}</p>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                data-testid="button-download-1099k"
                onClick={() => downloadTaxDocument("1099-K", currentYear)}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>

            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">1099-NEC Form</p>
                  <p className="text-sm text-muted-foreground">Non-trip income for {currentYear}</p>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                data-testid="button-download-1099nec"
                onClick={() => downloadTaxDocument("1099-NEC", currentYear)}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Taxpayer Information</CardTitle>
            <CardDescription>Verify your tax details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Tax ID Status</span>
              <Badge 
                variant="outline" 
                className={taxIdStatus === "Verified" 
                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                }
                data-testid="badge-tax-id-status"
              >
                {taxIdStatus}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">W-9 Form</span>
              <Badge 
                variant="outline" 
                className={w9StatusConfig[w9Status as keyof typeof w9StatusConfig]?.className}
                data-testid="badge-w9-status"
              >
                {w9StatusConfig[w9Status as keyof typeof w9StatusConfig]?.label}
              </Badge>
            </div>
            <Button 
              variant="outline" 
              className="w-full mt-4" 
              data-testid="button-update-tax"
              onClick={() => navigate("/driver/account/tax-info/edit")}
            >
              <Upload className="h-4 w-4 mr-2" />
              Update Tax Information
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ====================================================
// Bangladesh Tax View (BD Tax Summary)
// ====================================================
function BangladeshTaxView({ driverData }: { driverData: any }) {
  const { toast } = useToast();

  // Fetch Bangladesh tax summary
  const { data: bdTaxData, isLoading: bdTaxLoading } = useQuery({
    queryKey: ["/api/driver/bd-tax-summary"],
  });

  const currentYear = new Date().getFullYear();
  const currentYearSummary = (bdTaxData as any)?.currentYear;
  const availableYears = (bdTaxData as any)?.availableYears || [];

  // Format currency for BD drivers
  const formatCurrency = (amount: number) => {
    return `৳${amount.toFixed(2)}`;
  };

  // Download BD tax document
  const downloadBDTaxDocument = async (year: number) => {
    try {
      const response = await fetch(`/api/driver/bd-tax-documents/${year}`, {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to download document");
      }

      const data = await response.json();

      // Download as JSON (later can be converted to PDF)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `BD-Tax-Summary-${year}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Success",
        description: `BD Tax Summary for ${year} downloaded successfully`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to download tax document",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="bg-background">
      <div className="bg-primary text-primary-foreground p-6">
        <div className="flex items-center gap-4">
          <Link href="/driver/account">
            <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10" data-testid="button-back">
              <ArrowLeft className="h-6 w-6" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Tax Info</h1>
        </div>
      </div>

      <div className="p-6 max-w-2xl mx-auto space-y-6">
        {/* Year-to-Date Earnings Summary */}
        {!bdTaxLoading && currentYearSummary && (
          <Card>
            <CardHeader>
              <CardTitle>Year-to-Date Earnings ({currentYear})</CardTitle>
              <CardDescription>Your earnings breakdown for tax purposes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <DollarSign className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Total Trip Earnings</p>
                    <p className="text-sm text-muted-foreground">Gross fares before commission</p>
                  </div>
                </div>
                <p className="text-lg font-bold" data-testid="text-total-trip-earnings">{formatCurrency(currentYearSummary.total_trip_earnings || 0)}</p>
              </div>

              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <DollarSign className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">SafeGo Commission</p>
                    <p className="text-sm text-muted-foreground">Platform fees deducted</p>
                  </div>
                </div>
                <p className="text-lg font-bold" data-testid="text-commission-total">{formatCurrency(currentYearSummary.safego_commission_total || 0)}</p>
              </div>

              <div className="flex items-center justify-between p-4 bg-primary/10 rounded-lg border-2 border-primary/20">
                <div>
                  <p className="font-semibold">Net Payout</p>
                  <p className="text-xs text-muted-foreground">Your earnings after commission</p>
                </div>
                <p className="text-2xl font-bold text-primary" data-testid="text-net-payout">{formatCurrency(currentYearSummary.driver_net_payout || 0)}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* BD Tax Documents */}
        <Card>
          <CardHeader>
            <CardTitle>BD Tax Documents</CardTitle>
            <CardDescription>Download your annual income summaries</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {availableYears.map((year: number) => (
              <div key={year} className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{year} BD Tax Summary {year === currentYear && "(Year-to-date)"}</p>
                    <p className="text-sm text-muted-foreground">
                      {year === currentYear ? "Current year earnings summary" : "Complete year earnings"}
                    </p>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  data-testid={`button-download-bd-tax-${year}`}
                  onClick={() => downloadBDTaxDocument(year)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Taxpayer Information (Bangladesh) */}
        <Card>
          <CardHeader>
            <CardTitle>Taxpayer Information (Bangladesh)</CardTitle>
            <CardDescription>Tax reporting information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Country</span>
              <Badge variant="outline" data-testid="badge-country">
                Bangladesh
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Taxpayer Type</span>
              <span className="text-sm font-medium" data-testid="text-taxpayer-type">Self-employed / Independent Driver</span>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg border border-muted-foreground/20 mt-4">
              <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-tax-disclaimer">
                SafeGo provides annual income summaries to help with your personal tax reporting in Bangladesh. 
                SafeGo does not file or submit tax returns on your behalf. For exact tax calculations and filing, 
                please consult a local tax professional or follow NBR (National Board of Revenue) guidelines.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
