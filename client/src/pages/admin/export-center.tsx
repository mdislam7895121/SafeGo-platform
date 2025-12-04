import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  Download, 
  FileText, 
  FileSpreadsheet,
  FileJson,
  Calendar as CalendarIcon,
  Clock,
  CheckCircle,
  Loader2,
  History
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface ExportModule {
  id: string;
  name: string;
  formats: string[];
  description: string;
}

interface ExportHistory {
  id: string;
  module: string;
  format: string;
  status: string;
  createdAt: string;
  fileSize: string;
}

const formatIcons: Record<string, any> = {
  csv: FileSpreadsheet,
  pdf: FileText,
  json: FileJson,
};

export default function ExportCenter() {
  const [selectedModule, setSelectedModule] = useState("");
  const [selectedFormat, setSelectedFormat] = useState("");
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const { toast } = useToast();

  const { data: modules, isLoading: modulesLoading } = useQuery<{ modules: ExportModule[] }>({
    queryKey: ["/api/admin/phase3a/exports/available"],
  });

  const { data: history, isLoading: historyLoading } = useQuery<{ exports: ExportHistory[] }>({
    queryKey: ["/api/admin/phase3a/exports/history"],
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("/api/admin/phase3a/exports/generate", {
        method: "POST",
        body: JSON.stringify({
          module: selectedModule,
          format: selectedFormat,
          dateFrom: dateFrom?.toISOString(),
          dateTo: dateTo?.toISOString(),
        }),
      });
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Export Started",
        description: "Your export has been queued. You'll be notified when it's ready.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/phase3a/exports/history"] });
    },
    onError: () => {
      toast({
        title: "Export Failed",
        description: "Failed to start export. Please try again.",
        variant: "destructive",
      });
    },
  });

  const selectedModuleData = modules?.modules.find(m => m.id === selectedModule);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Global Export Center</h1>
          <p className="text-muted-foreground">Export data in CSV, PDF, or JSON format</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              New Export
            </CardTitle>
            <CardDescription>Configure and generate data exports</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Data Module</label>
              <Select value={selectedModule} onValueChange={setSelectedModule}>
                <SelectTrigger data-testid="select-module">
                  <SelectValue placeholder="Select module to export" />
                </SelectTrigger>
                <SelectContent>
                  {modules?.modules.map((module) => (
                    <SelectItem key={module.id} value={module.id}>
                      {module.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedModuleData && (
                <p className="text-xs text-muted-foreground">{selectedModuleData.description}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Export Format</label>
              <Select 
                value={selectedFormat} 
                onValueChange={setSelectedFormat}
                disabled={!selectedModule}
              >
                <SelectTrigger data-testid="select-format">
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  {selectedModuleData?.formats.map((format) => {
                    const Icon = formatIcons[format] || FileText;
                    return (
                      <SelectItem key={format} value={format}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {format.toUpperCase()}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">From Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      {dateFrom ? format(dateFrom, "MMM dd, yyyy") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">To Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      {dateTo ? format(dateTo, "MMM dd, yyyy") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={dateTo} onSelect={setDateTo} />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <Button
              className="w-full"
              disabled={!selectedModule || !selectedFormat || exportMutation.isPending}
              onClick={() => exportMutation.mutate()}
              data-testid="button-export"
            >
              {exportMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Generate Export
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Export History
            </CardTitle>
            <CardDescription>Recent exports and downloads</CardDescription>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <ScrollArea className="h-[300px]">
                <div className="space-y-4">
                  {history?.exports.map((exp) => {
                    const Icon = formatIcons[exp.format] || FileText;
                    return (
                      <div
                        key={exp.id}
                        className="flex items-center gap-4 p-3 border rounded-lg"
                        data-testid={`export-${exp.id}`}
                      >
                        <div className="p-2 bg-muted rounded">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium capitalize">{exp.module}</div>
                          <div className="text-sm text-muted-foreground flex items-center gap-2">
                            <Clock className="h-3 w-3" />
                            {new Date(exp.createdAt).toLocaleDateString()}
                            <span>-</span>
                            <span>{exp.fileSize}</span>
                          </div>
                        </div>
                        <Badge variant={exp.status === "completed" ? "default" : "secondary"}>
                          {exp.status === "completed" ? (
                            <CheckCircle className="h-3 w-3 mr-1" />
                          ) : (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          )}
                          {exp.status}
                        </Badge>
                        {exp.status === "completed" && (
                          <Button size="sm" variant="outline" data-testid={`button-download-${exp.id}`}>
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Available Modules</CardTitle>
          <CardDescription>All data modules available for export</CardDescription>
        </CardHeader>
        <CardContent>
          {modulesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {modules?.modules.map((module) => (
                <Card
                  key={module.id}
                  className={`cursor-pointer hover-elevate ${selectedModule === module.id ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => setSelectedModule(module.id)}
                  data-testid={`module-${module.id}`}
                >
                  <CardContent className="pt-4">
                    <div className="font-medium">{module.name}</div>
                    <p className="text-xs text-muted-foreground mb-2">{module.description}</p>
                    <div className="flex gap-1">
                      {module.formats.map((format) => (
                        <Badge key={format} variant="outline" className="text-xs">
                          {format.toUpperCase()}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
