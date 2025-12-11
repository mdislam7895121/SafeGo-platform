import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Shield,
  Phone,
  Users,
  Plus,
  Trash2,
  AlertTriangle,
  MapPin,
  Mic,
  Eye,
  FileText,
  CheckCircle,
  Clock,
  ExternalLink
} from "lucide-react";
import { EmergencySosButton, SafetyCenterWidget } from "@/components/safety/EmergencySosButton";
import { ReportForm } from "@/components/safety/ReportForm";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
  isPrimary: boolean;
}

interface SafetyPolicy {
  id: string;
  version: string;
  title: string;
  summary?: string;
  contentUrl?: string;
}

export default function CustomerSafetyCenter() {
  const [addContactDialogOpen, setAddContactDialogOpen] = useState(false);
  const [newContact, setNewContact] = useState({
    name: "",
    phone: "",
    relationship: "family",
    isPrimary: false,
  });
  const { toast } = useToast();

  const { data: contactsData, isLoading: contactsLoading } = useQuery<{ success: boolean; contacts: EmergencyContact[] }>({
    queryKey: ["/api/policy-safety/emergency-contacts/my"],
  });

  const { data: safetyPolicy } = useQuery<{ success: boolean; policy: SafetyPolicy }>({
    queryKey: ["/api/policy-safety/safety-policy/active"],
  });

  const addContactMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/policy-safety/emergency-contacts", {
        method: "POST",
        body: JSON.stringify(newContact),
      });
    },
    onSuccess: () => {
      toast({ title: "Contact Added", description: "Emergency contact has been added." });
      queryClient.invalidateQueries({ queryKey: ["/api/policy-safety/emergency-contacts/my"] });
      setAddContactDialogOpen(false);
      setNewContact({ name: "", phone: "", relationship: "family", isPrimary: false });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add contact.", variant: "destructive" });
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/policy-safety/emergency-contacts/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      toast({ title: "Contact Removed", description: "Emergency contact has been removed." });
      queryClient.invalidateQueries({ queryKey: ["/api/policy-safety/emergency-contacts/my"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to remove contact.", variant: "destructive" });
    },
  });

  const contacts = contactsData?.contacts || [];

  return (
    <div className="p-4 space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Safety Center</h1>
          <p className="text-muted-foreground">Your safety tools and emergency contacts</p>
        </div>
      </div>

      <EmergencySosButton variant="inline" />

      <Tabs defaultValue="contacts">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="contacts" data-testid="tab-contacts">
            <Users className="h-4 w-4 mr-2" />
            Contacts
          </TabsTrigger>
          <TabsTrigger value="tools" data-testid="tab-tools">
            <Shield className="h-4 w-4 mr-2" />
            Safety Tools
          </TabsTrigger>
          <TabsTrigger value="policy" data-testid="tab-policy">
            <FileText className="h-4 w-4 mr-2" />
            Policies
          </TabsTrigger>
        </TabsList>

        <TabsContent value="contacts" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
              <div>
                <CardTitle className="text-lg">Emergency Contacts</CardTitle>
                <CardDescription>People we can contact in an emergency</CardDescription>
              </div>
              <Dialog open={addContactDialogOpen} onOpenChange={setAddContactDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="button-add-contact">
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Emergency Contact</DialogTitle>
                    <DialogDescription>Add someone we can contact in an emergency</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input
                        placeholder="Contact name"
                        value={newContact.name}
                        onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                        data-testid="input-contact-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone Number</Label>
                      <Input
                        placeholder="+1 (555) 123-4567"
                        value={newContact.phone}
                        onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                        data-testid="input-contact-phone"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Relationship</Label>
                      <Select value={newContact.relationship} onValueChange={(v) => setNewContact({ ...newContact, relationship: v })}>
                        <SelectTrigger data-testid="select-relationship">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="family">Family</SelectItem>
                          <SelectItem value="friend">Friend</SelectItem>
                          <SelectItem value="spouse">Spouse</SelectItem>
                          <SelectItem value="parent">Parent</SelectItem>
                          <SelectItem value="sibling">Sibling</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setAddContactDialogOpen(false)} data-testid="button-cancel">
                      Cancel
                    </Button>
                    <Button
                      onClick={() => addContactMutation.mutate()}
                      disabled={!newContact.name || !newContact.phone || addContactMutation.isPending}
                      data-testid="button-save-contact"
                    >
                      {addContactMutation.isPending ? "Adding..." : "Add Contact"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {contactsLoading ? (
                <div className="space-y-3">
                  <div className="h-16 bg-muted rounded animate-pulse" />
                  <div className="h-16 bg-muted rounded animate-pulse" />
                </div>
              ) : contacts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No emergency contacts added</p>
                  <p className="text-sm">Add contacts so we can reach them if needed</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {contacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                      data-testid={`contact-${contact.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Users className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{contact.name}</p>
                            {contact.isPrimary && (
                              <Badge variant="secondary" className="text-xs">Primary</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{contact.phone}</p>
                          <p className="text-xs text-muted-foreground capitalize">{contact.relationship}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => window.location.href = `tel:${contact.phone}`}
                          data-testid={`button-call-${contact.id}`}
                        >
                          <Phone className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteContactMutation.mutate(contact.id)}
                          data-testid={`button-delete-${contact.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tools" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Safety Features</CardTitle>
              <CardDescription>Tools to keep you safe during rides</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start" data-testid="button-share-trip">
                <MapPin className="h-4 w-4 mr-3" />
                <div className="text-left">
                  <p className="font-medium">Share Trip Status</p>
                  <p className="text-xs text-muted-foreground">Let others track your ride in real-time</p>
                </div>
              </Button>
              <Button variant="outline" className="w-full justify-start" data-testid="button-record-audio">
                <Mic className="h-4 w-4 mr-3" />
                <div className="text-left">
                  <p className="font-medium">Record Audio</p>
                  <p className="text-xs text-muted-foreground">Securely record audio during your ride</p>
                </div>
              </Button>
              <Button variant="outline" className="w-full justify-start" data-testid="button-trusted-contacts">
                <Eye className="h-4 w-4 mr-3" />
                <div className="text-left">
                  <p className="font-medium">Trusted Contacts</p>
                  <p className="text-xs text-muted-foreground">Automatically share rides with trusted people</p>
                </div>
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => window.location.href = "tel:911"}
                data-testid="button-call-911"
              >
                <Phone className="h-4 w-4 mr-3" />
                <div className="text-left">
                  <p className="font-medium">Call 911</p>
                  <p className="text-xs text-muted-foreground">Direct line to emergency services</p>
                </div>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Report an Issue</CardTitle>
              <CardDescription>Help us maintain a safe community</CardDescription>
            </CardHeader>
            <CardContent>
              <ReportForm variant="inline" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="policy" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Safety Policy</CardTitle>
              <CardDescription>Our commitment to your safety</CardDescription>
            </CardHeader>
            <CardContent>
              {safetyPolicy?.policy ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{safetyPolicy.policy.title}</p>
                      <p className="text-sm text-muted-foreground">Version {safetyPolicy.policy.version}</p>
                    </div>
                    <Badge className="bg-green-500">Active</Badge>
                  </div>
                  {safetyPolicy.policy.summary && (
                    <p className="text-sm text-muted-foreground">{safetyPolicy.policy.summary}</p>
                  )}
                  {safetyPolicy.policy.contentUrl && (
                    <Button variant="outline" asChild className="w-full">
                      <a href={safetyPolicy.policy.contentUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Read Full Policy
                      </a>
                    </Button>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Safety policy not available</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Community Guidelines</CardTitle>
              <CardDescription>How we maintain a respectful community</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                  <span>Treat everyone with respect and dignity</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                  <span>Follow all local traffic and safety laws</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                  <span>Report any safety concerns immediately</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                  <span>Keep vehicles clean and well-maintained</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                  <span>No discrimination of any kind</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <EmergencySosButton variant="floating" />
    </div>
  );
}
