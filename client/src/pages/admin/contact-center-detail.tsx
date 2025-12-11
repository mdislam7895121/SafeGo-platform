import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { MessageSquare, ArrowLeft, Mail, Globe, Clock, User, Save, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";

interface InternalNote {
  note: string;
  addedBy: string;
  addedAt: string;
}

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
  message: string;
  source: string;
  status: string;
  priority: string;
  relatedService: string | null;
  assignedToAdminId: string | null;
  resolvedAt: string | null;
  internalNotes: InternalNote[];
  metadata: {
    ip?: string;
    userAgent?: string;
    submittedAt?: string;
  } | null;
}

export default function AdminContactCenterDetail() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [status, setStatus] = useState<string>("");
  const [priority, setPriority] = useState<string>("");
  const [newNote, setNewNote] = useState("");

  const { data: submission, isLoading } = useQuery<ContactSubmission>({
    queryKey: ['/api/contact', id],
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: { status?: string; priority?: string; internalNote?: string }) => {
      return apiRequest(`/api/contact/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contact', id] });
      queryClient.invalidateQueries({ queryKey: ['/api/contact'] });
      toast({
        title: "Updated",
        description: "Submission updated successfully",
      });
      setNewNote("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update submission",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    const updates: any = {};
    if (status && status !== submission?.status) updates.status = status;
    if (priority && priority !== submission?.priority) updates.priority = priority;
    if (newNote.trim()) updates.internalNote = newNote.trim();

    if (Object.keys(updates).length === 0) {
      toast({
        title: "No changes",
        description: "Make changes before saving",
      });
      return;
    }

    updateMutation.mutate(updates);
  };

  const handleResolve = () => {
    updateMutation.mutate({ status: 'resolved' });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "resolved":
        return <Badge className="bg-green-500">Resolved</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500">Pending</Badge>;
      default:
        return <Badge variant="destructive">Open</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "high":
        return <Badge variant="destructive">High Priority</Badge>;
      case "normal":
        return <Badge variant="secondary">Normal Priority</Badge>;
      default:
        return <Badge variant="outline">Low Priority</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto text-center py-12">
          <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Submission not found</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/admin/contact-center')}>
            Back to Contact Center
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      <div className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin/contact-center')} className="mb-4" data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Contact Center
          </Button>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold mb-2" data-testid="text-title">{submission.categoryLabel}</h1>
              <div className="flex items-center gap-2 flex-wrap">
                {getStatusBadge(submission.status)}
                {getPriorityBadge(submission.priority)}
                <Badge variant="outline">{submission.region || 'Global'}</Badge>
              </div>
            </div>
            <div className="flex gap-2">
              {submission.status !== 'resolved' && (
                <Button onClick={handleResolve} disabled={updateMutation.isPending} data-testid="button-resolve">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Mark Resolved
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Message
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap" data-testid="text-message">{submission.message}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Contact Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="font-medium" data-testid="text-name">{submission.fullName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <a href={`mailto:${submission.email}`} className="font-medium text-blue-600 hover:underline" data-testid="text-email">
                  {submission.email}
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <p data-testid="text-country">{submission.country}</p>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm" data-testid="text-submitted">
                  {format(new Date(submission.createdAt), 'PPp')}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Update Status</CardTitle>
            <CardDescription>Change the status and priority of this submission</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status || submission.status} onValueChange={setStatus}>
                  <SelectTrigger data-testid="select-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={priority || submission.priority} onValueChange={setPriority}>
                  <SelectTrigger data-testid="select-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Internal Notes</CardTitle>
            <CardDescription>Add private notes visible only to admins</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {submission.internalNotes && submission.internalNotes.length > 0 && (
              <div className="space-y-3">
                {submission.internalNotes.map((note, index) => (
                  <div key={index} className="p-3 bg-muted rounded-lg">
                    <p className="text-sm mb-2" data-testid={`text-note-${index}`}>{note.note}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span data-testid={`text-note-author-${index}`}>{note.addedBy}</span>
                      <span>-</span>
                      <span data-testid={`text-note-time-${index}`}>
                        {formatDistanceToNow(new Date(note.addedAt), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                ))}
                <Separator />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="new-note">Add Note</Label>
              <Textarea
                id="new-note"
                placeholder="Add an internal note..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                rows={3}
                data-testid="input-note"
              />
            </div>

            <Button onClick={handleSave} disabled={updateMutation.isPending} data-testid="button-save">
              <Save className="h-4 w-4 mr-2" />
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </CardContent>
        </Card>

        {submission.metadata && (
          <Card>
            <CardHeader>
              <CardTitle>Technical Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Source</p>
                  <p className="font-mono">{submission.source}</p>
                </div>
                {submission.metadata.ip && (
                  <div>
                    <p className="text-muted-foreground">IP Address</p>
                    <p className="font-mono" data-testid="text-ip">{submission.metadata.ip}</p>
                  </div>
                )}
                {submission.relatedService && (
                  <div>
                    <p className="text-muted-foreground">Related Service</p>
                    <p className="capitalize">{submission.relatedService}</p>
                  </div>
                )}
                {submission.resolvedAt && (
                  <div>
                    <p className="text-muted-foreground">Resolved At</p>
                    <p>{format(new Date(submission.resolvedAt), 'PPp')}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
