import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";

interface PlaceholderPageProps {
  title: string;
  description: string;
  module: string;
}

export function PlaceholderPage({ title, description, module }: PlaceholderPageProps) {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid={`text-page-title-${module}`}>
          {title}
        </h1>
        <p className="text-muted-foreground mt-2">{description}</p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          This is a placeholder for {module}. This page will be implemented in later phases.
          Do not remove; navigation and routing structure are in place.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            The {title} functionality will be available in the next phase of development.
            The navigation structure is ready for future implementation.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
