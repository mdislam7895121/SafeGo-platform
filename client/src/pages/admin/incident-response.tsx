import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  AlertTriangle, 
  Plus, 
  Clock, 
  User,
  MessageSquare,
  CheckCircle,
  XCircle,
  Search,
  Filter
} from "lucide-react";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Incident {
  id: string;
  title: string;
  status: string;
  priority: string;
  assignedTo: string;
  createdAt: string;
}

const priorityColors: Record<string, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  low: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
};

const statusColors: Record<string, string> = {
  open: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  investigating: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  resolved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  closed: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

export default function IncidentResponse() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [newIncident, setNewIncident] = useState({
    title: "",
    description: "",
    priority: "medium",
    category: "system",
    assignedTo: "",
  });
  const [note, setNote] = useState("");
  const { toast } = useToast();

  const { data: incidents, isLoading } = useQuery<{ incidents: Incident[]; total: number }>({
    queryKey: ["/api/admin/phase3a/incidents"],
  });

  const createIncidentMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/admin/phase3a/incidents", {
        method: "POST",
        body: JSON.stringify(newIncident),
      });
    },
    onSuccess: () => {
      toast({ title: "Incident Created", description: "New incident has been created." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/phase3a/incidents"] });
      setCreateDialogOpen(false);
      setNewIncident({ title: "", description: "", priority: "medium", category: "system", assignedTo: "" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create incident.", variant: "destructive" });
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/admin/phase3a/incidents/${selectedIncident?.id}/timeline`, {
        method: "POST",
        body: JSON.stringify({ note, action: "note_added" }),
      });
    },
    onSuccess: () => {
      toast({ title: "Note Added", description: "Timeline entry added to incident." });
      setNoteDialogOpen(false);
      setNote("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add note.", variant: "destructive" });
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Incident Response Playbook</h1>
          <p className="text-muted-foreground">Manage and track platform incidents</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-incident">
              <Plus className="h-4 w-4 mr-2" />
              Create Incident
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create New Incident</DialogTitle>
              <DialogDescription>Log a new incident for tracking and response</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Title</label>
                <Input
                  placeholder="Brief incident title"
                  value={newIncident.title}
                  onChange={(e) => setNewIncident({ ...newIncident, title: e.target.value })}
                  data-testid="input-incident-title"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  placeholder="Detailed description of the incident"
                  value={newIncident.description}
                  onChange={(e) => setNewIncident({ ...newIncident, description: e.target.value })}
                  data-testid="input-incident-description"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Priority</label>
                  <Select
                    value={newIncident.priority}
                    onValueChange={(v) => setNewIncident({ ...newIncident, priority: v })}
                  >
                    <SelectTrigger data-testid="select-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Category</label>
                  <Select
                    value={newIncident.category}
                    onValueChange={(v) => setNewIncident({ ...newIncident, category: v })}
                  >
                    <SelectTrigger data-testid="select-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="system">System</SelectItem>
                      <SelectItem value="security">Security</SelectItem>
                      <SelectItem value="payment">Payment</SelectItem>
                      <SelectItem value="user_safety">User Safety</SelectItem>
                      <SelectItem value="compliance">Compliance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Assign To</label>
                <Input
                  placeholder="Team or individual"
                  value={newIncident.assignedTo}
                  onChange={(e) => setNewIncident({ ...newIncident, assignedTo: e.target.value })}
                  data-testid="input-assigned-to"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createIncidentMutation.mutate()}
                disabled={createIncidentMutation.isPending || !newIncident.title}
                data-testid="button-submit-incident"
              >
                {createIncidentMutation.isPending ? "Creating..." : "Create Incident"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card data-testid="card-stat-open">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Open</p>
                <p className="text-2xl font-bold text-red-600">
                  {incidents?.incidents.filter(i => i.status === "open").length || 0}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-investigating">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Investigating</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {incidents?.incidents.filter(i => i.status === "investigating").length || 0}
                </p>
              </div>
              <Search className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-resolved">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Resolved</p>
                <p className="text-2xl font-bold text-green-600">
                  {incidents?.incidents.filter(i => i.status === "resolved").length || 0}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-total">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{incidents?.total || 0}</p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Incidents</CardTitle>
          <CardDescription>All tracked incidents with their current status</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-4">
                {incidents?.incidents.map((incident) => (
                  <Card key={incident.id} className="hover-elevate" data-testid={`incident-${incident.id}`}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-muted-foreground">{incident.id}</span>
                            <Badge className={priorityColors[incident.priority] || priorityColors.medium}>
                              {incident.priority}
                            </Badge>
                            <Badge className={statusColors[incident.status] || statusColors.open}>
                              {incident.status}
                            </Badge>
                          </div>
                          <h3 className="font-medium">{incident.title}</h3>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {incident.assignedTo}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(incident.createdAt), "MMM dd, HH:mm")}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedIncident(incident);
                              setNoteDialogOpen(true);
                            }}
                            data-testid={`button-add-note-${incident.id}`}
                          >
                            <MessageSquare className="h-4 w-4 mr-1" />
                            Add Note
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {incidents?.incidents.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No incidents recorded
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Timeline Entry</DialogTitle>
            <DialogDescription>
              Add a note or update to incident {selectedIncident?.id}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea
              placeholder="Enter your note or update..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              data-testid="input-note"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => addNoteMutation.mutate()}
              disabled={addNoteMutation.isPending || !note}
              data-testid="button-submit-note"
            >
              {addNoteMutation.isPending ? "Adding..." : "Add Note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
