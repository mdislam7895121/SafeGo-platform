import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Layout, Plus, Edit, Trash2, Eye, EyeOff, Save, X, Globe,
  Settings, ChevronDown, ChevronUp, GripVertical, Palette
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";

interface LandingSection {
  id: string;
  key: string;
  orderIndex: number;
  isEnabled: boolean;
  title?: string;
  subtitle?: string;
  body?: string;
  ctas?: any;
  media?: any;
  settings?: any;
}

interface LandingPage {
  id: string;
  country: string;
  locale: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  sections: LandingSection[];
}

interface LandingSettings {
  id: string;
  country: string;
  defaultRegion?: string;
  showTestingBanner: boolean;
  testingBannerText?: string;
  supportEmail?: string;
  supportPhone?: string;
  socialLinks?: any;
  footerLinks?: any;
  legalLinks?: any;
  servicesConfig?: any;
}

const COUNTRIES = [
  { value: 'GLOBAL', label: 'Global (Default)' },
  { value: 'BD', label: 'Bangladesh' },
  { value: 'US', label: 'United States' }
];

const SECTION_KEYS = [
  { value: 'hero', label: 'Hero Section', description: 'Main headline and CTA' },
  { value: 'services', label: 'Services', description: 'Service offerings grid' },
  { value: 'how_it_works', label: 'How It Works', description: 'Step-by-step guide' },
  { value: 'safety', label: 'Safety', description: 'Safety features highlight' },
  { value: 'partners', label: 'Partners', description: 'Partner/driver signup CTA' },
  { value: 'faq', label: 'FAQ', description: 'Frequently asked questions' },
  { value: 'ready_to_move', label: 'Ready to Move', description: 'Final CTA section' },
  { value: 'footer', label: 'Footer', description: 'Site footer content' },
  { value: 'announcement_bar', label: 'Announcement Bar', description: 'Top banner notifications' },
  { value: 'contact_cta', label: 'Contact CTA', description: 'Contact form section' }
];

