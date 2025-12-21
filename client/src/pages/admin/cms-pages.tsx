import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  FileText, Plus, Search, Edit, Trash2, Eye, EyeOff, 
  ChevronLeft, Save, X, Globe, Lock, AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface CmsPage {
  id: string;
  slug: string;
  title: string;
  body?: string;
  category: string;
  status: string;
  visibility: string;
  metaDescription?: string;
  metaKeywords?: string;
  createdAt: string;
  updatedAt: string;
}

const CATEGORIES = [
  { value: 'legal', label: 'Legal' },
  { value: 'company', label: 'Company' },
  { value: 'support', label: 'Support' },
  { value: 'partner', label: 'Partner' }
];

const STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' }
];

const VISIBILITIES = [
  { value: 'public_visible', label: 'Public' },
  { value: 'partner_only', label: 'Partner Only' }
];

async function fetchPages(category?: string, status?: string, search?: string) {
  const params = new URLSearchParams();
  if (category) params.append('category', category);
  if (status) params.append('status', status);
  if (search) params.append('search', search);
  
  const res = await fetch(`/api/cms/admin?${params.toString()}`, {
    credentials: 'include'
  });
  if (!res.ok) throw new Error('Failed to fetch pages');
  return res.json();
}

async function fetchPage(id: string) {
  const res = await fetch(`/api/cms/admin/${id}`, {
    credentials: 'include'
  });
  if (!res.ok) throw new Error('Failed to fetch page');
  return res.json();
}

