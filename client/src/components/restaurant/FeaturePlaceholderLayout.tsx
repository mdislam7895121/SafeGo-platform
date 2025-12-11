import { Link } from "wouter";
import { ArrowLeft, LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface FeaturePlaceholderLayoutProps {
  title: string;
  subtitle: string;
  icon?: LucideIcon;
  plannedCapabilities: string[];
  statusTag: string;
  infoNote: string;
}

export function FeaturePlaceholderLayout({
  title,
  subtitle,
  icon: Icon,
  plannedCapabilities,
  statusTag,
  infoNote
}: FeaturePlaceholderLayoutProps) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 md:p-6 lg:p-8">
      <div className="w-full max-w-2xl space-y-6">
        {/* Icon Circle */}
        {Icon && (
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Icon className="w-8 h-8 text-muted-foreground" />
            </div>
          </div>
        )}

        {/* Title Section */}
        <div className="text-center space-y-2">
          <h1 
            className="text-2xl md:text-3xl font-bold" 
            data-testid={`text-placeholder-title-${title.toLowerCase().replace(/\s+/g, '-')}`}
          >
            {title}
          </h1>
          <p 
            className="text-muted-foreground text-sm md:text-base"
            data-testid="text-placeholder-subtitle"
          >
            {subtitle}
          </p>
        </div>

        {/* Status Badge */}
        <div className="flex justify-center">
          <Badge 
            variant="outline" 
            className="px-3 py-1"
            data-testid="badge-feature-status"
          >
            {statusTag}
          </Badge>
        </div>

        {/* Planned Capabilities Card */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-4 text-center md:text-left">
              What you'll be able to do here:
            </h3>
            <ul className="space-y-2 text-sm">
              {plannedCapabilities.map((capability, index) => (
                <li 
                  key={index} 
                  className="flex items-start gap-2"
                  data-testid={`list-capability-${index}`}
                >
                  <span className="text-muted-foreground mt-0.5 select-none">•</span>
                  <span className="text-muted-foreground">{capability}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Info Note */}
        <div 
          className="bg-muted/50 rounded-lg p-4 text-center"
          data-testid="container-info-note"
        >
          <p 
            className="text-xs md:text-sm text-muted-foreground"
            data-testid="text-info-note"
          >
            {infoNote}
          </p>
        </div>

        {/* Back to Dashboard Button */}
        <div className="flex justify-center pt-2">
          <Link href="/partner/restaurant/dashboard">
            <Button 
              variant="outline" 
              className="gap-2"
              data-testid="button-back-dashboard"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
