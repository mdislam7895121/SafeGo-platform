import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Lock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface SecurityNotesPanelProps {
  notes: string | null | undefined;
  className?: string;
}

export function SecurityNotesPanel({ notes, className = "" }: SecurityNotesPanelProps) {
  // Don't show panel if there are no notes
  if (!notes || notes.trim() === "") {
    return null;
  }

  return (
    <Card className={className} data-testid="card-security-notes">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Lock className="h-4 w-4 text-muted-foreground" />
          Security Notes
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <Alert variant="default" className="border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30">
          <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          <AlertDescription className="text-sm text-muted-foreground whitespace-pre-wrap">
            {notes}
          </AlertDescription>
        </Alert>
        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
          <Lock className="h-3 w-3" />
          Read-only. Only super-admin can edit via admin settings.
        </p>
      </CardContent>
    </Card>
  );
}
