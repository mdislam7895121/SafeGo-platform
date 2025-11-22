import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileText, Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function TaxInfo() {
  const [_, navigate] = useLocation();

  const { data: driverData } = useQuery({
    queryKey: ["/api/driver/home"],
  });

  const profile = (driverData as any)?.profile;
  
  // Determine W-9 status badge
  const w9Status = profile?.w9Status || "pending";
  const w9StatusConfig = {
    pending: { label: "Pending", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
    submitted: { label: "Submitted", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
    approved: { label: "On File", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  };
  
  const taxIdStatus = profile?.hasSSN || profile?.hasNID ? "Verified" : "Pending";

  return (
    <div className="bg-background">
      <div className="bg-primary text-primary-foreground p-6 ">
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
                  <p className="font-medium">2024 Tax Summary</p>
                  <p className="text-sm text-muted-foreground">Year-to-date earnings</p>
                </div>
              </div>
              <Button variant="outline" size="sm" data-testid="button-download-2024">
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>

            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">2023 1099-K Form</p>
                  <p className="text-sm text-muted-foreground">Complete tax year</p>
                </div>
              </div>
              <Button variant="outline" size="sm" data-testid="button-download-2023">
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
              >
                {taxIdStatus}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">W-9 Form</span>
              <Badge 
                variant="outline" 
                className={w9StatusConfig[w9Status as keyof typeof w9StatusConfig]?.className}
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