async function createPage(data: Partial<CmsPage>) {
  const res = await fetch('/api/cms/admin', {
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

async function updatePage(id: string, data: Partial<CmsPage>) {
  const res = await fetch(`/api/cms/admin/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to update page');
  }
  return res.json();
}

async function deletePage(id: string) {
  const res = await fetch(`/api/cms/admin/${id}`, {
    method: 'DELETE',
    credentials: 'include'
  });
  if (!res.ok) throw new Error('Failed to delete page');
  return res.json();
}

export default function AdminCmsPages() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isEditing, setIsEditing] = useState(false);
  const [editingPage, setEditingPage] = useState<CmsPage | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  
  const [formData, setFormData] = useState({
    slug: '',
    title: '',
    body: '',
    category: 'company',
    status: 'draft',
    visibility: 'public_visible',
    metaDescription: '',
    metaKeywords: ''
  });

  const [deleteConfirm, setDeleteConfirm] = useState<CmsPage | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['cms-pages', filterCategory, filterStatus, searchQuery],
    queryFn: () => fetchPages(filterCategory, filterStatus, searchQuery)
  });

  const createMutation = useMutation({
    mutationFn: createPage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cms-pages'] });
      toast({ title: 'Page created successfully' });
      setIsCreating(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CmsPage> }) => updatePage(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cms-pages'] });
      toast({ title: 'Page updated successfully' });
      setIsEditing(false);
      setEditingPage(null);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deletePage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cms-pages'] });
      toast({ title: 'Page deleted successfully' });
      setDeleteConfirm(null);
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const resetForm = () => {
    setFormData({
      slug: '',
      title: '',
      body: '',
      category: 'company',
      status: 'draft',
      visibility: 'public_visible',
      metaDescription: '',
      metaKeywords: ''
    });
  };

  const handleEdit = async (page: CmsPage) => {
    try {
      const fullPage = await fetchPage(page.id);
      setEditingPage(fullPage);
      setFormData({
        slug: fullPage.slug,
        title: fullPage.title,
        body: fullPage.body || '',
        category: fullPage.category,
        status: fullPage.status,
        visibility: fullPage.visibility,
        metaDescription: fullPage.metaDescription || '',
        metaKeywords: fullPage.metaKeywords || ''
      });
      setIsEditing(true);
    } catch (error) {
      toast({ title: 'Error loading page', variant: 'destructive' });
    }
  };

  const handleSubmit = () => {
    if (isCreating) {
      createMutation.mutate(formData);
    } else if (editingPage) {
      const { slug, ...updateData } = formData;
      updateMutation.mutate({ id: editingPage.id, data: updateData });
    }
  };

  const pages = data?.pages || [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="ghost" size="sm">
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <FileText className="h-6 w-6" />
                Content Pages
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Manage legal, company, and support pages
              </p>
            </div>
          </div>
          <Button onClick={() => { resetForm(); setIsCreating(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            New Page
          </Button>
        </div>

        <Card className="mb-6">
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search pages..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={filterCategory || "all"} onValueChange={(v) => setFilterCategory(v === "all" ? "" : v)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterStatus || "all"} onValueChange={(v) => setFilterStatus(v === "all" ? "" : v)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {STATUSES.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : error ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <p className="text-red-500">Failed to load pages</p>
            </CardContent>
          </Card>
        ) : pages.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No pages found</p>
              <Button onClick={() => { resetForm(); setIsCreating(true); }} className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Create First Page
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {pages.map((page: CmsPage) => (
              <Card key={page.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {page.title}
                        </h3>
                        <Badge variant={page.status === 'published' ? 'default' : 'secondary'}>
                          {page.status === 'published' ? (
                            <><Eye className="h-3 w-3 mr-1" /> Published</>
                          ) : (
                            <><EyeOff className="h-3 w-3 mr-1" /> Draft</>
                          )}
                        </Badge>
                        <Badge variant="outline">
                          {CATEGORIES.find(c => c.value === page.category)?.label || page.category}
                        </Badge>
                        {page.visibility === 'partner_only' && (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                            <Lock className="h-3 w-3 mr-1" /> Partner Only
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        <span className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">/{page.slug}</span>
                        {' '}&bull;{' '}
                        Updated {new Date(page.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(`/p/${page.slug}`, '_blank')}
                      >
                        <Globe className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(page)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteConfirm(page)}
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={isCreating || isEditing} onOpenChange={(open) => {
        if (!open) {
          setIsCreating(false);
          setIsEditing(false);
          setEditingPage(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isCreating ? 'Create New Page' : 'Edit Page'}
            </DialogTitle>
            <DialogDescription>
              {isCreating ? 'Create a new content page' : 'Update the page content and settings'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {isCreating && (
              <div>
                <Label htmlFor="slug">URL Slug</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                  placeholder="e.g., about-us"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Will be accessible at: /p/{formData.slug || 'your-slug'}
                </p>
              </div>
            )}
            
            <div>
              <Label htmlFor="title">Page Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., About SafeGo"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Category</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Visibility</Label>
                <Select value={formData.visibility} onValueChange={(v) => setFormData({ ...formData, visibility: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VISIBILITIES.map(v => (
                      <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="body">Page Content</Label>
              <Textarea
                id="body"
                value={formData.body}
                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                placeholder="Enter the page content here. You can use basic markdown like **bold** and *italic*."
                rows={12}
              />
            </div>

            <div>
              <Label htmlFor="metaDescription">Meta Description (SEO)</Label>
              <Textarea
                id="metaDescription"
                value={formData.metaDescription}
                onChange={(e) => setFormData({ ...formData, metaDescription: e.target.value })}
                placeholder="Brief description for search engines"
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="metaKeywords">Meta Keywords (SEO)</Label>
              <Input
                id="metaKeywords"
                value={formData.metaKeywords}
                onChange={(e) => setFormData({ ...formData, metaKeywords: e.target.value })}
                placeholder="e.g., safego, about, company"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsCreating(false);
              setIsEditing(false);
              setEditingPage(null);
              resetForm();
            }}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending || !formData.title || (isCreating && !formData.slug)}
            >
              <Save className="h-4 w-4 mr-2" />
              {isCreating ? 'Create Page' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Page</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteConfirm?.title}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
              disabled={deleteMutation.isPending}
            >
              Delete Page
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