async function fetchPages() {
  const res = await fetch('/api/admin/landing/pages', { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch pages');
  return res.json();
}

async function fetchPage(id: string) {
  const res = await fetch(`/api/admin/landing/pages/${id}`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch page');
  return res.json();
}

async function fetchSettings() {
  const res = await fetch('/api/admin/landing/settings', { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch settings');
  return res.json();
}

async function createPage(data: { country: string; locale: string }) {
  const res = await fetch('/api/admin/landing/pages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to create page');
  }
  return res.json();
}

async function publishPage(country: string, pageId: string) {
  const res = await fetch(`/api/admin/landing/publish/${country}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ pageId })
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to publish page');
  }
  return res.json();
}

async function createSection(pageId: string, data: Partial<LandingSection>) {
  const res = await fetch(`/api/admin/landing/pages/${pageId}/sections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to create section');
  }
  return res.json();
}

async function updateSection(sectionId: string, data: Partial<LandingSection>) {
  const res = await fetch(`/api/admin/landing/sections/${sectionId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to update section');
  }
  return res.json();
}

async function deleteSection(sectionId: string) {
  const res = await fetch(`/api/admin/landing/sections/${sectionId}`, {
    method: 'DELETE',
    credentials: 'include'
  });
  if (!res.ok) throw new Error('Failed to delete section');
  return res.json();
}

async function updateSettings(country: string, data: Partial<LandingSettings>) {
  const res = await fetch(`/api/admin/landing/settings/${country}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to update settings');
  }
  return res.json();
}

export default function AdminLandingCms() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedCountry, setSelectedCountry] = useState<string>('GLOBAL');
  const [activeTab, setActiveTab] = useState<string>('pages');
  const [editingSection, setEditingSection] = useState<LandingSection | null>(null);
  const [isCreatingPage, setIsCreatingPage] = useState(false);
  const [isAddingSection, setIsAddingSection] = useState(false);
  const [newPageCountry, setNewPageCountry] = useState('GLOBAL');
  const [newSectionKey, setNewSectionKey] = useState('hero');
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);

  const { data: pagesData, isLoading: pagesLoading } = useQuery({
    queryKey: ['landing-pages'],
    queryFn: fetchPages
  });

  const { data: pageDetail, isLoading: pageLoading } = useQuery({
    queryKey: ['landing-page', selectedPageId],
    queryFn: () => fetchPage(selectedPageId!),
    enabled: !!selectedPageId
  });

  const { data: settingsData } = useQuery({
    queryKey: ['landing-settings'],
    queryFn: fetchSettings
  });

  const createPageMutation = useMutation({
    mutationFn: createPage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['landing-pages'] });
      setIsCreatingPage(false);
      toast({ title: 'Page created', description: 'New landing page configuration created' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const publishMutation = useMutation({
    mutationFn: ({ country, pageId }: { country: string; pageId: string }) => publishPage(country, pageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['landing-pages'] });
      toast({ title: 'Published', description: 'Landing page is now live' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const createSectionMutation = useMutation({
    mutationFn: ({ pageId, data }: { pageId: string; data: Partial<LandingSection> }) => createSection(pageId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['landing-page', selectedPageId] });
      setIsAddingSection(false);
      toast({ title: 'Section added' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const updateSectionMutation = useMutation({
    mutationFn: ({ sectionId, data }: { sectionId: string; data: Partial<LandingSection> }) => updateSection(sectionId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['landing-page', selectedPageId] });
      setEditingSection(null);
      toast({ title: 'Section updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const deleteSectionMutation = useMutation({
    mutationFn: deleteSection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['landing-page', selectedPageId] });
      toast({ title: 'Section deleted' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const updateSettingsMutation = useMutation({
    mutationFn: ({ country, data }: { country: string; data: Partial<LandingSettings> }) => updateSettings(country, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['landing-settings'] });
      toast({ title: 'Settings saved' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const pages: LandingPage[] = pagesData?.pages || [];
  const filteredPages = pages.filter(p => selectedCountry === 'all' || p.country === selectedCountry);
  const settings: LandingSettings[] = settingsData?.settings || [];
  const currentSettings = settings.find(s => s.country === selectedCountry) || null;

  const existingSectionKeys = pageDetail?.sections?.map((s: LandingSection) => s.key) || [];
  const availableSectionKeys = SECTION_KEYS.filter(k => !existingSectionKeys.includes(k.value));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto py-6 px-4 max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Layout className="h-6 w-6 text-primary" />
              Landing Page CMS
            </h1>
            <p className="text-muted-foreground">Manage landing page content for each region</p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={selectedCountry} onValueChange={setSelectedCountry}>
              <SelectTrigger className="w-48">
                <Globe className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Select region" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Regions</SelectItem>
                {COUNTRIES.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="pages">Pages & Sections</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="pages">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-1">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-lg">Landing Pages</CardTitle>
                  <Button size="sm" variant="outline" onClick={() => setIsCreatingPage(true)}>
                    <Plus className="h-4 w-4 mr-1" /> New
                  </Button>
                </CardHeader>
                <CardContent>
                  {pagesLoading ? (
                    <p className="text-muted-foreground text-sm">Loading...</p>
                  ) : filteredPages.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No pages for this region</p>
                  ) : (
                    <div className="space-y-2">
                      {filteredPages.map(page => (
                        <div
                          key={page.id}
                          onClick={() => setSelectedPageId(page.id)}
                          className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                            selectedPageId === page.id
                              ? 'border-primary bg-primary/5'
                              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-medium">{COUNTRIES.find(c => c.value === page.country)?.label || page.country}</span>
                              <span className="text-sm text-muted-foreground ml-2">({page.locale})</span>
                            </div>
                            {page.isActive ? (
                              <Badge variant="default" className="bg-green-500">Live</Badge>
                            ) : (
                              <Badge variant="secondary">Draft</Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {page.sections?.length || 0} sections
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div>
                    <CardTitle className="text-lg">
                      {selectedPageId && pageDetail ? 'Edit Sections' : 'Select a Page'}
                    </CardTitle>
                    {pageDetail && (
                      <CardDescription>
                        {COUNTRIES.find(c => c.value === pageDetail.country)?.label} - {pageDetail.locale}
                      </CardDescription>
                    )}
                  </div>
                  {selectedPageId && pageDetail && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsAddingSection(true)}
                        disabled={availableSectionKeys.length === 0}
                      >
                        <Plus className="h-4 w-4 mr-1" /> Add Section
                      </Button>
                      {!pageDetail.isActive && (
                        <Button
                          size="sm"
                          onClick={() => publishMutation.mutate({ country: pageDetail.country, pageId: pageDetail.id })}
                          disabled={publishMutation.isPending}
                        >
                          Publish
                        </Button>
                      )}
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  {!selectedPageId ? (
                    <p className="text-muted-foreground text-center py-8">Select a page from the list to edit its sections</p>
                  ) : pageLoading ? (
                    <p className="text-muted-foreground text-center py-8">Loading...</p>
                  ) : (
                    <Accordion type="multiple" className="space-y-2">
                      {(pageDetail?.sections || [])
                        .sort((a: LandingSection, b: LandingSection) => a.orderIndex - b.orderIndex)
                        .map((section: LandingSection) => (
                          <AccordionItem key={section.id} value={section.id} className="border rounded-lg px-4">
                            <AccordionTrigger className="hover:no-underline">
                              <div className="flex items-center gap-3 w-full">
                                <GripVertical className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{SECTION_KEYS.find(k => k.value === section.key)?.label || section.key}</span>
                                {section.isEnabled ? (
                                  <Eye className="h-4 w-4 text-green-500" />
                                ) : (
                                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                                )}
                              </div>
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="space-y-4 pt-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Switch
                                      checked={section.isEnabled}
                                      onCheckedChange={(checked) => updateSectionMutation.mutate({
                                        sectionId: section.id,
                                        data: { isEnabled: checked }
                                      })}
                                    />
                                    <Label>Enabled</Label>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button size="sm" variant="ghost" onClick={() => setEditingSection(section)}>
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-red-500 hover:text-red-600"
                                      onClick={() => {
                                        if (confirm('Delete this section?')) {
                                          deleteSectionMutation.mutate(section.id);
                                        }
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                                {section.title && (
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Title</Label>
                                    <p className="text-sm">{section.title}</p>
                                  </div>
                                )}
                                {section.subtitle && (
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Subtitle</Label>
                                    <p className="text-sm">{section.subtitle}</p>
                                  </div>
                                )}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                    </Accordion>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Regional Settings
                </CardTitle>
                <CardDescription>Configure landing page settings for {COUNTRIES.find(c => c.value === selectedCountry)?.label || 'All Regions'}</CardDescription>
              </CardHeader>
              <CardContent>
                {selectedCountry === 'all' ? (
                  <p className="text-muted-foreground">Please select a specific region to configure settings</p>
                ) : (
                  <SettingsForm
                    settings={currentSettings}
                    country={selectedCountry}
                    onSave={(data) => updateSettingsMutation.mutate({ country: selectedCountry, data })}
                    isSaving={updateSettingsMutation.isPending}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={isCreatingPage} onOpenChange={setIsCreatingPage}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Landing Page</DialogTitle>
              <DialogDescription>Create a new landing page configuration for a region</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Region</Label>
                <Select value={newPageCountry} onValueChange={setNewPageCountry}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreatingPage(false)}>Cancel</Button>
              <Button
                onClick={() => createPageMutation.mutate({ country: newPageCountry, locale: 'en' })}
                disabled={createPageMutation.isPending}
              >
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isAddingSection} onOpenChange={setIsAddingSection}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Section</DialogTitle>
              <DialogDescription>Add a new section to this landing page</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Section Type</Label>
                <Select value={newSectionKey} onValueChange={setNewSectionKey}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSectionKeys.map(k => (
                      <SelectItem key={k.value} value={k.value}>
                        <div>
                          <div className="font-medium">{k.label}</div>
                          <div className="text-xs text-muted-foreground">{k.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddingSection(false)}>Cancel</Button>
              <Button
                onClick={() => createSectionMutation.mutate({
                  pageId: selectedPageId!,
                  data: {
                    key: newSectionKey,
                    orderIndex: (pageDetail?.sections?.length || 0),
                    isEnabled: true
                  }
                })}
                disabled={createSectionMutation.isPending}
              >
                Add Section
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {editingSection && (
          <SectionEditDialog
            section={editingSection}
            onClose={() => setEditingSection(null)}
            onSave={(data) => updateSectionMutation.mutate({ sectionId: editingSection.id, data })}
            isSaving={updateSectionMutation.isPending}
          />
        )}
      </div>
    </div>
  );
}

function SettingsForm({
  settings,
  country,
  onSave,
  isSaving
}: {
  settings: LandingSettings | null;
  country: string;
  onSave: (data: Partial<LandingSettings>) => void;
  isSaving: boolean;
}) {
  const [formData, setFormData] = useState({
    showTestingBanner: settings?.showTestingBanner ?? false,
    testingBannerText: settings?.testingBannerText || '',
    supportEmail: settings?.supportEmail || '',
    supportPhone: settings?.supportPhone || '',
    defaultRegion: settings?.defaultRegion || ''
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Switch
          id="testingBanner"
          checked={formData.showTestingBanner}
          onCheckedChange={(checked) => setFormData(p => ({ ...p, showTestingBanner: checked }))}
        />
        <Label htmlFor="testingBanner">Show Testing Banner</Label>
      </div>

      {formData.showTestingBanner && (
        <div>
          <Label>Banner Text</Label>
          <Input
            value={formData.testingBannerText}
            onChange={(e) => setFormData(p => ({ ...p, testingBannerText: e.target.value }))}
            placeholder="This is a testing environment"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Support Email</Label>
          <Input
            type="email"
            value={formData.supportEmail}
            onChange={(e) => setFormData(p => ({ ...p, supportEmail: e.target.value }))}
            placeholder="support@safego.app"
          />
        </div>
        <div>
          <Label>Support Phone</Label>
          <Input
            value={formData.supportPhone}
            onChange={(e) => setFormData(p => ({ ...p, supportPhone: e.target.value }))}
            placeholder="+880-1234-567890"
          />
        </div>
      </div>

      <div>
        <Label>Default Region Code</Label>
        <Input
          value={formData.defaultRegion}
          onChange={(e) => setFormData(p => ({ ...p, defaultRegion: e.target.value }))}
          placeholder="BD"
        />
      </div>

      <Button onClick={() => onSave(formData)} disabled={isSaving}>
        <Save className="h-4 w-4 mr-2" />
        Save Settings
      </Button>
    </div>
  );
}

function SectionEditDialog({
  section,
  onClose,
  onSave,
  isSaving
}: {
  section: LandingSection;
  onClose: () => void;
  onSave: (data: Partial<LandingSection>) => void;
  isSaving: boolean;
}) {
  const [formData, setFormData] = useState({
    title: section.title || '',
    subtitle: section.subtitle || '',
    body: section.body || '',
    orderIndex: section.orderIndex,
    isEnabled: section.isEnabled,
    ctas: JSON.stringify(section.ctas || [], null, 2),
    media: JSON.stringify(section.media || {}, null, 2),
    settings: JSON.stringify(section.settings || {}, null, 2)
  });

  const sectionInfo = SECTION_KEYS.find(k => k.value === section.key);

  const handleSave = () => {
    let ctasObj, mediaObj, settingsObj;
    try {
      ctasObj = formData.ctas ? JSON.parse(formData.ctas) : null;
      mediaObj = formData.media ? JSON.parse(formData.media) : null;
      settingsObj = formData.settings ? JSON.parse(formData.settings) : null;
    } catch (e) {
      alert('Invalid JSON in CTAs, Media, or Settings fields');
      return;
    }

    onSave({
      title: formData.title || undefined,
      subtitle: formData.subtitle || undefined,
      body: formData.body || undefined,
      orderIndex: formData.orderIndex,
      isEnabled: formData.isEnabled,
      ctas: ctasObj,
      media: mediaObj,
      settings: settingsObj
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit {sectionInfo?.label || section.key}</DialogTitle>
          <DialogDescription>{sectionInfo?.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex items-center gap-4">
            <Switch
              checked={formData.isEnabled}
              onCheckedChange={(checked) => setFormData(p => ({ ...p, isEnabled: checked }))}
            />
            <Label>Enabled</Label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Title</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))}
                placeholder="Section title"
              />
            </div>
            <div>
              <Label>Order Index</Label>
              <Input
                type="number"
                value={formData.orderIndex}
                onChange={(e) => setFormData(p => ({ ...p, orderIndex: parseInt(e.target.value) || 0 }))}
              />
            </div>
          </div>

          <div>
            <Label>Subtitle</Label>
            <Input
              value={formData.subtitle}
              onChange={(e) => setFormData(p => ({ ...p, subtitle: e.target.value }))}
              placeholder="Section subtitle"
            />
          </div>

          <div>
            <Label>Body Content</Label>
            <Textarea
              value={formData.body}
              onChange={(e) => setFormData(p => ({ ...p, body: e.target.value }))}
              placeholder="Main content for this section..."
              rows={4}
            />
          </div>

          <div>
            <Label>CTAs (JSON array)</Label>
            <Textarea
              value={formData.ctas}
              onChange={(e) => setFormData(p => ({ ...p, ctas: e.target.value }))}
              placeholder='[{"label": "Get Started", "href": "/signup"}]'
              rows={3}
              className="font-mono text-sm"
            />
          </div>

          <div>
            <Label>Media (JSON object)</Label>
            <Textarea
              value={formData.media}
              onChange={(e) => setFormData(p => ({ ...p, media: e.target.value }))}
              placeholder='{"imageUrl": "/images/hero.jpg"}'
              rows={3}
              className="font-mono text-sm"
            />
          </div>

          <div>
            <Label>Settings (JSON object)</Label>
            <Textarea
              value={formData.settings}
              onChange={(e) => setFormData(p => ({ ...p, settings: e.target.value }))}
              placeholder='{"backgroundColor": "#ffffff"}'
              rows={3}
              className="font-mono text-sm"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
