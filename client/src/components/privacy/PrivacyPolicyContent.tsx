/**
 * PrivacyPolicyContent Component
 * 
 * Displays the active privacy policy with version info, content, and consent toggles.
 * Used by all roles: Customer, Driver, Restaurant, Shop Partner, Ticket Operator, Admin
 */

import { useState, useEffect } from "react";
import { 
  Shield, 
  FileText, 
  Check, 
  X, 
  Calendar,
  ExternalLink,
  Loader2 
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

interface PolicyData {
  version: string;
  title: string;
  contentUrl: string;
  summary?: string;
  createdAt: string;
  updatedAt: string;
}

interface ConsentStatus {
  privacyPolicyVersion: string | null;
  termsAccepted: boolean;
  privacyAccepted: boolean;
  policyAcceptedAt: string | null;
  marketingOptIn: boolean;
  dataSharingOptIn: boolean;
  locationPermission: boolean;
  trackingConsent: boolean;
}

interface PrivacyPolicyContentProps {
  policy: PolicyData | null;
  consentStatus: ConsentStatus | null;
  mustAcceptNewPolicy: boolean;
  isLoading?: boolean;
  isPreviewMode?: boolean;
  onAccept?: (preferences: ConsentPreferences) => void;
  onDecline?: () => void;
  isPending?: boolean;
}

export interface ConsentPreferences {
  marketingOptIn: boolean;
  dataSharingOptIn: boolean;
  trackingConsent: boolean;
}

export function PrivacyPolicyContent({
  policy,
  consentStatus,
  mustAcceptNewPolicy,
  isLoading = false,
  isPreviewMode = false,
  onAccept,
  onDecline,
  isPending = false,
}: PrivacyPolicyContentProps) {
  const [preferences, setPreferences] = useState<ConsentPreferences>({
    marketingOptIn: consentStatus?.marketingOptIn ?? false,
    dataSharingOptIn: consentStatus?.dataSharingOptIn ?? false,
    trackingConsent: consentStatus?.trackingConsent ?? false,
  });

  useEffect(() => {
    if (consentStatus) {
      setPreferences({
        marketingOptIn: consentStatus.marketingOptIn ?? false,
        dataSharingOptIn: consentStatus.dataSharingOptIn ?? false,
        trackingConsent: consentStatus.trackingConsent ?? false,
      });
    }
  }, [consentStatus]);

  if (isLoading) {
    return (
      <div className="space-y-6" data-testid="privacy-loading">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (!policy) {
    return (
      <Card data-testid="privacy-no-policy">
        <CardContent className="py-12 text-center">
          <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">No active privacy policy found.</p>
        </CardContent>
      </Card>
    );
  }

  const formattedDate = new Date(policy.updatedAt || policy.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const handleAccept = () => {
    if (onAccept) {
      onAccept(preferences);
    }
  };

  return (
    <div className="space-y-6" data-testid="privacy-policy-content">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold" data-testid="text-policy-title">{policy.title}</h2>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="outline" data-testid="badge-policy-version">Version {policy.version}</Badge>
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Updated {formattedDate}
              </span>
            </div>
          </div>
        </div>
        {mustAcceptNewPolicy && !isPreviewMode && (
          <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20" data-testid="badge-action-required">
            Action Required
          </Badge>
        )}
        {isPreviewMode && (
          <Badge variant="secondary" data-testid="badge-preview-mode">
            Preview Mode
          </Badge>
        )}
      </div>

      {policy.summary && (
        <Card data-testid="card-policy-summary">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Summary of Changes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{policy.summary}</p>
          </CardContent>
        </Card>
      )}

      <Card data-testid="card-policy-content">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center justify-between gap-2">
            <span>Full Policy Document</span>
            <Button variant="ghost" size="sm" asChild data-testid="button-view-full-policy">
              <a href={policy.contentUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-1" />
                Open Full Document
              </a>
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-64 border rounded-md p-4 bg-muted/30">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-muted-foreground">
                This privacy policy describes how SafeGo collects, uses, and protects your personal information. 
                By using our services, you agree to the terms outlined in this policy.
              </p>
              <h3 className="text-base font-medium mt-4">Data Collection</h3>
              <p className="text-muted-foreground">
                We collect information you provide directly, including account details, payment information, 
                location data during rides, and communication preferences.
              </p>
              <h3 className="text-base font-medium mt-4">Data Usage</h3>
              <p className="text-muted-foreground">
                Your data is used to provide and improve our services, process payments, communicate with you, 
                and ensure safety during rides and deliveries.
              </p>
              <h3 className="text-base font-medium mt-4">Data Protection</h3>
              <p className="text-muted-foreground">
                We implement industry-standard security measures to protect your information. 
                You can request access to, correction of, or deletion of your personal data at any time.
              </p>
              <p className="text-sm text-muted-foreground mt-4">
                For the complete policy, please click "Open Full Document" above.
              </p>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card data-testid="card-consent-preferences">
        <CardHeader>
          <CardTitle className="text-base">Consent Preferences</CardTitle>
          <CardDescription>
            Choose how we can use your data. You can update these preferences anytime.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex-1 pr-4">
              <Label htmlFor="marketing-opt-in" className="font-medium">Marketing Communications</Label>
              <p className="text-sm text-muted-foreground">
                Receive promotional offers, news, and updates about SafeGo services
              </p>
            </div>
            <Switch
              id="marketing-opt-in"
              checked={preferences.marketingOptIn}
              onCheckedChange={(checked) => setPreferences({ ...preferences, marketingOptIn: checked })}
              disabled={isPreviewMode || isPending}
              data-testid="switch-marketing"
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex-1 pr-4">
              <Label htmlFor="data-sharing-opt-in" className="font-medium">Data Sharing</Label>
              <p className="text-sm text-muted-foreground">
                Allow sharing anonymized data with trusted partners to improve services
              </p>
            </div>
            <Switch
              id="data-sharing-opt-in"
              checked={preferences.dataSharingOptIn}
              onCheckedChange={(checked) => setPreferences({ ...preferences, dataSharingOptIn: checked })}
              disabled={isPreviewMode || isPending}
              data-testid="switch-data-sharing"
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex-1 pr-4">
              <Label htmlFor="tracking-consent" className="font-medium">Analytics & Tracking</Label>
              <p className="text-sm text-muted-foreground">
                Help us improve by allowing app usage analytics and performance tracking
              </p>
            </div>
            <Switch
              id="tracking-consent"
              checked={preferences.trackingConsent}
              onCheckedChange={(checked) => setPreferences({ ...preferences, trackingConsent: checked })}
              disabled={isPreviewMode || isPending}
              data-testid="switch-tracking"
            />
          </div>
        </CardContent>
      </Card>

      {consentStatus?.policyAcceptedAt && !mustAcceptNewPolicy && (
        <div className="text-sm text-muted-foreground flex items-center gap-2" data-testid="text-last-accepted">
          <Check className="h-4 w-4 text-green-500" />
          You accepted version {consentStatus.privacyPolicyVersion} on{" "}
          {new Date(consentStatus.policyAcceptedAt).toLocaleDateString()}
        </div>
      )}

      {!isPreviewMode && (mustAcceptNewPolicy || !consentStatus?.termsAccepted) && (
        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onDecline}
            disabled={isPending}
            data-testid="button-decline-policy"
          >
            <X className="h-4 w-4 mr-2" />
            Decline
          </Button>
          <Button
            className="flex-1"
            onClick={handleAccept}
            disabled={isPending}
            data-testid="button-accept-policy"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Check className="h-4 w-4 mr-2" />
            )}
            Accept Privacy Policy
          </Button>
        </div>
      )}

      {!isPreviewMode && !mustAcceptNewPolicy && consentStatus?.termsAccepted && (
        <div className="flex justify-end pt-4">
          <Button
            onClick={handleAccept}
            disabled={isPending}
            data-testid="button-update-preferences"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Check className="h-4 w-4 mr-2" />
            )}
            Update Preferences
          </Button>
        </div>
      )}
    </div>
  );
}

export default PrivacyPolicyContent;
